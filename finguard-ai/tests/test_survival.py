"""
tests/test_survival.py
-----------------------
FinGuard AI — SurvivalEngine test suite
TC-C01 through TC-C05
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from modules.survival_engine import (
    SurvivalEngine,
    predict_mathematical,
    prepare_features,
    generate_training_data,
)


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _make_consistent_df(n_days: int = 60, daily_spend: float = 500.0) -> pd.DataFrame:
    """Transactions with perfectly consistent daily spend."""
    today = datetime.today()
    rows = []
    for i in range(n_days):
        rows.append({
            "Date":            (today - timedelta(days=i)).strftime("%Y-%m-%d"),
            "Amount":          daily_spend,
            "Payee":           "Consistent Vendor",
            "TransactionType": "Debit",
        })
    return pd.DataFrame(rows)


def _make_volatile_df(n_days: int = 30) -> pd.DataFrame:
    """Transactions with very high daily-spend variance (forces wide band)."""
    rng = np.random.default_rng(0)
    today = datetime.today()
    rows = []
    for i in range(n_days):
        # alternate between ₹100 and ₹5000 to maximise volatility
        amount = 5000.0 if i % 2 == 0 else 100.0
        rows.append({
            "Date":            (today - timedelta(days=i)).strftime("%Y-%m-%d"),
            "Amount":          amount,
            "Payee":           "Volatile Vendor",
            "TransactionType": "Debit",
        })
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def trained_consistent():
    """SurvivalEngine trained on consistent ₹500/day spending."""
    df = _make_consistent_df(60, daily_spend=500.0)
    engine = SurvivalEngine()
    engine.train(df, balance=10_000.0, fixed_monthly_expenses=2_000.0, epochs=100)
    return engine


@pytest.fixture(scope="module")
def trained_volatile():
    """SurvivalEngine trained on high-volatility spending."""
    df = _make_volatile_df(30)
    engine = SurvivalEngine()
    engine.train(df, balance=10_000.0, fixed_monthly_expenses=2_000.0, epochs=100)
    return engine


# ── TC-C01 ─────────────────────────────────────────────────────────────────────
def test_tc_c01_math_runway_20_days():
    """Balance ₹10,000, daily spend ₹500 → math prediction within ±2 days of 20."""
    result = predict_mathematical(
        balance=10_000.0,
        daily_spend_rate=500.0,
        transaction_amount=0.0,
        fixed_remaining_this_month=0.0,
    )
    assert abs(result - 20.0) <= 2.0, (
        f"Expected ~20 days, got {result}"
    )


# ── TC-C02 ─────────────────────────────────────────────────────────────────────
def test_tc_c02_high_volatility_wide_band(trained_volatile):
    """High-volatility spending → confidence_band == 'wide'."""
    df = _make_volatile_df(30)
    result = trained_volatile.predict(
        balance=10_000.0,
        transaction_amount=500.0,
        transactions_df=df,
        category="GenericPurchase",
        hour=14,
    )
    assert result["confidence_band"] == "wide", (
        f"Expected 'wide', got '{result['confidence_band']}'. "
        f"Full result: {result}"
    )


# ── TC-C03 ─────────────────────────────────────────────────────────────────────
def test_tc_c03_consistent_spending_narrow_band(trained_consistent):
    """Consistent ₹500/day over 60 days → confidence_band == 'narrow'."""
    df = _make_consistent_df(60, daily_spend=500.0)
    result = trained_consistent.predict(
        balance=10_000.0,
        transaction_amount=500.0,
        transactions_df=df,
        category="EssentialGrocery",
        hour=10,
    )
    assert result["confidence_band"] == "narrow", (
        f"Expected 'narrow', got '{result['confidence_band']}'. "
        f"Full result: {result}"
    )


# ── TC-C04 ─────────────────────────────────────────────────────────────────────
def test_tc_c04_zero_balance_no_negative():
    """Balance = ₹0 → survival_days_after must be 0 (no negatives)."""
    result = predict_mathematical(
        balance=0.0,
        daily_spend_rate=500.0,
        transaction_amount=500.0,
        fixed_remaining_this_month=0.0,
    )
    assert result == 0.0, f"Expected 0.0, got {result}"


# ── TC-C05 ─────────────────────────────────────────────────────────────────────
def test_tc_c05_large_transaction_big_delta():
    """₹8,000 transaction on ₹10,000 balance → survival_delta > 5 days."""
    before = predict_mathematical(
        balance=10_000.0,
        daily_spend_rate=500.0,
        transaction_amount=0.0,
        fixed_remaining_this_month=0.0,
    )
    after = predict_mathematical(
        balance=10_000.0,
        daily_spend_rate=500.0,
        transaction_amount=8_000.0,
        fixed_remaining_this_month=0.0,
    )
    delta = before - after
    assert delta > 5.0, (
        f"Expected delta > 5, got {delta} (before={before}, after={after})"
    )


# ── Additional sanity tests ────────────────────────────────────────────────────

def test_predict_raises_if_not_trained():
    """predict() must raise RuntimeError when model is not trained."""
    engine = SurvivalEngine()
    with pytest.raises(RuntimeError, match="Model not trained"):
        engine.predict(10_000.0, 500.0, pd.DataFrame())


def test_prepare_features_shape():
    """prepare_features returns a (6,) float32 array."""
    df = _make_consistent_df(7)
    feats = prepare_features(10_000.0, 500.0, df, "Utilities", 8)
    assert feats.shape == (6,)
    assert feats.dtype == np.float32


def test_generate_training_data_shapes():
    """generate_training_data returns X(N,6) and y(N,) with y in [0,90]."""
    df = _make_consistent_df(30)
    X, y = generate_training_data(df, balance=10_000.0, fixed_monthly_expenses=2_000.0, n_samples=100)
    assert X.shape == (100, 6)
    assert y.shape == (100,)
    assert y.min() >= 0.0
    assert y.max() <= 90.0


def test_train_returns_metrics(trained_consistent):
    """train() returns a dict with the required metric keys."""
    metrics = SurvivalEngine().train(
        _make_consistent_df(30), balance=10_000.0,
        fixed_monthly_expenses=2_000.0, epochs=10,
    )
    for key in ("val_mse", "val_mae", "epochs_trained", "data_points_used"):
        assert key in metrics, f"Missing key '{key}' in train() result"
    assert metrics["epochs_trained"] == 10
    assert metrics["data_points_used"] >= 500
