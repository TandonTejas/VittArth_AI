"""
tests/test_csp.py
------------------
FinGuard AI — CSPPlanner test suite
TC-D01 through TC-D04
"""

import pytest
from modules.csp_planner import CSPPlanner, build_csp_problem, should_activate


# ── TC-D01 ─────────────────────────────────────────────────────────────────────
def test_tc_d01_feasible_budget():
    """Balance ₹3000, fixed ₹1000, 10 days → feasible, total_daily ~₹200."""
    planner = CSPPlanner()
    result  = planner.compute_budget(
        balance=3_000.0,
        fixed_expenses_remaining=1_000.0,
        days_until_month_end=10,
    )
    # available = 2000, daily_budget = 200
    assert result["status"] == "feasible", f"Expected feasible, got: {result}"

    total = result["total_daily"]
    # Must be between 80% and 100% of ₹200 (i.e. 160–200), step ₹10
    assert 160 <= total <= 210, f"total_daily={total} not in expected range [160, 210]"
    # Food minimum
    assert result["daily_food"] >= 80


# ── TC-D02 ─────────────────────────────────────────────────────────────────────
def test_tc_d02_crisis_shortfall():
    """Balance ₹500, fixed ₹600 → status='crisis', shortfall=100."""
    planner  = CSPPlanner()
    result   = planner.compute_budget(
        balance=500.0,
        fixed_expenses_remaining=600.0,
        days_until_month_end=15,
    )
    assert result["status"] == "crisis", f"Expected crisis, got: {result}"
    assert abs(result["shortfall"] - 100.0) < 0.01, (
        f"Expected shortfall=100, got {result['shortfall']}"
    )
    assert "actions" in result and len(result["actions"]) > 0
    assert "message" in result


# ── TC-D03 ─────────────────────────────────────────────────────────────────────
def test_tc_d03_remote_worker_zero_travel():
    """Remote worker → daily_travel must equal 0."""
    planner = CSPPlanner()
    result  = planner.compute_budget(
        balance=10_000.0,
        fixed_expenses_remaining=1_000.0,
        days_until_month_end=15,
        is_remote_worker=True,
    )
    assert result["status"] == "feasible", f"Expected feasible, got: {result}"
    assert result["daily_travel"] == 0, (
        f"Expected daily_travel=0 for remote worker, got {result['daily_travel']}"
    )


# ── TC-D04 ─────────────────────────────────────────────────────────────────────
def test_tc_d04_activation_gate_safe():
    """Balance ₹50000, risk_tier='Safe', survival > 7 → should_activate is False."""
    # Compute a rough survival days estimate
    planner = CSPPlanner()
    result  = planner.compute_budget(
        balance=50_000.0,
        fixed_expenses_remaining=5_000.0,
        days_until_month_end=30,
    )
    # survival_days should be >> 7
    survival_days = result.get("projected_survival_days", 30.0)
    active = should_activate(survival_days, risk_tier="Safe")
    assert active is False, (
        f"Expected False for Safe tier with {survival_days} survival days"
    )


# ── Additional sanity tests ────────────────────────────────────────────────────

def test_should_activate_high_risk():
    """High Risk tier → always activate regardless of survival days."""
    assert should_activate(30.0, "High Risk") is True


def test_should_activate_low_survival():
    """survival_days < 7 → activate even with non-high-risk tier."""
    assert should_activate(5.0, "Medium Risk") is True


def test_should_activate_borderline():
    """Exactly 7 days, Safe tier → False (threshold is < 7, not <=)."""
    assert should_activate(7.0, "Safe") is False


def test_month_end_reset():
    """month_end_reset produces sensible new_available and daily budget."""
    planner      = CSPPlanner()
    reset_result = planner.month_end_reset(
        current_balance=5_000.0,
        monthly_income=40_000.0,
        fixed_expenses=15_000.0,
    )
    # new_balance = 5000 + 40000 = 45000
    # new_available = 45000 - 15000 = 30000
    assert abs(reset_result["new_balance"]   - 45_000.0) < 0.01
    assert abs(reset_result["new_available"] - 30_000.0) < 0.01
    assert reset_result["estimated_daily_budget"] == pytest.approx(1_000.0, abs=1.0)


def test_crisis_when_daily_below_food_minimum():
    """daily_budget < ₹80 (food minimum) → crisis even with positive available."""
    planner = CSPPlanner()
    # available = 500, days = 10 → daily = 50 < 80
    result = planner.compute_budget(
        balance=1_500.0,
        fixed_expenses_remaining=1_000.0,
        days_until_month_end=10,
    )
    assert result["status"] == "crisis"


def test_build_csp_problem_returns_solution():
    """build_csp_problem with ample budget should produce a valid solution."""
    problem  = build_csp_problem(available_daily_budget=500.0, is_remote_worker=False)
    solution = problem.getSolution()
    assert solution is not None
    total = solution["daily_food"] + solution["daily_travel"] + solution["daily_discretionary"]
    assert total <= 500
    assert total >= 400   # 80% of 500
    assert solution["daily_food"] >= 80
