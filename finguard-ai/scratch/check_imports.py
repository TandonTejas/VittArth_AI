import sys
import os

# Add project root to sys.path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

print(f"Project Root: {ROOT}")

try:
    print("Testing imports...")
    from api.main import app
    print("Main app imported successfully.")
    
    from modules.ontology_engine import OntologyEngine
    print("OntologyEngine imported successfully.")
    
    from modules.survival_engine import SurvivalEngine
    print("SurvivalEngine imported successfully.")
    
    from modules.decision_coach import FinGuardCoach
    print("DecisionCoach imported successfully.")
    
    print("\nALL IMPORTS SUCCESSFUL. NO MISSING DEPENDENCIES.")
except Exception as e:
    print(f"\nIMPORT ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
