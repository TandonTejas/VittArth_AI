"""api/routes/transaction.py (hardened)"""
from __future__ import annotations
import html, re, uuid
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, HTTPException
from api.models.schemas import (
    BankMessageIngestResponse,
    BankMessageRequest,
    CategoryCorrectionRequest,
    CategoryCorrectionResponse,
    CategoryOption,
    ConfirmTransactionRequest,
    EvaluationResponse,
    ParsedBankMessage,
    TransactionRequest,
)
from api.state.session_store import store
from modules.decision_coach import evaluate_transaction
from modules.ontology_engine import CATEGORY_META, FALLBACK_CATEGORY, OntologyEngine, canonical_category, category_label, learn_category_mapping
from modules.survival_engine import estimate_variable_daily_spend, predict_mathematical, variable_expense_statement

router = APIRouter()
_CAP = 90.0
_TAG_RE = re.compile(r"<[^>]+>|['\";]")
_CREDIT_RE = re.compile(r"\b(credited|credit|deposited|received|refund(?:ed)?|cashback)\b", re.I)
_DEBIT_RE = re.compile(r"\b(debited|debit|spent|paid|purchase|withdrawn|sent|transferred|dr)\b", re.I)
_BALANCE_RE = re.compile(r"\b(?:avl|available|clear|ledger)?\s*bal(?:ance)?\b", re.I)
_REFERENCE_RE = re.compile(r"\b(?:a/c|acct|account|card|otp|ref|rrn|utr|txn\s*id|transaction\s*id|ending)\b", re.I)
_AMOUNT_NEAR_DEBIT_RE = re.compile(
    r"(?:debited|debit(?:ed)?|spent|paid|purchase(?:d)?|withdrawn|sent|transferred|dr)"
    r"[^₹\d]{0,30}(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
    re.I,
)
_AMOUNT_BEFORE_DEBIT_RE = re.compile(
    r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)"
    r"[^A-Za-z0-9₹]{0,30}(?:debited|debit(?:ed)?|spent|paid|purchase(?:d)?|withdrawn|sent|transferred|dr)",
    re.I,
)
_DEBIT_LINE_AMOUNT_RE = re.compile(
    r"(?:debited|debit(?:ed)?|spent|paid|purchase(?:d)?|withdrawn|sent|transferred|dr)"
    r"[^0-9₹]{0,30}([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:rs\.?|inr)?",
    re.I,
)
_ANY_AMOUNT_RE = re.compile(r"(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)", re.I)
_NUMBER_AMOUNT_RE = re.compile(
    r"(?:(rs\.?|inr|₹)\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)(?:\s*(rs\.?|inr))?",
    re.I,
)
_TIME_RE = re.compile(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*([ap]\.?m\.?))?\b", re.I)
_NOISE_LINE_RE = re.compile(
    r"\b(?:debited|credited|available|avl|bal(?:ance)?|not you|call|dial|otp|a/c|acct|account|card|bank)\b",
    re.I,
)
_PAYEE_TRAILING_RE = re.compile(
    r"\b(?:online order|order|payment|payments|purchase|paid|txn|transaction|pos|mde|upi|p2m)\b",
    re.I,
)
_MERCHANT_PREFIX_RE = re.compile(
    r"^(?:of\s+)?(?:rs\.?|inr|₹)?\s*[0-9,]*(?:\.\d{1,2})?\s*(?:done|made|completed|successful|spent|paid|debited)?\s*(?:at|to|for)?\s*",
    re.I,
)
_DATE_PATTERNS = [
    (re.compile(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"), ("%Y-%m-%d", "%Y/%m/%d")),
    (re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b"), ("%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y")),
    (re.compile(r"\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})\b"), ("%d-%b-%Y", "%d %b %Y", "%d-%b-%y", "%d %b %y", "%d-%B-%Y", "%d %B %Y")),
]

def _sanitize(text: str) -> str:
    text = html.unescape(str(text or ""))
    text = _TAG_RE.sub("", text)
    text = re.sub(r"[\u200b-\u200f\u202a-\u202e]", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()

def _risk_tier(sd: float) -> str:
    return "High Risk" if sd < 7 else ("Medium Risk" if sd < 14 else "Safe")

def _math_surv(balance, amount, daily, fixed):
    b = predict_mathematical(balance, daily, 0.0, 0.0)
    a = predict_mathematical(balance, daily, amount, 0.0)
    return {"survival_days_before": b, "survival_days_after": a,
            "survival_delta": max(0.0, b - a), "confidence_band": "narrow"}

def _parse_amount(message: str) -> float:
    candidates: list[tuple[int, int, str]] = []
    for match in _NUMBER_AMOUNT_RE.finditer(message):
        amount = match.group(2)
        has_currency = bool(match.group(1) or match.group(3))
        start, end = match.span()
        before = message[max(0, start - 55):start]
        after = message[end:end + 55]
        near_before = message[max(0, start - 20):start]
        near_after = message[end:end + 20]
        context = f"{before} {after}"

        if not has_currency and _REFERENCE_RE.search(context) and not _DEBIT_RE.search(context):
            continue

        score = 0
        if has_currency:
            score += 3
        if _DEBIT_RE.search(context):
            score += 5
        if re.search(r"\b(?:txn|transaction|purchase|payment)\s+(?:of|for)\s*(?:rs\.?|inr|₹)?\s*$", before, re.I):
            score += 4
        if re.search(r"\b(?:txn|transaction|purchase|payment)\s+(?:done|made|completed|successful)\b", after, re.I):
            score += 4
        if _BALANCE_RE.search(f"{near_before} {near_after}"):
            score -= 8
        if _REFERENCE_RE.search(context) and not has_currency:
            score -= 3
        if score > 0:
            candidates.append((score, start, amount))

    if not candidates:
        for regex in (_AMOUNT_NEAR_DEBIT_RE, _AMOUNT_BEFORE_DEBIT_RE, _DEBIT_LINE_AMOUNT_RE, _ANY_AMOUNT_RE):
            matches = regex.findall(message)
            if matches:
                return float(str(matches[0]).replace(",", ""))
        raise HTTPException(422, "Could not find a transaction amount in the bank message.")

    candidates.sort(key=lambda item: (-item[0], item[1]))
    return float(candidates[0][2].replace(",", ""))

def _parse_hour(message: str) -> int:
    match = _TIME_RE.search(message)
    if not match:
        return datetime.now().hour
    hour = int(match.group(1))
    suffix = (match.group(3) or "").lower().replace(".", "")
    if suffix == "pm" and hour < 12:
        hour += 12
    if suffix == "am" and hour == 12:
        hour = 0
    return max(0, min(23, hour))

def _parse_date(message: str) -> str:
    for regex, formats in _DATE_PATTERNS:
        match = regex.search(message)
        if not match:
            continue
        raw = match.group(0).replace("/", "-")
        for fmt in formats:
            try:
                return datetime.strptime(raw, fmt.replace("/", "-")).date().isoformat()
            except ValueError:
                continue
    return datetime.now().date().isoformat()

def _clean_payee(value: str) -> str:
    value = _MERCHANT_PREFIX_RE.sub("", value)
    value = re.split(r"\b(?:bal|balance|avl|available|not you|call|dial)\b", value, maxsplit=1, flags=re.I)[0]
    value = re.sub(r"\b(?:upi|ref|rrn|utr|txn|transaction|id|no|number|a/c|acct|account|card|ending|xx+\d*)\b.*$", "", value, flags=re.I)
    value = re.sub(r"\b(?:mde|pos|mid|tid)[-/ ]*[A-Z0-9-]+\b", " ", value, flags=re.I)
    value = re.sub(r"\b[A-Z]*\d+[A-Z0-9-]*\b", " ", value)
    value = re.sub(r"\b(?:on|at)\s+(?:\d{1,2}[-/]\d{1,2}|\d{1,2}[-\s][A-Za-z]{3,9}|\d{4}[-/]\d{1,2}).*$", "", value, flags=re.I)
    value = re.sub(r"\b(?:on|at)\s+\d{1,2}[:.]\d{2}.*$", "", value, flags=re.I)
    value = re.sub(r"[^A-Za-z0-9&@._* -]+", " ", value)
    value = re.sub(r"\b(?:on|at)\s*$", "", value, flags=re.I)
    value = re.sub(r"\s+", " ", value).strip(" .-*_\t")
    return _sanitize(value)[:80] or "Unknown Merchant"

def _add_candidate(candidates: list[str], value: str) -> None:
    payee = _clean_payee(value)
    if len(payee) < 2 or payee.lower() in {"unknown merchant", "au", "hdfc", "icici", "sbi"}:
        return
    if payee not in candidates:
        candidates.append(payee)
    trimmed = _PAYEE_TRAILING_RE.sub(" ", payee)
    trimmed = re.sub(r"\s+", " ", trimmed).strip(" -*_")
    if len(trimmed) >= 2 and trimmed not in candidates:
        candidates.append(trimmed)

def _merchant_candidates(message: str) -> list[str]:
    candidates: list[str] = []
    lines = [line.strip() for line in re.split(r"[\r\n]+", message) if line.strip()]

    for line in lines:
        if _NOISE_LINE_RE.search(line) and not re.search(r"\b(?:mde|pos|upi|p2m|merchant)\b", line, re.I):
            continue
        if "-" in line:
            for part in reversed([p.strip() for p in line.split("-") if p.strip()]):
                if re.search(r"[A-Za-z]{3,}", part):
                    _add_candidate(candidates, part)
                    break
        if re.search(r"\b(?:mde|pos|upi|p2m|merchant)\b", line, re.I):
            descriptor = re.sub(r"\b(?:mde|pos|mid|tid|upi|p2m|merchant)[-/ ]*[A-Z0-9-]*\b", " ", line, flags=re.I)
            _add_candidate(candidates, descriptor)

    patterns = [
        r"\b(?:done|made|completed|successful|spent|paid)?\s*(?:at|to|towards|for|merchant)\s+(.+?)(?=\s+(?:on|at)\s+(?:\d|[A-Za-z]{3})|\s+(?:ref|rrn|utr|txn|transaction|available|avl|balance|bal)\b|$)",
        r"\b(?:vpa|upi)\s*[:/-]\s*(.+?)(?=\s+(?:on|at|ref|rrn|utr|txn|available|avl|balance|bal)\b|$)",
        r"\b(?:info|remarks?)\s*[:/-]\s*(?:upi|pos|p2m|p2a)?[/ -]*(.+?)(?=\s+(?:ref|rrn|utr|txn|available|avl|balance|bal)\b|$)",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, message, flags=re.I):
            _add_candidate(candidates, match.group(1))

    return candidates

def _parse_payee(message: str) -> str:
    candidates = _merchant_candidates(message)
    if candidates:
        return candidates[0]
    compact = re.sub(_ANY_AMOUNT_RE, " ", message)
    compact = re.sub(r"\b(?:debited|debit|spent|paid|purchase|withdrawn|from|your|bank|account|card|rs|inr|available|avl|balance|bal)\b", " ", compact, flags=re.I)
    words = [w for w in re.split(r"\s+", compact) if len(w) > 2 and not any(ch.isdigit() for ch in w)]
    return _clean_payee(" ".join(words[:4]))

def _parse_bank_message(message: str) -> dict:
    clean = _sanitize(message)
    if not clean:
        raise HTTPException(422, "Bank message is empty.")
    if _CREDIT_RE.search(clean) and not _DEBIT_RE.search(clean):
        raise HTTPException(422, "This looks like a credit/deposit message, not a debit transaction.")
    amount = _parse_amount(clean)
    return {
        "amount": amount,
        "payee": _parse_payee(clean),
        "date": _parse_date(clean),
        "hour": _parse_hour(clean),
        "raw_message": clean,
    }

def _survival_for(session: dict, amount: float, category: str, hour: int) -> dict:
    variable_df = session.get("variable_transactions_df")
    if variable_df is None:
        variable_df = variable_expense_statement(session.get("transactions_df"))
    daily_rate = max(session.get("variable_daily_spend_rate") or estimate_variable_daily_spend(variable_df, fallback=session["daily_target"]), 1.0)
    se = session.get("survival_engine")
    df = variable_df
    if se and se.is_trained:
        try:
            return se.predict(
                balance=session["balance"],
                transaction_amount=amount,
                transactions_df=df if df is not None else pd.DataFrame(),
                category=category,
                hour=hour,
            )
        except Exception:
            pass
    return _math_surv(session["balance"], amount, daily_rate, session["fixed_expenses"])

def _classify_best_payee(oe: OntologyEngine, message: str, fallback_payee: str, ts: datetime, amount: float) -> tuple[str, dict]:
    candidates = _merchant_candidates(message) or [fallback_payee]
    best_payee = candidates[0]
    best_result = None
    best_score = -1.0
    for candidate in candidates:
        result = oe.classify_vendor(candidate, ts, amount=amount)
        category = result.get("category", "miscellaneous:uncategorized")
        confidence = float(result.get("confidence", 0.0))
        score = confidence
        if category != "miscellaneous:uncategorized":
            score += 0.35
        if result.get("review_required"):
            score -= 0.05
        if score > best_score:
            best_payee = candidate
            best_result = result
            best_score = score
    return best_payee, best_result or oe.classify_vendor(fallback_payee, ts, amount=amount)


@router.get("/categories", response_model=list[CategoryOption])
async def categories():
    options = []
    for key, meta in CATEGORY_META.items():
        if key == FALLBACK_CATEGORY:
            continue
        label = category_label(key)
        options.append(CategoryOption(
            key=key,
            label=label,
            category_name=str(meta.get("category_name") or key.split(":", 1)[0]).replace("_", " ").title(),
            subcategory_name=str(meta.get("subcategory_name") or label),
            parent=str(meta.get("category_name") or key.split(":", 1)[0]).replace("_", " ").title(),
            is_root=bool(meta.get("is_root", False)),
        ))
    options.sort(key=lambda item: (item.parent.lower(), item.is_root, item.label.lower()))
    return options


@router.post("/correct-category", response_model=CategoryCorrectionResponse)
async def correct_category(req: CategoryCorrectionRequest):
    session = await store.get_session(req.session_id)
    pending = dict(session.get("pending_transactions", {}))
    tx = pending.get(req.transaction_id)
    recorded_row_idx = None
    df = session.get("transactions_df")
    if tx is None and df is not None and not df.empty and "transaction_id" in df.columns:
        matches = df.index[df["transaction_id"].astype(str) == req.transaction_id].tolist()
        if matches:
            recorded_row_idx = matches[-1]
            row = df.loc[recorded_row_idx]
            tx = {
                "transaction_id": req.transaction_id,
                "amount": float(row.get("Amount", 0.0) or 0.0),
                "payee": str(row.get("Payee", "")),
                "date": str(row.get("Date", datetime.now().date().isoformat()))[:10],
                "hour": int(row.get("hour", 12) or 12),
                "category": str(row.get("category", FALLBACK_CATEGORY)),
                "decision": "SPEND",
                "commitment_device": False,
            }
    if tx is None:
        raise HTTPException(404, f"Transaction '{req.transaction_id}' not found.")

    selected = canonical_category(req.category)
    if selected not in CATEGORY_META:
        raise HTTPException(422, f"Unknown category '{req.category}'.")

    payee = _sanitize(req.vendor_name or tx.get("payee") or "")
    mapping_info = (
        learn_category_mapping(payee, selected)
        if payee and selected != tx.get("category")
        else {"updated": False, "mapping_key": "", "aliases": []}
    )

    try:
        ts = datetime.strptime(tx.get("date", ""), "%Y-%m-%d").replace(hour=int(tx.get("hour", 12)))
    except ValueError:
        ts = datetime.now().replace(hour=int(tx.get("hour", 12)))

    oe = session.get("ontology_engine")
    if oe is None:
        oe = OntologyEngine(
            monthly_income=session.get("monthly_income", 50000),
            daily_target_spend=session.get("daily_target"),
        )

    amount = float(tx.get("amount", 0.0))
    hour = max(0, min(23, int(tx.get("hour", 12))))
    ont = oe.classify_as_category(payee or tx.get("payee") or "Unknown", selected, ts, amount=amount)
    surv = _survival_for(session, amount, selected, hour)
    dr = evaluate_transaction(
        balance=session["balance"],
        transaction_amount=amount,
        daily_target=session["daily_target"],
        ontology_result=ont,
        survival_result=surv,
        override_counts=session.get("override_counts", {}),
        days_until_month_end=session["days_until_month_end"],
        hour=hour,
        payee=payee,
    )

    tx.update({
        "category": selected,
        "decision": dr.decision,
        "commitment_device": dr.commitment_device,
    })
    updates = {"ontology_engine": oe}
    if recorded_row_idx is not None:
        df = df.copy()
        df.at[recorded_row_idx, "category"] = selected
        df.at[recorded_row_idx, "category_confidence"] = 1.0
        df.at[recorded_row_idx, "category_review_required"] = False
        updates["transactions_df"] = df
    else:
        pending[req.transaction_id] = tx
        updates["pending_transactions"] = pending
    await store.update_session(req.session_id, **updates)

    return CategoryCorrectionResponse(
        transaction_id=req.transaction_id,
        decision=dr.decision,
        nudge_text=dr.nudge_text,
        opportunity_cost=dr.opportunity_cost,
        survival_before=surv.get("survival_days_before", _CAP),
        survival_after=surv.get("survival_days_after", _CAP),
        survival_delta=surv.get("survival_delta", 0.0),
        commitment_device=dr.commitment_device,
        category=selected,
        regret_probability=ont["regret_probability"],
        confidence_band=surv.get("confidence_band", "narrow"),
        forward_chain=dr.forward_chain,
        mapping_key=mapping_info.get("mapping_key", ""),
        aliases=mapping_info.get("aliases", []),
        updated=bool(mapping_info.get("updated")),
    )

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
            commitment_device=False, category="miscellaneous:uncategorized", regret_probability=0.0,
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
            decision="AVOID",
            nudge_text=(
                f"Transaction blocked. Your current balance is ₹{balance:,.2f} but "
                f"this transaction requires ₹{req.amount:,.2f} — "
                f"you are ₹{shortfall:,.2f} short. "
                f"You cannot make this transaction."
            ),
            opportunity_cost={"meals": "N/A", "work_hours": "N/A", "raw_meals": 0.0, "raw_hours": 0.0},
            survival_before=predict_mathematical(balance, max(target, 1.0), 0.0, 0.0),
            survival_after=0.0,
            survival_delta=0.0,
            commitment_device=False,
            category="miscellaneous:uncategorized",
            regret_probability=0.0,
            confidence_band="narrow",
        )

    try:
        ts = datetime.strptime(req.date, "%Y-%m-%d").replace(hour=hour)
    except ValueError:
        ts = datetime.now().replace(hour=hour)

    ont = oe.classify_vendor(payee, ts, amount=req.amount) if oe else {
        "category":"miscellaneous:uncategorized","regret_probability":0.35,
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
        "date":req.date,"hour":hour,"category":ont["category"],"decision":dr.decision,
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
        confidence_band=surv.get("confidence_band","narrow"),
        forward_chain=dr.forward_chain)

@router.post("/ingest-bank-message", response_model=BankMessageIngestResponse)
async def ingest_bank_message(req: BankMessageRequest):
    session = await store.get_session(req.session_id)
    parsed = _parse_bank_message(req.message)
    amount = parsed["amount"]
    payee = parsed["payee"]
    date = parsed["date"]
    hour = parsed["hour"]
    ts = datetime.strptime(date, "%Y-%m-%d").replace(hour=hour)

    oe = session.get("ontology_engine")
    if oe is None:
        oe = OntologyEngine(
            monthly_income=session.get("monthly_income", 50000),
            daily_target_spend=session.get("daily_target")
        )

    payee, ont = _classify_best_payee(oe, parsed["raw_message"], payee, ts, amount)
    parsed["payee"] = payee
    surv = _survival_for(session, amount, ont["category"], hour)
    dr = evaluate_transaction(
        balance=session["balance"],
        transaction_amount=amount,
        daily_target=session["daily_target"],
        ontology_result=ont,
        survival_result=surv,
        override_counts=session.get("override_counts", {}),
        days_until_month_end=session["days_until_month_end"],
        hour=hour,
        payee=payee,
    )

    tx_id = str(uuid.uuid4())
    new_bal = max(0.0, session["balance"] - amount)
    new_row = pd.DataFrame([{
        "transaction_id": tx_id,
        "Date": date,
        "Amount": amount,
        "Payee": payee,
        "TransactionType": "Debit",
        "category": ont["category"],
        "hour": hour,
        "source": "bank_message",
        "raw_message": parsed["raw_message"],
    }])
    df = session.get("transactions_df")
    df = pd.concat([df, new_row], ignore_index=True) if df is not None and not df.empty else new_row

    oc = dict(session.get("override_counts", {}))
    if dr.decision in ("PAUSE", "AVOID"):
        cat = ont["category"]
        oc[cat] = oc.get(cat, 0) + 1

    variable_df = variable_expense_statement(df)
    daily_rate = max(estimate_variable_daily_spend(variable_df, fallback=session["daily_target"]), 1.0)
    sd = predict_mathematical(new_bal, daily_rate, 0.0, 0.0)
    risk = _risk_tier(sd)
    await store.update_session(
        req.session_id,
        balance=new_bal,
        ontology_engine=oe,
        transactions_df=df,
        variable_transactions_df=variable_df,
        variable_daily_spend_rate=daily_rate,
        override_counts=oc,
        risk_tier=risk,
    )

    return BankMessageIngestResponse(
        transaction_id=tx_id,
        decision=dr.decision,
        nudge_text=f"Recorded from bank message: {dr.nudge_text}",
        opportunity_cost=dr.opportunity_cost,
        survival_before=surv.get("survival_days_before", _CAP),
        survival_after=surv.get("survival_days_after", _CAP),
        survival_delta=surv.get("survival_delta", 0.0),
        commitment_device=dr.commitment_device,
        category=ont["category"],
        regret_probability=ont["regret_probability"],
        confidence_band=surv.get("confidence_band", "narrow"),
        forward_chain=dr.forward_chain,
        parsed=ParsedBankMessage(**parsed),
        status="recorded",
        new_balance=round(new_bal, 2),
        new_risk_tier=risk,
        new_survival_days=round(sd, 2),
    )

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
        "Payee":tx["payee"],"TransactionType":"Debit","category":tx["category"],
        "transaction_id":tx["transaction_id"],"hour":tx.get("hour", 12)}])
    df = session.get("transactions_df")
    df = pd.concat([df, new_row], ignore_index=True) if df is not None and not df.empty else new_row
    oc = dict(session.get("override_counts", {}))
    if tx["decision"] in ("PAUSE","AVOID"):
        cat = tx["category"]; oc[cat] = oc.get(cat, 0) + 1
    variable_df = variable_expense_statement(df)
    daily_rate = max(estimate_variable_daily_spend(variable_df, fallback=session["daily_target"]), 1.0)
    sd = predict_mathematical(new_bal, daily_rate, 0.0, 0.0)
    await store.update_session(req.session_id, balance=new_bal, transactions_df=df,
        variable_transactions_df=variable_df, variable_daily_spend_rate=daily_rate,
        pending_transactions=pending, override_counts=oc, risk_tier=_risk_tier(sd))
    return {"status":"confirmed","new_balance":round(new_bal,2),
            "new_risk_tier":_risk_tier(sd),"new_survival_days":round(sd,2)}
