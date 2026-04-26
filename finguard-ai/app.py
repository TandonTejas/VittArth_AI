"""
app.py
------
FinGuard AI — Streamlit entry point.

Initialises all four core engines and renders the main dashboard.
Run with:
    streamlit run app.py
"""

import sys
import streamlit as st

# ── Startup confirmation ───────────────────────────────────────────────────────
print("FinGuard AI — initializing")

# ── Module imports ─────────────────────────────────────────────────────────────
from modules.ontology_engine import OntologyEngine   # noqa: E402
from modules.decision_coach import DecisionCoach     # noqa: E402
from modules.survival_engine import SurvivalEngine   # noqa: E402
from modules.csp_planner import CSPPlanner           # noqa: E402

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="FinGuard AI",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Header ─────────────────────────────────────────────────────────────────────
st.title("FinGuard AI")
st.write("Setup complete.")

st.markdown(
    """
    Welcome to **FinGuard AI** — your intelligent personal finance guardian.

    | Module | Status |
    |---|---|
    | 🧠 Ontology Engine | ✅ Imported |
    | 🎯 Decision Coach | ✅ Imported |
    | 📊 Survival Engine | ✅ Imported |
    | 🗓️ CSP Planner | ✅ Imported |
    """,
    unsafe_allow_html=False,
)

# ── Quick smoke-test: instantiate each engine ──────────────────────────────────
with st.expander("Engine Diagnostics", expanded=False):
    ontology = OntologyEngine()
    coach = DecisionCoach()
    survival = SurvivalEngine()
    planner = CSPPlanner(monthly_income=50_000)

    st.success("All four engines instantiated successfully.")
    st.json({
        "OntologyEngine.ontology_path": ontology.ontology_path,
        "DecisionCoach.recommendations": coach.recommendations,
        "SurvivalEngine.model": str(survival.model),
        "CSPPlanner.monthly_income": planner.monthly_income,
    })

# ── Python / Streamlit info ────────────────────────────────────────────────────
st.sidebar.header("System Info")
st.sidebar.write(f"Python {sys.version.split()[0]}")
st.sidebar.write(f"Streamlit {st.__version__}")
