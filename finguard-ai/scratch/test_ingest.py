import sys
import os
import pandas as pd
import io
import base64

# Add project root to sys.path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from modules.ontology_engine import OntologyEngine
from api.state.session_store import store

async def test_ingest():
    print("Testing ingestion...")
    oe = OntologyEngine()
    
    # Create a dummy session
    sid = await store.create_session({
        "monthly_income": 50000,
        "fixed_expenses": 20000,
        "daily_target": 1000,
        "days_until_month_end": 15,
        "current_balance": 30000
    })
    
    csv_path = os.path.join(ROOT, "data", "student_transactions_apr2026.csv")
    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} missing")
        return

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} transactions.")
    
    stats = oe.load_transactions(df)
    print(f"Ontology stats: {stats}")
    print("INGESTION TEST SUCCESSFUL.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_ingest())
