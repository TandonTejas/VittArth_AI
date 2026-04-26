"""
modules/survival_engine.py
--------------------------
FinGuard AI — Cash Flow Survival Engine (PyTorch)

Predicts how many days of financial runway remain, before and after a
proposed transaction, using a trained neural regression model with
Monte Carlo dropout uncertainty estimation.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ── Category encoding (stable int 0–11) ───────────────────────────────────────
CATEGORY_ENCODING: dict[str, int] = {
    "LateNightCraving":      0,
    "EssentialGrocery":      1,
    "RestaurantDining":      2,
    "StreamingSubscription": 3,
    "ImpulseEntertainment":  4,
    "ImpulseClothing":       5,
    "SocialPressure":        6,
    "Travel":                7,
    "HealthWellness":        8,
    "Utilities":             9,
    "Savings":               10,
    "GenericPurchase":       11,
}

_SURVIVAL_CAP = 90.0          # Maximum predicted runway days
_MC_PASSES    = 20             # Monte Carlo dropout forward passes
_WIDE_BAND_STD_THRESHOLD  = 3.0
_WIDE_BAND_VOL_THRESHOLD  = 200.0   # ₹ std-dev  → force wide band


# ── 1. Feature engineering ────────────────────────────────────────────────────

def prepare_features(
    balance: float,
    transaction_amount: float,
    transactions_df: pd.DataFrame,
    category: str = "GenericPurchase",
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
    [4] category_encoding        – stable int 0–11
    [5] time_of_day_encoding     – hour / 24
    """
    # Spending volatility over the last 7 calendar days
    volatility = _compute_7d_volatility(transactions_df)

    day_of_month = datetime.today().day
    cat_enc      = CATEGORY_ENCODING.get(category, 11)
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
        tmp = df.copy()
        tmp["Date"]   = pd.to_datetime(tmp["Date"])
        tmp["Amount"] = pd.to_numeric(tmp["Amount"], errors="coerce")
        # Debit only
        if "TransactionType" in tmp.columns:
            tmp = tmp[tmp["TransactionType"].str.lower() == "debit"]
        cutoff = pd.Timestamp.today() - pd.Timedelta(days=7)
        recent = tmp[tmp["Date"] >= cutoff]
        if len(recent) < 2:
            return 0.0
        daily = recent.groupby(recent["Date"].dt.date)["Amount"].sum()
        return float(daily.std()) if len(daily) > 1 else 0.0
    except Exception:
        return 0.0


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
        s_cat        = rng.integers(0, 12)
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
    """Mean daily debit spend from the transactions DataFrame."""
    if df is None or df.empty:
        return 500.0
    try:
        tmp = df.copy()
        tmp["Date"]   = pd.to_datetime(tmp["Date"])
        tmp["Amount"] = pd.to_numeric(tmp["Amount"], errors="coerce")
        if "TransactionType" in tmp.columns:
            tmp = tmp[tmp["TransactionType"].str.lower() == "debit"]
        daily = tmp.groupby(tmp["Date"].dt.date)["Amount"].sum()
        return float(daily.mean()) if len(daily) > 0 else 500.0
    except Exception:
        return 500.0


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
        category: str = "GenericPurchase",
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

        # Feature vectors
        f_before = prepare_features(balance, 0.0,               transactions_df, category, hour)
        f_after  = prepare_features(balance, transaction_amount, transactions_df, category, hour)

        before_scaled = self.scaler.transform(f_before.reshape(1, -1)).astype(np.float32)
        after_scaled  = self.scaler.transform(f_after.reshape(1, -1)).astype(np.float32)

        before_t = torch.from_numpy(before_scaled)
        after_t  = torch.from_numpy(after_scaled)

        # Monte Carlo dropout: run with dropout active to estimate uncertainty
        self.model.train()   # enables dropout
        mc_before, mc_after = [], []
        with torch.no_grad():
            for _ in range(_MC_PASSES):
                mc_before.append(float(self.model(before_t).item()))
                mc_after.append(float(self.model(after_t).item()))
        self.model.eval()

        days_before = float(np.clip(np.mean(mc_before), 0.0, _SURVIVAL_CAP))
        days_after  = float(np.clip(np.mean(mc_after),  0.0, _SURVIVAL_CAP))
        mc_std      = float(np.std(mc_after))

        delta = max(0.0, days_before - days_after)

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
        self.model = SurvivalNet()
        self.model.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
        self.model.eval()
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
