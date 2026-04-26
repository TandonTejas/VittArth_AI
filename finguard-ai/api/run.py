"""
api/run.py
----------
Development server entry point.

Usage (from project root):
    python api/run.py
"""

import pathlib
import sys

# Ensure project root is on sys.path so 'api' and 'modules' are importable
ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(ROOT)],
        log_level="info",
    )
