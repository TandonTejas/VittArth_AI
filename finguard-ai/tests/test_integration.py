"""
tests/test_integration.py
--------------------------
Integration tests — verify that all four engines can be imported together
and that the sample CSV loads correctly with expected shape and columns.
"""

import pytest
import pandas as pd
from pathlib import Path

from modules.ontology_engine import OntologyEngine
from modules.decision_coach import FinGuardCoach, evaluate_transaction, DecisionResult
from modules.survival_engine import SurvivalEngine
from modules.csp_planner import CSPPlanner

CSV_PATH = Path(__file__).parent.parent / "data" / "sample_transactions.csv"
REQUIRED_COLUMNS = {"Date", "Amount", "Payee", "TransactionType"}


# ── Import smoke tests ─────────────────────────────────────────────────────────

def test_all_modules_import():
    """All four engines can be imported without raising."""
    assert OntologyEngine is not None
    assert FinGuardCoach is not None
    assert SurvivalEngine is not None
    assert CSPPlanner is not None


def test_all_engines_instantiate():
    """All four engines instantiate without error."""
    oe = OntologyEngine()
    dc = FinGuardCoach()
    se = SurvivalEngine()
    cp = CSPPlanner()

    assert oe is not None
    assert dc is not None
    assert se is not None
    assert cp is not None


# ── Data tests ─────────────────────────────────────────────────────────────────

def test_sample_csv_exists():
    assert CSV_PATH.exists(), f"CSV not found at {CSV_PATH}"


def test_sample_csv_has_required_columns():
    df = pd.read_csv(CSV_PATH)
    missing = REQUIRED_COLUMNS - set(df.columns)
    assert not missing, f"Missing columns: {missing}"


def test_sample_csv_has_sufficient_rows():
    df = pd.read_csv(CSV_PATH)
    assert len(df) >= 60, f"Expected ≥60 rows, got {len(df)}"


def test_sample_csv_transaction_types():
    df = pd.read_csv(CSV_PATH)
    types = set(df["TransactionType"].unique())
    assert "Debit" in types
    assert "Credit" in types


def test_sample_csv_amounts_in_range():
    df = pd.read_csv(CSV_PATH)
    assert df["Amount"].min() >= 50
    assert df["Amount"].max() <= 10_000
