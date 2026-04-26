"""
api/models/schemas.py
---------------------
All Pydantic request and response models for FinGuard AI API.
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


# ══════════════════════════════════════════════════════════════════════════════
# Request models
# ══════════════════════════════════════════════════════════════════════════════

class OnboardRequest(BaseModel):
    monthly_income:       float = Field(..., gt=0,  description="Monthly take-home income (₹)")
    fixed_expenses:       float = Field(..., ge=0,  description="Fixed monthly expenses (₹)")
    daily_target:         float = Field(..., gt=0,  description="Safe-to-spend per day (₹)")
    user_profile:         str   = Field(default="Standard", description="User profile label")
    current_balance:      float = Field(..., ge=0,  description="Current account balance (₹)")
    days_until_month_end: int   = Field(..., ge=1,  description="Calendar days remaining in month")

    @field_validator("fixed_expenses")
    @classmethod
    def fixed_must_not_exceed_income(cls, v: float, info: Any) -> float:
        income = info.data.get("monthly_income", 0)
        if income and v > income:
            raise ValueError("fixed_expenses cannot exceed monthly_income")
        return v

class UpdateProfileRequest(BaseModel):
    session_id:           str
    monthly_income:       Optional[float] = None
    fixed_expenses:       Optional[float] = None
    daily_target:         Optional[float] = None
    current_balance:      Optional[float] = None

class ProfileResponse(BaseModel):
    monthly_income:       float
    fixed_expenses:       float
    daily_target:         float
    current_balance:      float


class TransactionRequest(BaseModel):
    session_id: str
    amount:     float = Field(..., ge=0, description="Transaction amount (₹)")
    payee:      str   = Field(..., min_length=1)
    date:       str   = Field(..., description="Date string YYYY-MM-DD")
    hour:       int   = Field(default=12, ge=0, le=23)


class ConfirmTransactionRequest(BaseModel):
    session_id:     str
    transaction_id: str
    action:         str = Field(..., pattern="^(proceed|cancel)$")


# ══════════════════════════════════════════════════════════════════════════════
# Response models
# ══════════════════════════════════════════════════════════════════════════════

class OnboardResponse(BaseModel):
    session_id: str
    status:     str
    message:    str

class CSVUploadRequest(BaseModel):
    session_id: str
    filename: str
    file_base64: str

class ModelTrainingInfo(BaseModel):
    val_mse:          Optional[float] = None
    val_mae:          Optional[float] = None
    epochs_trained:   Optional[int]   = None
    data_points_used: Optional[int]   = None


class CSVUploadResponse(BaseModel):
    session_id:         str
    total_transactions: int
    top_category:       Optional[str]
    data_quality:       str
    avg_daily_spend:    float
    categories_found:   list[str]
    model_training:     ModelTrainingInfo


class CategoryBreakdown(BaseModel):
    category:    str
    amount:      float
    percentage:  float
    regret_prob: float


class DailyPoint(BaseModel):
    date:   str
    amount: float


class CategoryRegretRow(BaseModel):
    category:    str
    count:       int
    avg_amount:  float
    regret_prob: float
    overrides:   int


class DashboardResponse(BaseModel):
    balance:              float
    survival_days:        float
    daily_spend_rate:     float
    risk_tier:            str
    days_until_month_end: int
    category_breakdown:   list[CategoryBreakdown]
    daily_spend_history:  list[DailyPoint]
    moving_average_7d:    list[DailyPoint]
    category_regret_table:list[CategoryRegretRow]
    confidence_band:      str


class EvaluationResponse(BaseModel):
    transaction_id:     str
    decision:           str  # SPEND | PAUSE | AVOID | BLOCKED
    nudge_text:         str
    opportunity_cost:   dict
    survival_before:    float
    survival_after:     float
    survival_delta:     float
    commitment_device:  bool
    category:           str
    regret_probability: float
    confidence_band:    str


class BudgetResponse(BaseModel):
    active:                   bool
    status:                   Optional[str]        = None
    daily_food:               Optional[int]        = None
    daily_travel:             Optional[int]        = None
    daily_discretionary:      Optional[int]        = None
    total_daily:              Optional[int]        = None
    available_daily_budget:   Optional[float]      = None
    days_remaining:           Optional[int]        = None
    projected_survival_days:  Optional[float]      = None
    crisis_actions:           list[str]            = []
    survival_days:            Optional[float]      = None
    message:                  Optional[str]        = None
