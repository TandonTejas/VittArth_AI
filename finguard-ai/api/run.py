"""
api/run.py
----------
Development server entry point.

Usage (from project root):
    python api/run.py
"""

import pathlib
import sys
import os

# Ensure project root is on sys.path so 'api' and 'modules' are importable
ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn

if __name__ == "__main__":
    host = os.getenv("FG_API_HOST", "127.0.0.1")
    port = int(os.getenv("FG_API_PORT", "8001"))
    reload_enabled = os.getenv("FG_API_RELOAD", "false").lower() in {"1", "true", "yes"}

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=reload_enabled,
        reload_dirs=[str(ROOT)] if reload_enabled else None,
        log_level="info",
    )
