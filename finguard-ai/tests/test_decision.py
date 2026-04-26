"""
tests/test_decision.py
-----------------------
FinGuard AI — DecisionCoach test suite
TC-B01 through TC-B07
"""

import pytest
from modules.decision_coach import (
    DecisionResult,
    apply_override_softening,
    compute_opportunity_cost,
    evaluate_transaction,
    generate_nudge,
)

# ── Shared helpers ─────────────────────────────────────────────────────────────

def _ontology(
    category="GenericPurchase",
    regret=0.35,
    impulse=False,
    foreign=False,
    necessity=0.50,
):
    return {
        "category":           category,
        "regret_probability": regret,
        "impulse_flag":       impulse,
        "foreign_flag":       foreign,
        "necessity_score":    necessity,
    }


def _survival(before=30.0, after=25.0, delta=5.0):
    return {
        "survival_days_before": before,
        "survival_days_after":  after,
        "survival_delta":       delta,
    }


# ── TC-B01: Insufficient funds → AVOID ────────────────────────────────────────
def test_tc_b01_insufficient_funds():
    """Amount > balance must fire Rule 1 → AVOID 'Insufficient funds'."""
    result = evaluate_transaction(
        balance=500.0,
        transaction_amount=1_000.0,
        daily_target=400.0,
        ontology_result=_ontology(),
        survival_result=_survival(before=10, after=9, delta=1),
        override_counts={},
        days_until_month_end=15,
        hour=14,
    )
    assert result.decision == "AVOID"
    assert "insufficient" in result.reason.lower() or "funds" in result.reason.lower()


# ── TC-B02: Late-night impulse → PAUSE + commitment device ────────────────────
def test_tc_b02_late_night_impulse():
    """Impulse category at 23:00 → PAUSE with commitment_device True."""
    result = evaluate_transaction(
        balance=20_000.0,
        transaction_amount=800.0,
        daily_target=1_000.0,
        ontology_result=_ontology(category="ImpulseClothing", regret=0.65, impulse=True),
        survival_result=_survival(before=25, after=24, delta=1),
        override_counts={},
        days_until_month_end=15,
        hour=23,
    )
    assert result.decision == "PAUSE"
    assert result.commitment_device is True


# ── TC-B03: Critical runway + high regret → AVOID ─────────────────────────────
def test_tc_b03_critical_runway():
    """survival_days_after < 3 AND regret > 0.50 → AVOID."""
    result = evaluate_transaction(
        balance=5_000.0,
        transaction_amount=800.0,
        daily_target=500.0,
        ontology_result=_ontology(category="LateNightCraving", regret=0.72, impulse=True),
        survival_result=_survival(before=4, after=2, delta=2),
        override_counts={},
        days_until_month_end=10,
        hour=14,
    )
    assert result.decision == "AVOID"


# ── TC-B04: Healthy finances → SPEND ─────────────────────────────────────────
def test_tc_b04_healthy_spend():
    """survival_days > 20 AND low regret → SPEND."""
    result = evaluate_transaction(
        balance=50_000.0,
        transaction_amount=300.0,
        daily_target=1_500.0,
        ontology_result=_ontology(category="EssentialGrocery", regret=0.08, impulse=False),
        survival_result=_survival(before=40, after=39, delta=1),
        override_counts={},
        days_until_month_end=20,
        hour=11,
    )
    assert result.decision == "SPEND"


# ── TC-B05: Override softening ────────────────────────────────────────────────
def test_tc_b05_override_softening():
    """3 overrides reduce regret by 10% (0.9^3 = 0.729), floor = 0.70 × original."""
    original = 0.65
    # 3 overrides → factor = 0.9^3 = 0.729
    softened = apply_override_softening("ImpulseClothing", {"ImpulseClothing": 3}, original)
    expected = original * (0.90 ** 3)
    assert abs(softened - expected) < 0.001

    # Floor: never below 0.70 × original
    softened_floored = apply_override_softening(
        "ImpulseClothing", {"ImpulseClothing": 10}, original
    )
    assert softened_floored >= original * 0.70 - 1e-6


# ── TC-B06: Foreign transaction → PAUSE ──────────────────────────────────────
def test_tc_b06_foreign_transaction():
    """foreign_flag True must trigger 'Foreign transaction' PAUSE.
    Amount kept below daily_target * 1.5 so Rule 5 does not fire first."""
    result = evaluate_transaction(
        balance=20_000.0,
        transaction_amount=500.0,       # well below daily_target * 1.5 = 750
        daily_target=500.0,
        ontology_result=_ontology(category="GenericPurchase", foreign=True),
        survival_result=_survival(before=30, after=29, delta=1),
        override_counts={},
        days_until_month_end=15,
        hour=14,
    )
    assert result.decision == "PAUSE"
    assert "foreign" in result.reason.lower()


# ── TC-B07: Opportunity cost values ──────────────────────────────────────────
def test_tc_b07_opportunity_cost():
    """₹1200 → 10 meals (1200/120) and 8.0 hours (1200/150)."""
    opp = compute_opportunity_cost(1_200.0)
    assert opp["raw_meals"]  == pytest.approx(10.0, abs=0.1)
    assert opp["raw_hours"]  == pytest.approx(8.0,  abs=0.1)
    assert "meals" in opp["meals"]
    assert "hours" in opp["work_hours"]


# ── Additional sanity tests ────────────────────────────────────────────────────

def test_decision_result_is_dataclass():
    result = evaluate_transaction(
        balance=10_000.0, transaction_amount=200.0, daily_target=500.0,
        ontology_result=_ontology(), survival_result=_survival(),
        override_counts={}, days_until_month_end=15, hour=12,
    )
    assert isinstance(result, DecisionResult)
    assert result.decision in ("SPEND", "PAUSE", "AVOID")
    assert result.confidence in ("high", "medium", "low")
    assert isinstance(result.opportunity_cost, dict)


def test_distress_keyword_triggers_empathy():
    nudge = generate_nudge(
        decision="PAUSE", category="GenericPurchase", survival_delta=2.0,
        regret_probability=0.40, opportunity_cost=compute_opportunity_cost(500),
        commitment_device=False, payee="can't afford this",
    )
    assert "tough" in nudge.lower() or "options" in nudge.lower()


def test_late_night_craving_commitment_device():
    """LateNightCraving at 01:00 with short runway → commitment_device True."""
    result = evaluate_transaction(
        balance=10_000.0, transaction_amount=400.0, daily_target=1_000.0,
        ontology_result=_ontology(category="LateNightCraving", regret=0.72, impulse=True),
        survival_result=_survival(before=6, after=5, delta=1),
        override_counts={}, days_until_month_end=10, hour=1,
    )
    assert result.commitment_device is True
