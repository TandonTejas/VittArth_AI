"""
modules/survival_engine.py
--------------------------
VittArth AI — Cash Flow Survival Engine (PyTorch)

Predicts how many days of financial runway remain, before and after a
proposed transaction, using a trained neural regression model with
Monte Carlo dropout uncertainty estimation.
"""

from __future__ import annotations

import os
import pickle
import re
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ── Category encoding (stable top-level ontology index) ───────────────────────
_TOP_CATEGORY_ORDER = [
    "food_and_dining",
    "transportation",
    "housing_rent",
    "healthcare",
    "education",
    "shopping_retail",
    "entertainment",
    "subscriptions",
    "telecom",
    "financial_services",
    "travel",
    "personal_care",
    "social_gifting",
    "transfers",
    "business_freelance",
    "pets",
    "government_payments",
    "childcare",
    "agriculture",
    "hidden_expenses",
    "illegal_unusual",
    "miscellaneous",
]

CATEGORY_ENCODING: dict[str, int] = {
    slug: idx for idx, slug in enumerate(_TOP_CATEGORY_ORDER)
}

_LEGACY_CATEGORY_ALIASES = {
    "LateNightCraving": "food_and_dining:food_delivery",
    "EssentialGrocery": "food_and_dining:groceries",
    "RestaurantDining": "food_and_dining:restaurants_cafes",
    "StreamingSubscription": "subscriptions:video_streaming",
    "ImpulseEntertainment": "entertainment:movies",
    "ImpulseClothing": "shopping_retail:clothing",
    "SocialPressure": "social_gifting:gifts",
    "Travel": "travel:holiday_packages",
    "HealthWellness": "healthcare:fitness",
    "Utilities": "housing_rent:electricity_bill",
    "Savings": "financial_services:mutual_fund",
    "MedicalEssential": "healthcare:pharmacy",
    "GenericPurchase": "miscellaneous:uncategorized",
    "Generic": "miscellaneous:uncategorized",
}


def _encode_category(category: str) -> int:
    canonical = _LEGACY_CATEGORY_ALIASES.get(category, category or "")
    top_slug = canonical.split(":", 1)[0]
    return CATEGORY_ENCODING.get(top_slug, len(CATEGORY_ENCODING))

_SURVIVAL_CAP = 90.0          # Maximum predicted runway days
_MC_PASSES    = 20             # Monte Carlo dropout forward passes
_WIDE_BAND_STD_THRESHOLD  = 3.0
_WIDE_BAND_VOL_THRESHOLD  = 200.0   # ₹ std-dev  → force wide band
_FIXED_EXPENSE_TOP_LEVELS = {"housing_rent", "subscriptions"}
_FIXED_EXPENSE_CATEGORIES = {
    "education:school_college_fees",
    "financial_services:loan_emi",
    "financial_services:insurance_premiums",
    "telecom:postpaid_bill",
    "government_payments:tax_payments",
}
_FIXED_EXPENSE_TERMS = re.compile(
    r"\b(?:rent|emi|loan|mortgage|subscription|netflix|spotify|prime|"
    r"insurance|premium|postpaid|electricity|water|gas|lpg|maintenance|"
    r"school fee|college fee|tuition|tax)\b",
    re.I,
)


# ── 1. Feature engineering ────────────────────────────────────────────────────

def prepare_features(
    balance: float,
    transaction_amount: float,
    transactions_df: pd.DataFrame,
    category: str = "miscellaneous:uncategorized",
    hour: int = 12,
) -> np.ndarray:
    """
    Build a (6,) feature vector for the SurvivalNet.

    Features
    --------
    [0] current_balance          – ₹
    [1] transaction_amount       – ₹
    [2] spending_volatility_7d   – std-dev of daily spend over last 7 days
    [3] day_of_month             – 1–31
    [4] category_encoding        – stable ontology top-level int
    [5] time_of_day_encoding     – hour / 24
    """
    # Spending volatility over the last 7 calendar days
    volatility = _compute_7d_volatility(transactions_df)

    day_of_month = datetime.today().day
    cat_enc      = _encode_category(category)
    tod_enc      = hour / 24.0

    return np.array(
        [balance, transaction_amount, volatility, day_of_month, cat_enc, tod_enc],
        dtype=np.float32,
    )


def _compute_7d_volatility(df: pd.DataFrame) -> float:
    """Std-dev of daily spend totals over the last 7 days (0 if insufficient)."""
    if df is None or df.empty:
        return 0.0
    try:
        tmp = variable_expense_statement(df)
        cutoff = pd.Timestamp.today() - pd.Timedelta(days=7)
        recent = tmp[tmp["Date"] >= cutoff]
        if len(recent) < 2:
            return 0.0
        daily = recent.groupby(recent["Date"].dt.date)["Amount"].sum()
        return float(daily.std()) if len(daily) > 1 else 0.0
    except Exception:
        return 0.0


def _parse_statement_dates(values) -> pd.Series:
    raw = pd.Series(values).astype(str)
    iso_mask = raw.str.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}$", na=False)
    parsed = pd.Series(pd.NaT, index=raw.index, dtype="datetime64[ns]")
    if iso_mask.any():
        parsed.loc[iso_mask] = pd.to_datetime(raw.loc[iso_mask], errors="coerce", yearfirst=True)
    non_iso = ~iso_mask
    if non_iso.any():
        parsed.loc[non_iso] = pd.to_datetime(raw.loc[non_iso], errors="coerce", dayfirst=True)
    return parsed


def _is_fixed_expense_row(row: pd.Series) -> bool:
    category = str(row.get("category", "") or "").lower()
    top = category.split(":", 1)[0]
    if top in _FIXED_EXPENSE_TOP_LEVELS or category in _FIXED_EXPENSE_CATEGORIES:
        return True
    payee = str(row.get("Payee", "") or "")
    return bool(_FIXED_EXPENSE_TERMS.search(payee))


def variable_expense_statement(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return debit rows that represent variable/other expenses only.

    Fixed expenses are already supplied during onboarding and subtracted from
    runway as fixed_remaining_this_month. Removing fixed-like rows here keeps
    rent, EMI, utilities, and subscriptions from being counted a second time in
    the daily spend rate learned from the bank statement.
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=["Date", "Amount", "Payee", "TransactionType"])

    tmp = df.copy()
    tmp["Date"] = _parse_statement_dates(tmp.get("Date"))
    tmp["Amount"] = pd.to_numeric(tmp.get("Amount"), errors="coerce").fillna(0.0)
    tmp = tmp[tmp["Date"].notna() & (tmp["Amount"] > 0)]
    if "TransactionType" in tmp.columns:
        tmp = tmp[tmp["TransactionType"].astype(str).str.lower().eq("debit")]
    if tmp.empty:
        return tmp
    fixed_mask = tmp.apply(_is_fixed_expense_row, axis=1)
    return tmp[~fixed_mask].copy()


# ── 2. Synthetic data generation ───────────────────────────────────────────────

def generate_training_data(
    transactions_df: pd.DataFrame,
    balance: float,
    fixed_monthly_expenses: float,
    n_samples: int = 600,
    random_state: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic (features, survival_days) pairs from historical data.

    Returns
    -------
    X : np.ndarray  shape (n_samples, 6)
    y : np.ndarray  shape (n_samples,)
    """
    rng = np.random.default_rng(random_state)

    # Estimate historical daily spend distribution
    hist_daily_spend = _estimate_daily_spend(transactions_df)
    if hist_daily_spend <= 0:
        hist_daily_spend = 500.0   # safe fallback

    X_rows, y_vals = [], []
    for _ in range(n_samples):
        # Randomise balance ±50 %
        s_balance    = balance * rng.uniform(0.5, 1.5)
        # Randomise daily spend from historical distribution with noise
        s_daily      = max(1.0, rng.normal(hist_daily_spend, hist_daily_spend * 0.3))
        # Randomise fixed remaining (0–100 % of monthly)
        s_fixed      = fixed_monthly_expenses * rng.uniform(0.0, 1.0)
        # Randomise transaction amount (0–30 % of balance)
        s_tx_amount  = s_balance * rng.uniform(0.0, 0.30)
        # Ground-truth survival after transaction
        net_balance  = max(0.0, s_balance - s_tx_amount - s_fixed)
        survival     = float(np.clip(net_balance / s_daily, 0, _SURVIVAL_CAP))

        # Randomise feature extras
        s_volatility = abs(rng.normal(0, hist_daily_spend * 0.25))
        s_day        = rng.integers(1, 32)
        s_cat        = rng.integers(0, len(CATEGORY_ENCODING) + 1)
        s_hour       = rng.uniform(0, 1)

        feats = np.array(
            [s_balance, s_tx_amount, s_volatility, s_day, s_cat, s_hour],
            dtype=np.float32,
        )
        # Gaussian noise for robustness
        feats += rng.normal(0, 0.01, size=feats.shape).astype(np.float32)

        X_rows.append(feats)
        y_vals.append(survival)

    return np.vstack(X_rows), np.array(y_vals, dtype=np.float32)


def _estimate_daily_spend(df: pd.DataFrame) -> float:
    """Mean daily variable debit spend from the transactions DataFrame."""
    if df is None or df.empty:
        return 500.0
    try:
        tmp = variable_expense_statement(df)
        daily = tmp.groupby(tmp["Date"].dt.date)["Amount"].sum()
        return float(daily.mean()) if len(daily) > 0 else 500.0
    except Exception:
        return 500.0


def estimate_variable_daily_spend(df: pd.DataFrame, fallback: float = 0.0) -> float:
    """Public helper for API routes that need the same non-fixed spend rate."""
    if df is None or df.empty:
        return float(fallback)
    try:
        tmp = variable_expense_statement(df)
        if tmp.empty:
            return float(fallback)
        date_range = (tmp["Date"].max() - tmp["Date"].min()).days + 1
        total = float(tmp["Amount"].sum())
        return round(total / max(date_range, 1), 2)
    except Exception:
        return float(fallback)


# ── 3. PyTorch model ───────────────────────────────────────────────────────────

class SurvivalNet(nn.Module):
    """
    Shallow regression network for financial runway prediction.
    Architecture: Input(6) → Linear(64) → ReLU → Dropout(0.2) → Linear(32) → ReLU → Linear(1)
    """

    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(6, 64),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── 4. SurvivalEngine class ────────────────────────────────────────────────────

class SurvivalEngine:
    """Cash Flow Survival Engine — trains and queries SurvivalNet."""

    def __init__(self) -> None:
        self.model:      Optional[SurvivalNet]    = None
        self.scaler:     Optional[StandardScaler] = None
        self.is_trained: bool                     = False
        self._n_training_points: int              = 0
        self.fixed_monthly_expenses: float        = 0.0
        self.training_daily_spend: float          = 500.0

    # ── train ──────────────────────────────────────────────────────────────────

    def train(
        self,
        transactions_df: pd.DataFrame,
        balance: float,
        fixed_monthly_expenses: float,
        epochs: int = 100,
        lr: float = 0.001,
    ) -> dict:
        """
        Generate synthetic data, scale, train SurvivalNet, save weights.

        Returns
        -------
        dict : val_mse, val_mae, epochs_trained, data_points_used
        """
        torch.manual_seed(42)
        np.random.seed(42)
        self.fixed_monthly_expenses = float(max(fixed_monthly_expenses, 0.0))
        self.training_daily_spend = float(max(_estimate_daily_spend(transactions_df), 1.0))

        X, y = generate_training_data(transactions_df, balance, fixed_monthly_expenses)

        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X).astype(np.float32)

        # Train / validation split (80 / 20)
        X_tr, X_val, y_tr, y_val = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        # Tensors
        X_tr_t  = torch.from_numpy(X_tr)
        y_tr_t  = torch.from_numpy(y_tr).unsqueeze(1)
        X_val_t = torch.from_numpy(X_val)
        y_val_t = torch.from_numpy(y_val).unsqueeze(1)

        # Model + optimiser + loss
        self.model = SurvivalNet()
        optimizer  = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion  = nn.MSELoss()

        self.model.train()
        for _ in range(epochs):
            optimizer.zero_grad()
            pred = self.model(X_tr_t)
            loss = criterion(pred, y_tr_t)
            loss.backward()
            optimizer.step()

        # Validation
        self.model.eval()
        with torch.no_grad():
            val_pred = self.model(X_val_t).squeeze(1)
            val_pred_clipped = torch.clamp(val_pred, 0.0, _SURVIVAL_CAP)
            val_mse = float(criterion(val_pred_clipped.unsqueeze(1), y_val_t).item())
            val_mae = float(torch.mean(torch.abs(val_pred_clipped - y_val_t.squeeze(1))).item())

        self.is_trained       = True
        self._n_training_points = len(X)

        # Persist weights
        os.makedirs("models", exist_ok=True)
        torch.save(self.model.state_dict(), "models/survival_model.pt")
        with open("models/survival_scaler.pkl", "wb") as f:
            pickle.dump(
                {
                    "scaler": self.scaler,
                    "fixed_monthly_expenses": self.fixed_monthly_expenses,
                    "training_daily_spend": self.training_daily_spend,
                },
                f,
            )

        return {
            "val_mse":          round(val_mse, 4),
            "val_mae":          round(val_mae, 4),
            "epochs_trained":   epochs,
            "data_points_used": len(X),
        }

    # ── predict ────────────────────────────────────────────────────────────────

    def predict(
        self,
        balance: float,
        transaction_amount: float,
        transactions_df: pd.DataFrame,
        category: str = "miscellaneous:uncategorized",
        hour: int = 12,
    ) -> dict:
        """
        Predict survival days before and after a proposed transaction.

        Returns
        -------
        dict : survival_days_before, survival_days_after, survival_delta,
               confidence_low, confidence_high, confidence_band
        """
        if not self.is_trained or self.model is None or self.scaler is None:
            raise RuntimeError("Model not trained. Call train() first.")

        volatility = _compute_7d_volatility(transactions_df)
        daily_rate = max(_estimate_daily_spend(transactions_df), 1.0)

        # Feature vectors
        f_before = prepare_features(balance, 0.0,               transactions_df, category, hour)
        f_after  = prepare_features(balance, transaction_amount, transactions_df, category, hour)

        before_scaled = self.scaler.transform(f_before.reshape(1, -1)).astype(np.float32)
        after_scaled  = self.scaler.transform(f_after.reshape(1, -1)).astype(np.float32)

        before_t = torch.from_numpy(before_scaled)
        after_t  = torch.from_numpy(after_scaled)

        # Monte Carlo dropout: deterministic seed keeps repeated API calls stable.
        torch.manual_seed(12345)
        self.model.train()   # enables dropout
        mc_before, mc_after = [], []
        with torch.no_grad():
            for _ in range(_MC_PASSES):
                mc_before.append(float(self.model(before_t).item()))
                mc_after.append(float(self.model(after_t).item()))
        self.model.eval()

        model_before = float(np.clip(np.mean(mc_before), 0.0, _SURVIVAL_CAP))
        model_after  = float(np.clip(np.mean(mc_after),  0.0, _SURVIVAL_CAP))
        mc_std      = float(np.std(mc_after))

        math_before = predict_mathematical(
            balance=balance,
            daily_spend_rate=daily_rate,
            transaction_amount=0.0,
            fixed_remaining_this_month=self.fixed_monthly_expenses,
        )
        math_after = predict_mathematical(
            balance=balance,
            daily_spend_rate=daily_rate,
            transaction_amount=transaction_amount,
            fixed_remaining_this_month=self.fixed_monthly_expenses,
        )

        # The neural model contributes shape, but the cash-flow equation is the
        # anchor. This prevents trained predictions from becoming non-monotonic.
        days_before = float(np.clip((0.75 * math_before) + (0.25 * model_before), 0.0, _SURVIVAL_CAP))
        days_after = float(np.clip((0.75 * math_after) + (0.25 * model_after), 0.0, _SURVIVAL_CAP))
        days_after = min(days_after, days_before)

        delta = max(0.0, days_before - days_after)
        if transaction_amount > 0 and delta == 0.0 and days_before > 0:
            analytic_delta = max(0.0, math_before - math_after)
            delta = min(days_before, analytic_delta)
            days_after = max(0.0, days_before - delta)

        conf_low  = float(np.clip(days_after - mc_std, 0.0, _SURVIVAL_CAP))
        conf_high = float(np.clip(days_after + mc_std, 0.0, _SURVIVAL_CAP))

        # Wide band: MC std > 3.0 OR high spending volatility
        is_wide = mc_std > _WIDE_BAND_STD_THRESHOLD or volatility > _WIDE_BAND_VOL_THRESHOLD
        confidence_band = "wide" if is_wide else "narrow"

        return {
            "survival_days_before": round(days_before, 2),
            "survival_days_after":  round(days_after,  2),
            "survival_delta":       round(delta,        2),
            "confidence_low":       round(conf_low,     2),
            "confidence_high":      round(conf_high,    2),
            "confidence_band":      confidence_band,
        }

    # ── load_model ─────────────────────────────────────────────────────────────

    def load_model(self, path: str = "models/survival_model.pt") -> bool:
        """Load saved weights. Returns True if successful, False if not found."""
        if not os.path.exists(path):
            return False
        scaler_path = os.path.join(os.path.dirname(path), "survival_scaler.pkl")
        if not os.path.exists(scaler_path):
            return False
        self.model = SurvivalNet()
        self.model.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
        self.model.eval()
        with open(scaler_path, "rb") as f:
            payload = pickle.load(f)
        self.scaler = payload.get("scaler")
        self.fixed_monthly_expenses = float(payload.get("fixed_monthly_expenses", 0.0))
        self.training_daily_spend = float(payload.get("training_daily_spend", 500.0))
        if self.scaler is None:
            return False
        self.is_trained = True
        return True


# ── 5. Mathematical fallback ───────────────────────────────────────────────────

def predict_mathematical(
    balance: float,
    daily_spend_rate: float,
    transaction_amount: float = 0.0,
    fixed_remaining_this_month: float = 0.0,
) -> float:
    """
    Pure-math runway estimate (no model required).

    survival = (balance - transaction_amount - fixed_remaining) / daily_spend_rate
    Clipped to [0, 90].
    """
    if daily_spend_rate <= 0:
        return _SURVIVAL_CAP
    net = balance - transaction_amount - fixed_remaining_this_month
    return float(np.clip(net / daily_spend_rate, 0.0, _SURVIVAL_CAP))
