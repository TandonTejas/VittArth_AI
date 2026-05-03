"""
api/state/session_store.py
--------------------------
In-memory session store protected by asyncio.Lock.
A single global instance is shared across all routes.
"""

from __future__ import annotations
import asyncio, uuid
from datetime import datetime
from typing import Any
from fastapi import HTTPException


class SessionStore:
    """Thread-safe in-memory session store."""

    def __init__(self) -> None:
        self.sessions: dict[str, dict[str, Any]] = {}
        self.lock      = asyncio.Lock()

    async def create_session(self, onboard_data: dict) -> str:
        session_id = str(uuid.uuid4())
        spendable_balance = max(
            0.0,
            float(onboard_data["monthly_income"]) - float(onboard_data["fixed_expenses"]),
        )
        async with self.lock:
            self.sessions[session_id] = {
                "monthly_income":       onboard_data["monthly_income"],
                "fixed_expenses":       onboard_data["fixed_expenses"],
                "daily_target":         onboard_data["daily_target"],
                "user_profile":         onboard_data.get("user_profile", "Standard"),
                "balance":              spendable_balance,
                "days_until_month_end": onboard_data["days_until_month_end"],
                "ontology_engine":      None,
                "survival_engine":      None,
                "transactions_df":      None,
                "variable_transactions_df": None,
                "variable_daily_spend_rate": None,
                "is_trained":           False,
                "override_counts":      {},
                "risk_tier":            "Safe",
                "pending_transactions": {},
                "commitment_device_until": None,
                "ontology_stats":       {},
                "created_at":           datetime.now(),
            }
        return session_id

    async def get_session(self, session_id: str) -> dict:
        async with self.lock:
            session = self.sessions.get(session_id)
        if session is None:
            raise HTTPException(
                status_code=404,
                detail=f"Session '{session_id}' not found. Please onboard first.",
            )
        return session

    async def update_session(self, session_id: str, **kwargs: Any) -> None:
        async with self.lock:
            if session_id not in self.sessions:
                raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
            self.sessions[session_id].update(kwargs)

    async def delete_session(self, session_id: str) -> None:
        async with self.lock:
            self.sessions.pop(session_id, None)


# Global singleton
store = SessionStore()
