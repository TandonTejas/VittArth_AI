"""
modules/csp_planner.py
----------------------
FinGuard AI — Emergency Budget Planner (CSP)

Uses python-constraint (backtracking solver) to find a feasible daily budget
allocation across food, travel, and discretionary spending given hard financial
constraints.
"""

from __future__ import annotations

from typing import Optional

try:
    from constraint import Problem, AllDifferentConstraint  # noqa: F401
    _CSP_AVAILABLE = True
except ImportError:
    _CSP_AVAILABLE = False
    Problem = None  # type: ignore

# ══════════════════════════════════════════════════════════════════════════════
# 1. CSP problem builder
# ══════════════════════════════════════════════════════════════════════════════

def build_csp_problem(
    available_daily_budget: float,
    is_remote_worker: bool = False,
) -> "Problem":  # type: ignore[name-defined]
    """
    Build and return a constraint.Problem for daily budget allocation.

    Variables
    ---------
    daily_food          : ₹ spent on food per day
    daily_travel        : ₹ spent on travel per day
    daily_discretionary : ₹ spent on everything else

    Domains
    -------
    Step size ₹10, from ₹0 up to min(₹1000, available_daily_budget).
    If is_remote_worker, daily_travel domain is locked to [0].

    Hard constraints
    ----------------
    food + travel + discretionary <= available_daily_budget
    food + travel + discretionary >= available_daily_budget * 0.80
    food >= 80
    """
    if not _CSP_AVAILABLE:
        raise ImportError(
            "python-constraint is not installed. "
            "Run: pip install python-constraint"
        )

    budget_int  = int(available_daily_budget)
    step        = 10
    # Cap domain at budget to prune search space (values above budget are
    # trivially eliminated by the sum constraint anyway)
    max_single  = min(1000, budget_int + step)
    domain      = list(range(0, max_single + 1, step))
    # Ensure domain is non-empty
    if not domain:
        domain = [0]

    problem = Problem()
    problem.addVariable("daily_food",          domain)
    problem.addVariable("daily_travel",        [0] if is_remote_worker else domain)
    problem.addVariable("daily_discretionary", domain)

    # Sum <= budget
    problem.addConstraint(
        lambda f, t, d: f + t + d <= budget_int,
        ("daily_food", "daily_travel", "daily_discretionary"),
    )
    # Sum >= 80% of budget
    lower = int(available_daily_budget * 0.80)
    problem.addConstraint(
        lambda f, t, d: f + t + d >= lower,
        ("daily_food", "daily_travel", "daily_discretionary"),
    )
    # Physiological food minimum
    problem.addConstraint(lambda f: f >= 80, ("daily_food",))

    return problem


# ══════════════════════════════════════════════════════════════════════════════
# 2. CSPPlanner class
# ══════════════════════════════════════════════════════════════════════════════

class CSPPlanner:
    """Emergency budget planner backed by a CSP solver."""

    def __init__(self) -> None:
        self._last_solution: Optional[dict] = None

    # ── compute_budget ─────────────────────────────────────────────────────────

    def compute_budget(
        self,
        balance: float,
        fixed_expenses_remaining: float,
        days_until_month_end: int,
        is_remote_worker: bool = False,
    ) -> dict:
        """
        Compute a feasible daily budget allocation via CSP.

        Parameters
        ----------
        balance                  : current account balance (₹)
        fixed_expenses_remaining : committed outflows still due this month (₹)
        days_until_month_end     : calendar days left (minimum 1)
        is_remote_worker         : if True, forces daily_travel = 0

        Returns
        -------
        dict with status "feasible" | "crisis"
        """
        available = balance - fixed_expenses_remaining

        # Immediate crisis: negative or zero available funds
        if available <= 0:
            return self.get_crisis_escalation_plan(balance, fixed_expenses_remaining)

        days = max(1, days_until_month_end)
        daily_budget = available / days

        # Crisis: can't even meet the food physiological minimum
        if daily_budget < 80:
            return self.get_crisis_escalation_plan(balance, fixed_expenses_remaining)

        # Build and solve CSP
        problem  = build_csp_problem(daily_budget, is_remote_worker)
        solution = problem.getSolution()

        if solution is None:
            return self.get_crisis_escalation_plan(balance, fixed_expenses_remaining)

        food          = int(solution["daily_food"])
        travel        = int(solution["daily_travel"])
        discretionary = int(solution["daily_discretionary"])
        total_daily   = food + travel + discretionary
        projected     = round(available / total_daily, 1) if total_daily > 0 else float(days)

        result = {
            "status":               "feasible",
            "daily_food":           food,
            "daily_travel":         travel,
            "daily_discretionary":  discretionary,
            "total_daily":          total_daily,
            "available_daily_budget": round(daily_budget, 2),
            "days_remaining":       days,
            "projected_survival_days": projected,
        }
        self._last_solution = result
        return result

    # ── get_crisis_escalation_plan ─────────────────────────────────────────────

    def get_crisis_escalation_plan(
        self,
        balance: float,
        fixed_remaining: float,
    ) -> dict:
        """Return a structured crisis-mode action plan."""
        shortfall = round(max(0.0, fixed_remaining - balance), 2)
        return {
            "status":   "crisis",
            "message":  "No feasible budget exists. Immediate action required.",
            "actions": [
                "Contact family or trusted contacts for emergency support",
                "Freeze all non-essential subscriptions immediately",
                "List assets that can be liquidated (electronics, books, clothes)",
                "Explore emergency gig opportunities (Swiggy delivery, Dunzo partner)",
                "Contact your bank about overdraft protection or personal loan",
                "Review government schemes: PM-JAY, PMGKAY, or state emergency funds",
            ],
            "shortfall": shortfall,
        }

    # ── month_end_reset ────────────────────────────────────────────────────────

    def month_end_reset(
        self,
        current_balance: float,
        monthly_income: float,
        fixed_expenses: float,
    ) -> dict:
        """
        Compute a fresh baseline at the start of a new month.

        Returns
        -------
        dict : new_available, new_balance, estimated_daily_budget,
               estimated_survival_days
        """
        new_balance   = current_balance + monthly_income
        new_available = max(0.0, new_balance - fixed_expenses)
        est_daily     = round(new_available / 30, 2)
        est_survival  = round(new_available / max(est_daily, 1), 1) if est_daily > 0 else 30.0

        return {
            "new_balance":           round(new_balance,   2),
            "new_available":         round(new_available, 2),
            "estimated_daily_budget": est_daily,
            "estimated_survival_days": est_survival,
        }


# ══════════════════════════════════════════════════════════════════════════════
# 3. Activation gate
# ══════════════════════════════════════════════════════════════════════════════

def should_activate(survival_days: float, risk_tier: str) -> bool:
    """
    Decide whether the Emergency Budget Planner UI should be shown.

    Returns True if:
      - risk_tier == "High Risk", OR
      - survival_days < 7
    """
    return risk_tier == "High Risk" or survival_days < 7
