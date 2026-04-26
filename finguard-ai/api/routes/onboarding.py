"""api/routes/onboarding.py (hardened)"""
from __future__ import annotations
import io, logging, re, base64
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from api.models.schemas import CSVUploadRequest, CSVUploadResponse, ModelTrainingInfo, OnboardRequest, OnboardResponse, ProfileResponse, UpdateProfileRequest
from api.state.session_store import store
from modules.ontology_engine import OntologyEngine
from modules.survival_engine import SurvivalEngine

log = logging.getLogger("finguard")
router = APIRouter()
_REQUIRED_COLS = {"Date", "Amount", "Payee", "TransactionType"}
_ALLOWED_EXTS  = {".csv", ".xlsx", ".xls"}

@router.post("/onboard", response_model=OnboardResponse)
async def onboard(req: OnboardRequest):
    sid = await store.create_session(req.model_dump())
    return OnboardResponse(session_id=sid, status="created",
        message="Session created. Please upload your transaction CSV to continue.")

@router.get("/profile/{session_id}", response_model=ProfileResponse)
async def get_profile(session_id: str):
    session = await store.get_session(session_id)
    return ProfileResponse(
        monthly_income=session.get("monthly_income", 0.0),
        fixed_expenses=session.get("fixed_expenses", 0.0),
        daily_target=session.get("daily_target", 0.0),
        current_balance=session.get("balance", 0.0)
    )

@router.put("/profile")
async def update_profile(req: UpdateProfileRequest):
    session = await store.get_session(req.session_id)
    updates = {}
    if req.monthly_income is not None: updates["monthly_income"] = req.monthly_income
    if req.fixed_expenses is not None: updates["fixed_expenses"] = req.fixed_expenses
    if req.daily_target is not None:   updates["daily_target"] = req.daily_target
    if req.current_balance is not None:updates["balance"] = req.current_balance
    
    if updates:
        await store.update_session(req.session_id, **updates)
    return {"status": "success", "message": "Profile updated"}

@router.post("/upload-csv", response_model=CSVUploadResponse)
async def upload_csv(req: CSVUploadRequest):
    session_id = req.session_id
    session = await store.get_session(session_id)
    # File type guard
    fname  = req.filename or ""
    suffix = ("." + fname.rsplit(".", 1)[-1].lower()) if "." in fname else ""
    if suffix not in _ALLOWED_EXTS:
        raise HTTPException(400, "File must be a CSV or Excel file (.csv, .xlsx, .xls).")
    raw = base64.b64decode(req.file_base64)
    # Parse
    try:
        df = pd.read_excel(io.BytesIO(raw)) if suffix in (".xlsx",".xls") else _read_csv(raw)
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}") from e
    # Column validation
    missing = _REQUIRED_COLS - set(df.columns)
    if missing:
        raise HTTPException(400, f"CSV is missing required column(s): {sorted(missing)}")
    # Amount cleaning
    orig = len(df)
    df["Amount"] = df["Amount"].astype(str).str.replace(r"[₹$,\sRs]", "", regex=True)
    df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce")
    cleaned = int(df["Amount"].isna().sum())
    df["Amount"] = df["Amount"].fillna(0.0)
    if cleaned:
        log.info("upload_csv: cleaned %d/%d unparseable Amount values", cleaned, orig)
    if (df["Amount"] > 0).sum() == 0:
        log.warning("upload_csv: CSV has 0 usable rows — sparse mode")
    # Ontology
    oe    = OntologyEngine()
    stats = oe.load_transactions(df)
    # Survival training
    se = SurvivalEngine()
    metrics: dict = {}
    try:
        metrics = se.train(df, session["balance"], session["fixed_expenses"])
    except Exception as e:
        log.warning("SurvivalEngine training failed: %s", e)
        metrics = {"error": str(e)}
    await store.update_session(session_id, ontology_engine=oe, survival_engine=se,
        transactions_df=df, is_trained=se.is_trained, ontology_stats=stats)
    return CSVUploadResponse(
        session_id=session_id, total_transactions=stats["total_transactions"],
        top_category=stats.get("top_category"), data_quality=stats["data_quality"],
        avg_daily_spend=stats["avg_daily_spend"], categories_found=stats["categories"],
        model_training=ModelTrainingInfo(**{k: metrics.get(k) for k in ModelTrainingInfo.model_fields}))

def _read_csv(raw: bytes) -> "pd.DataFrame":
    try:
        return pd.read_csv(io.BytesIO(raw), encoding="utf-8")
    except UnicodeDecodeError:
        return pd.read_csv(io.BytesIO(raw), encoding="latin-1")
