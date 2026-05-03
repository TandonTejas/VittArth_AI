"""api/routes/dashboard.py (hardened — handles None df)"""
from __future__ import annotations
from typing import Optional
import pandas as pd
from fastapi import APIRouter
from api.models.schemas import (CategoryBreakdown, CategoryRegretRow,
    DailyPoint, DashboardResponse)
from api.state.session_store import store
from modules.ontology_engine import REGRET_PRIORS
from modules.survival_engine import estimate_variable_daily_spend, predict_mathematical, variable_expense_statement

router = APIRouter()

def _risk(sd): return "High Risk" if sd<7 else ("Medium Risk" if sd<14 else "Safe")

def _recent_rate(df) -> float:
    if df is None or df.empty: return 0.0
    try:
        tmp = variable_expense_statement(df)
        cutoff = pd.Timestamp.today() - pd.Timedelta(days=7)
        recent = tmp[tmp["Date"] >= cutoff]
        daily = recent.groupby(recent["Date"].dt.date)["Amount"].sum()
        if len(daily) < 3:
            return 0.0
        return float(daily.sum() / 7.0)
    except Exception: return 0.0

@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(session_id: str):
    session = await store.get_session(session_id)
    balance  = session["balance"]
    target   = session["daily_target"]
    days_rem = session["days_until_month_end"]
    fixed    = session["fixed_expenses"]
    oc       = session.get("override_counts", {})
    df       = session.get("transactions_df")
    variable_df = session.get("variable_transactions_df")
    if variable_df is None and df is not None:
        variable_df = variable_expense_statement(df)
    csv_up   = df is not None

    daily_rate   = _recent_rate(variable_df) or estimate_variable_daily_spend(variable_df, fallback=max(target, 1.0)) or max(target, 1.0)
    survival     = predict_mathematical(balance, daily_rate, 0.0, 0.0)
    risk_tier    = _risk(survival)
    session["risk_tier"] = risk_tier

    # Category breakdown
    breakdown: list[CategoryBreakdown] = []
    if csv_up:
        try:
            tmp = df.copy()
            tmp["Amount"] = pd.to_numeric(tmp["Amount"], errors="coerce").fillna(0)
            if "TransactionType" in tmp.columns:
                tmp = tmp[tmp["TransactionType"].str.lower()=="debit"]
            col = "category" if "category" in tmp.columns else "Payee"
            grp = tmp.groupby(col)["Amount"].sum()
            tot = float(grp.sum()) or 1.0
            for cat, amt in grp.items():
                breakdown.append(CategoryBreakdown(category=str(cat),
                    amount=round(float(amt),2), percentage=round(float(amt)/tot*100,1),
                    regret_prob=REGRET_PRIORS.get(str(cat),0.35)))
        except Exception: pass

    # Daily spend history
    history: list[DailyPoint] = []
    ma7:     list[DailyPoint] = []
    if csv_up:
        try:
            tmp = variable_expense_statement(variable_df)
            cutoff = pd.Timestamp.today() - pd.Timedelta(days=30)
            recent = tmp[tmp["Date"] >= cutoff]
            # Fall back to all available data if nothing in the last 30 days
            src = recent if not recent.empty else tmp
            daily  = src.groupby(src["Date"].dt.date)["Amount"].sum().sort_index()
            for d, a in daily.items(): history.append(DailyPoint(date=str(d), amount=round(float(a),2)))
            if len(daily)>=2:
                for d, a in daily.rolling(7, min_periods=1).mean().items():
                    ma7.append(DailyPoint(date=str(d), amount=round(float(a),2)))
        except Exception: pass

    # Regret table
    regret_tbl: list[CategoryRegretRow] = []
    if csv_up and "category" in (df.columns if df is not None else []):
        try:
            tmp = df.copy()
            tmp["Amount"] = pd.to_numeric(tmp["Amount"], errors="coerce").fillna(0)
            for cat, g in tmp.groupby("category"):
                regret_tbl.append(CategoryRegretRow(category=str(cat), count=len(g),
                    avg_amount=round(float(g["Amount"].mean()),2),
                    regret_prob=REGRET_PRIORS.get(str(cat),0.35),
                    overrides=oc.get(str(cat),0)))
        except Exception: pass

    return DashboardResponse(
        balance=round(balance,2), survival_days=round(survival,2),
        daily_spend_rate=round(daily_rate,2), risk_tier=risk_tier,
        days_until_month_end=days_rem, category_breakdown=breakdown,
        daily_spend_history=history, moving_average_7d=ma7,
        category_regret_table=regret_tbl,
        confidence_band="narrow" if daily_rate>0 else "wide")
