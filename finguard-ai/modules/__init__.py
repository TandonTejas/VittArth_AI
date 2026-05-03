"""
modules/__init__.py
-------------------
VittArth AI — modules package initializer.
Exposes top-level imports for all four core engines.
"""

from modules.ontology_engine import OntologyEngine
from modules.decision_coach import FinGuardCoach, evaluate_transaction, DecisionResult
from modules.survival_engine import SurvivalEngine

__all__ = [
    "OntologyEngine",
    "FinGuardCoach",
    "evaluate_transaction",
    "DecisionResult",
    "SurvivalEngine",
]
