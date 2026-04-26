"""api/routes/planner.py (hardened — days=0 guard)"""
from __future__ import annotations
from fastapi import APIRouter
from api.models.schemas import BudgetResponse
from api.state.session_store import store
from modules.csp_planner import CSPPlanner, should_activate
from modules.survival_engine import predict_mathematical

router = APIRouter()

@router.get("/emergency-budget", response_model=BudgetResponse)
async def emergency_budget(session_id: str):
    session  = await store.get_session(session_id)
    balance  = session["balance"]
    fixed    = session["fixed_expenses"]
    days_rem = max(1, session["days_until_month_end"])  # guard against 0
    risk     = session["risk_tier"]
    target   = session["daily_target"]
    is_remote= session.get("user_profile","").lower() in ("remote worker","remote")

    sd = predict_mathematical(balance=balance, daily_spend_rate=max(target,1.0),
        transaction_amount=0.0, fixed_remaining_this_month=fixed)

    if not should_activate(sd, risk):
        return BudgetResponse(active=False, survival_days=round(sd,2),
            message=f"Budget planner not required. {sd:.1f} days runway, risk is '{risk}'.")

    planner = CSPPlanner()
    result  = planner.compute_budget(balance=balance, fixed_expenses_remaining=fixed,
        days_until_month_end=days_rem, is_remote_worker=is_remote)

    if result["status"] == "crisis":
        return BudgetResponse(active=True, status="crisis",
            crisis_actions=result.get("actions",[]),
            survival_days=round(sd,2), message=result.get("message","Crisis mode"))

    return BudgetResponse(
        active=True, status="feasible",
        daily_food=result["daily_food"], daily_travel=result["daily_travel"],
        daily_discretionary=result["daily_discretionary"],
        total_daily=result["total_daily"],
        available_daily_budget=result["available_daily_budget"],
        days_remaining=result["days_remaining"],
        projected_survival_days=result["projected_survival_days"],
        survival_days=round(sd,2))
