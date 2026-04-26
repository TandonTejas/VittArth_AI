"""
tests/test_ontology.py
-----------------------
FinGuard AI — OntologyEngine test suite
TC-A01 through TC-A06
"""

import pytest
import pandas as pd
from datetime import datetime

from modules.ontology_engine import OntologyEngine


@pytest.fixture
def engine():
    return OntologyEngine()


# ── TC-A01 ────────────────────────────────────────────────────────────────────
def test_tc_a01_late_night_zomato(engine):
    """Zomato at 23:45 → LateNightCraving, regret ≈ 0.72, late_night_flag True."""
    ts = datetime(2026, 4, 25, 23, 45)
    result = engine.classify_vendor("Zomato", timestamp=ts)

    assert result["category"] == "LateNightCraving", (
        f"Expected LateNightCraving, got {result['category']}"
    )
    assert result["late_night_flag"] is True
    assert result["impulse_flag"] is True
    assert abs(result["regret_probability"] - 0.72) < 0.05, (
        f"Regret probability {result['regret_probability']} not close to 0.72"
    )


# ── TC-A02 ────────────────────────────────────────────────────────────────────
def test_tc_a02_dmart_morning(engine):
    """DMart at 10:30 → EssentialGrocery, regret ≈ 0.08, late_night_flag False."""
    ts = datetime(2026, 4, 25, 10, 30)
    result = engine.classify_vendor("DMart", timestamp=ts)

    assert result["category"] == "EssentialGrocery", (
        f"Expected EssentialGrocery, got {result['category']}"
    )
    assert result["late_night_flag"] is False
    assert result["impulse_flag"] is False
    assert abs(result["regret_probability"] - 0.08) < 0.05, (
        f"Regret probability {result['regret_probability']} not close to 0.08"
    )


# ── TC-A03 ────────────────────────────────────────────────────────────────────
def test_tc_a03_sparse_data_quality(engine):
    """CSV with 5 debit rows → data_quality == 'sparse'."""
    df = pd.DataFrame({
        "Date":            ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"],
        "Amount":          [200, 150, 499, 349, 89],
        "Payee":           ["DMart", "Starbucks", "Netflix", "Zomato", "Swiggy"],
        "TransactionType": ["Debit", "Debit", "Debit", "Debit", "Debit"],
    })
    stats = engine.load_transactions(df)

    assert stats["data_quality"] == "sparse", (
        f"Expected 'sparse', got '{stats['data_quality']}'"
    )
    assert stats["total_transactions"] == 5


# ── TC-A04 ────────────────────────────────────────────────────────────────────
def test_tc_a04_double_charge_netflix(engine):
    """Same Netflix ₹499 within 5 days → check_double_charge returns True."""
    # Pre-load a Netflix transaction into the knowledge graph
    df = pd.DataFrame({
        "Date":            ["2026-04-20"],
        "Amount":          [499],
        "Payee":           ["Netflix"],
        "TransactionType": ["Debit"],
    })
    engine.load_transactions(df)

    # Check for duplicate within 5 days (3 days later)
    check_date = datetime(2026, 4, 23, 12, 0)
    result = engine.check_double_charge("Netflix", 499.0, check_date)

    assert result is True, "Expected True for duplicate Netflix ₹499 within 5 days"


# ── TC-A05 ────────────────────────────────────────────────────────────────────
def test_tc_a05_foreign_currency_flag(engine):
    """Vendor with Japanese characters → foreign_flag True."""
    result = engine.classify_vendor("ユニクロ (Uniqlo)", timestamp=None)

    assert result["foreign_flag"] is True, (
        "Expected foreign_flag=True for non-ASCII vendor name"
    )


# ── TC-A06 ────────────────────────────────────────────────────────────────────
def test_tc_a06_missing_amount_column(engine):
    """CSV missing 'Amount' column → ValueError with clear message."""
    df_bad = pd.DataFrame({
        "Date":            ["2026-04-20"],
        "Payee":           ["Zomato"],
        "TransactionType": ["Debit"],
        # 'Amount' deliberately omitted
    })

    with pytest.raises(ValueError) as exc_info:
        engine.load_transactions(df_bad)

    error_msg = str(exc_info.value)
    assert "Amount" in error_msg, (
        f"Error message should mention 'Amount'. Got: {error_msg}"
    )
    assert "missing" in error_msg.lower(), (
        f"Error message should say 'missing'. Got: {error_msg}"
    )


# ── Additional sanity checks ──────────────────────────────────────────────────

def test_no_double_charge_outside_window(engine):
    """Same vendor but 10 days apart → check_double_charge returns False."""
    df = pd.DataFrame({
        "Date":            ["2026-04-01"],
        "Amount":          [499],
        "Payee":           ["Netflix"],
        "TransactionType": ["Debit"],
    })
    engine.load_transactions(df)

    check_date = datetime(2026, 4, 11, 12, 0)
    assert engine.check_double_charge("Netflix", 499.0, check_date) is False


def test_learning_loop_reduces_regret(engine):
    """After 3 overrides, adjusted regret should be 10% lower."""
    for _ in range(3):
        engine.add_override("ImpulseClothing")

    profile = engine.get_category_regret_profile()
    base = profile["ImpulseClothing"]["base_regret_probability"]
    adjusted = profile["ImpulseClothing"]["adjusted_regret_probability"]
    assert abs(adjusted - base * 0.90) < 0.001
    assert profile["ImpulseClothing"]["override_count"] == 3
