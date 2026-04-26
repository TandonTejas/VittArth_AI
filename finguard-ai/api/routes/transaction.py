"""api/routes/transaction.py (hardened)"""
from __future__ import annotations
import re, uuid
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, HTTPException
from api.models.schemas import ConfirmTransactionRequest, EvaluationResponse, TransactionRequest
from api.state.session_store import store
from modules.decision_coach import evaluate_transaction
from modules.survival_engine import predict_mathematical

router = APIRouter()
_CAP = 90.0
_TAG_RE = re.compile(r"<[^>]+>|['\";]")

def _sanitize(text: str) -> str:
    return _TAG_RE.sub("", text).strip()

def _risk_tier(sd: float) -> str:
    return "High Risk" if sd < 7 else ("Medium Risk" if sd < 14 else "Safe")

def _math_surv(balance, amount, daily, fixed):
    b = predict_mathematical(balance, daily, 0.0, fixed)
    a = predict_mathematical(balance, daily, amount, fixed)
    return {"survival_days_before": b, "survival_days_after": a,
            "survival_delta": max(0.0, b - a), "confidence_band": "narrow"}

@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(req: TransactionRequest):
    session = await store.get_session(req.session_id)
    if req.amount < 0:
        raise HTTPException(422, "amount must be >= 0")
    if session.get("transactions_df") is None and not session.get("is_trained"):
        raise HTTPException(400, "Please upload your bank statement first before evaluating transactions.")

    # Sanitize & clamp
    payee = _sanitize(req.payee) or "Unknown"
    hour  = max(0, min(23, req.hour))

    if req.amount == 0:
        tx_id = str(uuid.uuid4())
        return EvaluationResponse(transaction_id=tx_id, decision="SPEND",
            nudge_text="Zero-amount transaction. Nothing to evaluate.",
            opportunity_cost={"meals":"0 meals","work_hours":"0 hours of work","raw_meals":0.0,"raw_hours":0.0},
            survival_before=_CAP, survival_after=_CAP, survival_delta=0.0,
            commitment_device=False, category="GenericPurchase", regret_probability=0.0,
            confidence_band="narrow")

    balance  = session["balance"]
    target   = session["daily_target"]
    fixed    = session["fixed_expenses"]
    days     = session["days_until_month_end"]
    overrides= session.get("override_counts", {})
    df       = session.get("transactions_df")
    oe       = session.get("ontology_engine")
    se       = session.get("survival_engine")

    # ── HARD BLOCK: amount exceeds current balance ────────────────────────────
    if req.amount > balance:
        tx_id = str(uuid.uuid4())
        shortfall = round(req.amount - balance, 2)
        return EvaluationResponse(
            transaction_id=tx_id,
            decision="BLOCKED",
            nudge_text=(
                f"Transaction blocked. Your current balance is ₹{balance:,.2f} but "
                f"this transaction requires ₹{req.amount:,.2f} — "
                f"you are ₹{shortfall:,.2f} short. "
                f"You cannot make this transaction."
            ),
            opportunity_cost={"meals": "N/A", "work_hours": "N/A", "raw_meals": 0.0, "raw_hours": 0.0},
            survival_before=predict_mathematical(balance, max(target, 1.0), 0.0, fixed),
            survival_after=0.0,
            survival_delta=0.0,
            commitment_device=False,
            category="GenericPurchase",
            regret_probability=0.0,
            confidence_band="narrow",
        )

    try:
        ts = datetime.strptime(req.date, "%Y-%m-%d").replace(hour=hour)
    except ValueError:
        ts = datetime.now().replace(hour=hour)

    ont = oe.classify_vendor(payee, ts) if oe else {
        "category":"GenericPurchase","regret_probability":0.35,
        "necessity_score":0.50,"impulse_flag":False,"foreign_flag":False,"late_night_flag":False}

    daily_rate = max(target, 1.0)
    if se and se.is_trained:
        try:
            surv = se.predict(balance=balance, transaction_amount=req.amount,
                transactions_df=df if df is not None else pd.DataFrame(),
                category=ont["category"], hour=hour)
        except Exception:
            surv = _math_surv(balance, req.amount, daily_rate, fixed)
    else:
        surv = _math_surv(balance, req.amount, daily_rate, fixed)

    dr = evaluate_transaction(balance=balance, transaction_amount=req.amount,
        daily_target=target, ontology_result=ont, survival_result=surv,
        override_counts=overrides, days_until_month_end=days, hour=hour, payee=payee)

    tx_id = str(uuid.uuid4())
    pending = dict(session.get("pending_transactions", {}))
    pending[tx_id] = {"transaction_id":tx_id,"amount":req.amount,"payee":payee,
        "date":req.date,"category":ont["category"],"decision":dr.decision,
        "commitment_device":dr.commitment_device}
    await store.update_session(req.session_id, pending_transactions=pending)

    return EvaluationResponse(
        transaction_id=tx_id, decision=dr.decision, nudge_text=dr.nudge_text,
        opportunity_cost=dr.opportunity_cost,
        survival_before=surv.get("survival_days_before", _CAP),
        survival_after=surv.get("survival_days_after", _CAP),
        survival_delta=surv.get("survival_delta", 0.0),
        commitment_device=dr.commitment_device, category=ont["category"],
        regret_probability=ont["regret_probability"],
        confidence_band=surv.get("confidence_band","narrow"))

@router.post("/confirm")
async def confirm(req: ConfirmTransactionRequest):
    session = await store.get_session(req.session_id)
    pending = dict(session.get("pending_transactions", {}))
    tx = pending.pop(req.transaction_id, None)
    if tx is None:
        raise HTTPException(404, f"Transaction '{req.transaction_id}' not found.")
    if req.action == "cancel":
        await store.update_session(req.session_id, pending_transactions=pending)
        return {"status": "cancelled"}
    # proceed
    new_bal = max(0.0, session["balance"] - tx["amount"])
    new_row = pd.DataFrame([{"Date":tx["date"],"Amount":tx["amount"],
        "Payee":tx["payee"],"TransactionType":"Debit","category":tx["category"]}])
    df = session.get("transactions_df")
    df = pd.concat([df, new_row], ignore_index=True) if df is not None and not df.empty else new_row
    oc = dict(session.get("override_counts", {}))
    if tx["decision"] in ("PAUSE","AVOID"):
        cat = tx["category"]; oc[cat] = oc.get(cat, 0) + 1
    sd = predict_mathematical(new_bal, max(session["daily_target"], 1.0), 0.0, session["fixed_expenses"])
    await store.update_session(req.session_id, balance=new_bal, transactions_df=df,
        pending_transactions=pending, override_counts=oc, risk_tier=_risk_tier(sd))
    return {"status":"confirmed","new_balance":round(new_bal,2),
            "new_risk_tier":_risk_tier(sd),"new_survival_days":round(sd,2)}
