"""
modules/ontology_engine.py
--------------------------
FinGuard AI — Ontology Engine (Emotional Interceptor)

Classifies transactions via a vendor keyword ontology, computes Bayesian
regret probabilities, detects double-charges, and learns from user overrides.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import pandas as pd

# ── 1. VENDOR CATEGORY MAP ────────────────────────────────────────────────────
# Keys are lowercase substrings; longer keys are matched first (more specific).
VENDOR_CATEGORY_MAP: dict[str, str] = {
    # LateNightCraving — food delivery
    "uber eats":        "LateNightCraving",
    "zomato":           "LateNightCraving",
    "swiggy":           "LateNightCraving",
    "dunzo":            "LateNightCraving",
    "blinkit":          "LateNightCraving",
    "zepto":            "LateNightCraving",
    # EssentialGrocery
    "reliance fresh":   "EssentialGrocery",
    "more supermarket": "EssentialGrocery",
    "nature's basket":  "EssentialGrocery",
    "natures basket":   "EssentialGrocery",
    "bigbasket":        "EssentialGrocery",
    "big basket":       "EssentialGrocery",
    "dmart":            "EssentialGrocery",
    "grocery":          "EssentialGrocery",
    "milk":             "EssentialGrocery",
    "vegetable":        "EssentialGrocery",
    # RestaurantDining
    "starbucks":        "RestaurantDining",
    "chaayos":          "RestaurantDining",
    "mcdonald":         "RestaurantDining",
    "domino":           "RestaurantDining",
    "subway":           "RestaurantDining",
    "kfc":              "RestaurantDining",
    "burger king":      "RestaurantDining",
    "restaurant":       "RestaurantDining",
    "pizza":            "RestaurantDining",
    "cafe":             "RestaurantDining",
    "dining":           "RestaurantDining",
    # StreamingSubscription
    "amazon prime":     "StreamingSubscription",
    "youtube premium":  "StreamingSubscription",
    "hotstar":          "StreamingSubscription",
    "netflix":          "StreamingSubscription",
    "spotify":          "StreamingSubscription",
    "disney":           "StreamingSubscription",
    "zee5":             "StreamingSubscription",
    "sony liv":         "StreamingSubscription",
    # ImpulseEntertainment
    "bookmyshow":       "ImpulseEntertainment",
    "gaming":           "ImpulseEntertainment",
    "steam":            "ImpulseEntertainment",
    "inox":             "ImpulseEntertainment",
    "pvr":              "ImpulseEntertainment",
    "movie":            "ImpulseEntertainment",
    "concert":          "ImpulseEntertainment",
    # ImpulseClothing
    "pantaloons":       "ImpulseClothing",
    "westside":         "ImpulseClothing",
    "lifestyle":        "ImpulseClothing",
    "myntra":           "ImpulseClothing",
    "nykaa":            "ImpulseClothing",
    "ajio":             "ImpulseClothing",
    "zara":             "ImpulseClothing",
    "h&m":              "ImpulseClothing",
    "clothing":         "ImpulseClothing",
    "shoes":            "ImpulseClothing",
    "apparel":          "ImpulseClothing",
    # SocialPressure
    "brewery":          "SocialPressure",
    "alcohol":          "SocialPressure",
    "lounge":           "SocialPressure",
    "wine":             "SocialPressure",
    "beer":             "SocialPressure",
    "pub":              "SocialPressure",
    "bar":              "SocialPressure",
    "club":             "SocialPressure",
    "party":            "SocialPressure",
    # Travel
    "makemytrip":       "Travel",
    "redbus":           "Travel",
    "rapido":           "Travel",
    "irctc":            "Travel",
    "metro":            "Travel",
    "uber":             "Travel",   # must come AFTER "uber eats"
    "ola":              "Travel",
    "flight":           "Travel",
    "train":            "Travel",
    "cab":              "Travel",
    "petrol":           "Travel",
    # MedicalEssential (True zero-regret emergencies and treatment)
    "hospital":         "MedicalEssential",
    "clinic":           "MedicalEssential",
    "doctor":           "MedicalEssential",
    "treatment":        "MedicalEssential",
    "surgery":          "MedicalEssential",
    "medicine":         "MedicalEssential",
    "medical":          "MedicalEssential",
    "apollo":           "MedicalEssential",
    "medplus":          "MedicalEssential",
    "pharmacy":         "MedicalEssential",
    # HealthWellness (Fitness, supplements, lifestyle health)
    "cult.fit":         "HealthWellness",
    "gym":              "HealthWellness",
    "fitness":          "HealthWellness",
    "supplement":       "HealthWellness",
    "protein":          "HealthWellness",
    "spa":              "HealthWellness",
    # Utilities
    "electricity":      "Utilities",
    "water bill":       "Utilities",
    "vodafone":         "Utilities",
    "airtel":           "Utilities",
    "bsnl":             "Utilities",
    "jio":              "Utilities",
    "gas":              "Utilities",
    "wifi":             "Utilities",
    "broadband":        "Utilities",
    "recharge":         "Utilities",
    "rent":             "Utilities",
    # Savings
    "mutual fund":      "Savings",
    "zerodha":          "Savings",
    "groww":            "Savings",
    "sip":              "Savings",
    "ppf":              "Savings",
    "fd":               "Savings",
    "investment":       "Savings",
}

# ── 2. BAYESIAN REGRET PRIORS ─────────────────────────────────────────────────
REGRET_PRIORS: dict[str, float] = {
    "LateNightCraving":     0.72,
    "ImpulseClothing":      0.65,
    "SocialPressure":       0.58,
    "StreamingSubscription":0.45,
    "ImpulseEntertainment": 0.40,
    "GenericPurchase":      0.35,
    "RestaurantDining":     0.25,
    "HealthWellness":       0.15,
    "Travel":               0.15,
    "EssentialGrocery":     0.08,
    "Utilities":            0.05,
    "Savings":              0.02,
    "MedicalEssential":     0.00, # 0% Regret for medical
}

# ── 3. NECESSITY SCORES (1.0 = essential, 0.0 = pure impulse) ────────────────
NECESSITY_SCORES: dict[str, float] = {
    "MedicalEssential":     1.00,
    "Utilities":            1.00,
    "EssentialGrocery":     0.95,
    "Savings":              0.90,
    "Travel":               0.65,
    "GenericPurchase":      0.50,
    "HealthWellness":       0.50,
    "RestaurantDining":     0.45,
    "StreamingSubscription":0.35,
    "LateNightCraving":     0.20,
    "ImpulseEntertainment": 0.15,
    "SocialPressure":       0.12,
    "ImpulseClothing":      0.10,
}

# ── Internal constants ────────────────────────────────────────────────────────
_FOOD_DELIVERY_KEYWORDS: frozenset[str] = frozenset(
    {"zomato", "swiggy", "uber eats", "dunzo"}
)
_IMPULSE_CATEGORIES: frozenset[str] = frozenset(
    {"LateNightCraving", "ImpulseClothing", "SocialPressure", "ImpulseEntertainment"}
)
_REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {"Date", "Amount", "Payee", "TransactionType"}
)
# Pre-sort keywords longest-first so more specific phrases win (e.g. "uber eats" > "uber")
_SORTED_KEYWORDS: list[str] = sorted(VENDOR_CATEGORY_MAP, key=len, reverse=True)


# ── OntologyEngine class ──────────────────────────────────────────────────────

class OntologyEngine:
    """
    Emotional Interceptor: classifies transactions through an ontological lens,
    computes Bayesian regret probabilities, and detects anomalies.
    """

    def __init__(self) -> None:
        self.knowledge_graph: list[dict] = []
        self._override_counts: dict[str, int] = {k: 0 for k in REGRET_PRIORS}
        self._blended_regret: dict[str, float] = dict(REGRET_PRIORS)

    # ── Public API ─────────────────────────────────────────────────────────────

    def load_transactions(self, df: pd.DataFrame) -> dict:
        """
        Load and classify a transaction DataFrame.

        Parameters
        ----------
        df : pd.DataFrame
            Must contain: Date, Amount, Payee, TransactionType

        Returns
        -------
        dict : total_transactions, categories, category_counts,
               avg_daily_spend, top_category, data_quality
        """
        # 1. Column validation
        missing = _REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise ValueError(
                f"DataFrame is missing required column(s): {sorted(missing)}. "
                f"Required columns are: {sorted(_REQUIRED_COLUMNS)}."
            )

        # 2. Deduplicate by composite key
        df = df.drop_duplicates(subset=["Date", "Amount", "Payee"]).copy()

        # 3. Focus on debit transactions for spend analysis
        debits = df[df["TransactionType"].str.strip().str.lower() == "debit"].copy()

        # 4. Classify each transaction → build knowledge graph
        self.knowledge_graph = []
        for _, row in debits.iterrows():
            ts = _parse_timestamp(row["Date"])
            classification = self.classify_vendor(str(row["Payee"]), ts)
            self.knowledge_graph.append({
                "date":   row["Date"],
                "amount": float(row["Amount"]),
                "payee":  str(row["Payee"]),
                **classification,
            })

        total = len(self.knowledge_graph)

        # 5. Per-category counts
        category_counts: dict[str, int] = {}
        for tx in self.knowledge_graph:
            cat = tx["category"]
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # 6. Bayesian blend
        self._blended_regret = self._compute_blended_regret(category_counts, total)

        # 7. Summary stats
        avg_daily_spend = 0.0
        if total > 0:
            total_spend = sum(tx["amount"] for tx in self.knowledge_graph)
            unique_dates = debits["Date"].nunique()
            avg_daily_spend = round(total_spend / max(unique_dates, 1), 2)

        top_category = (
            max(category_counts, key=category_counts.__getitem__)
            if category_counts else None
        )

        return {
            "total_transactions": total,
            "categories":         list(category_counts.keys()),
            "category_counts":    category_counts,
            "avg_daily_spend":    avg_daily_spend,
            "top_category":       top_category,
            "data_quality":       "sufficient" if total >= 30 else "sparse",
        }

    def classify_vendor(
        self, payee: str, timestamp: Optional[datetime] = None
    ) -> dict:
        """
        Classify a payee and return its ontology metadata.

        Returns
        -------
        dict : category, regret_probability, necessity_score,
               impulse_flag, foreign_flag, late_night_flag
        """
        payee_lower = payee.lower().strip()

        # Foreign/non-ASCII detection
        foreign_flag = bool(re.search(r"[^\x00-\x7F]", payee))

        # Late-night window: 22:00 – 04:00
        late_night_flag = _is_late_night(timestamp)

        # Keyword matching (longest key first → most specific wins)
        category = "GenericPurchase"
        matched_keyword: Optional[str] = None
        for keyword in _SORTED_KEYWORDS:
            if keyword in payee_lower:
                category = VENDOR_CATEGORY_MAP[keyword]
                matched_keyword = keyword
                break

        # Late-night upgrade: food delivery at night → LateNightCraving
        if late_night_flag and matched_keyword in _FOOD_DELIVERY_KEYWORDS:
            category = "LateNightCraving"

        regret_probability = round(
            self._blended_regret.get(category, REGRET_PRIORS.get(category, 0.35)), 4
        )
        necessity_score = NECESSITY_SCORES.get(category, 0.50)
        impulse_flag = category in _IMPULSE_CATEGORIES

        return {
            "category":           category,
            "regret_probability": regret_probability,
            "necessity_score":    necessity_score,
            "impulse_flag":       impulse_flag,
            "foreign_flag":       foreign_flag,
            "late_night_flag":    late_night_flag,
        }

    def check_double_charge(
        self, payee: str, amount: float, date: datetime
    ) -> bool:
        """
        Return True if an identical charge (same payee, amount within ₹1,
        within 5 calendar days) already exists in the knowledge graph.
        """
        payee_lower = payee.lower().strip()
        for tx in self.knowledge_graph:
            tx_date = _parse_timestamp(tx["date"])
            if tx_date is None:
                continue
            if (
                tx["payee"].lower().strip() == payee_lower
                and abs(tx["amount"] - amount) <= 1.0
                and abs((tx_date.date() - date.date()).days) <= 5
            ):
                return True
        return False

    def get_category_regret_profile(self) -> dict:
        """
        Return per-category regret profile.
        Learning loop: if a category has ≥ 3 user overrides, regret is
        reduced by 10 % to reflect learned tolerance.
        """
        profile = {}
        for cat, base in self._blended_regret.items():
            overrides = self._override_counts.get(cat, 0)
            adjusted = round(base * 0.90, 4) if overrides >= 3 else round(base, 4)
            profile[cat] = {
                "override_count":             overrides,
                "base_regret_probability":    round(base, 4),
                "adjusted_regret_probability":adjusted,
            }
        return profile

    def add_override(self, category: str) -> None:
        """Record that the user dismissed a regret warning for this category."""
        self._override_counts[category] = self._override_counts.get(category, 0) + 1

    # ── Private helpers ────────────────────────────────────────────────────────

    def _compute_blended_regret(
        self, category_counts: dict[str, int], total: int
    ) -> dict[str, float]:
        """
        Blend Bayesian priors with observed category frequency.
        Formula (≥ 30 transactions):
            historical = prior × (category_count / max_category_count)
            final      = 0.4 × prior + 0.6 × historical
        Below 30 transactions: 100 % prior.
        """
        blended: dict[str, float] = {}
        max_count = max(category_counts.values(), default=1)
        for cat, prior in REGRET_PRIORS.items():
            if total >= 30:
                count = category_counts.get(cat, 0)
                historical = prior * (count / max_count)
                final = 0.4 * prior + 0.6 * historical
            else:
                final = prior
            blended[cat] = round(final, 4)
        return blended


# ── Module-level helpers ───────────────────────────────────────────────────────

def _is_late_night(ts: Optional[datetime]) -> bool:
    """Return True when the hour falls in the 22:00 – 03:59 window."""
    if ts is None:
        return False
    return ts.hour >= 22 or ts.hour < 4


def _parse_timestamp(value) -> Optional[datetime]:
    """Coerce str / pandas Timestamp / datetime to a datetime object."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        if hasattr(value, "to_pydatetime"):      # pandas Timestamp
            return value.to_pydatetime()
        return pd.to_datetime(str(value)).to_pydatetime()
    except Exception:
        return None
