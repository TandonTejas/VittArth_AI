"""
scripts/smoke_test.py
---------------------
Full end-to-end smoke test: starts FastAPI server in subprocess,
runs the full pipeline via HTTP, asserts every step, exits 0/1.

Usage:
    python scripts/smoke_test.py
"""
from __future__ import annotations

import os, sys, time, subprocess, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

BASE       = "http://localhost:8001"      # use 8001 to avoid collision
CSV_PATH   = ROOT / "data" / "sample_transactions.csv"
FAILURES   = []

def check(name: str, resp, expected_status: int = 200, **field_checks):
    ok = True
    if resp.status_code != expected_status:
        FAILURES.append(f"{name}: expected {expected_status}, got {resp.status_code} — {resp.text[:200]}")
        ok = False
    else:
        for field, expected in field_checks.items():
            actual = resp.json().get(field)
            if callable(expected):
                if not expected(actual):
                    FAILURES.append(f"{name}.{field}: check failed (got {actual!r})")
                    ok = False
            elif actual != expected:
                FAILURES.append(f"{name}.{field}: expected {expected!r}, got {actual!r}")
                ok = False
    status = "[OK]" if ok else "[FAIL]"
    print(f"  {status} {name} [{resp.status_code}]")
    return resp.json() if ok else {}


def wait_for_server(url: str, timeout: int = 20) -> bool:
    for _ in range(timeout * 2):
        try:
            r = requests.get(url, timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def main():
    print("=" * 60)
    print("FinGuard AI — Smoke Test")
    print("=" * 60)

    # ── Start server ─────────────────────────────────────────────────────────
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app",
         "--host", "0.0.0.0", "--port", "8001", "--log-level", "warning"],
        cwd=str(ROOT), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    print("\n[1] Starting server on port 8001...")
    if not wait_for_server(f"{BASE}/api/health"):
        print("  [FAIL] Server failed to start in 20s")
        proc.terminate()
        sys.exit(1)
    print("  [OK] Server ready")

    try:
        # -- Health -----------------------------------------------------------
        print("\n[2] Health check")
        check("GET /api/health", requests.get(f"{BASE}/api/health"),
              status="ok", version="1.0.0")

        # -- Onboard ----------------------------------------------------------
        print("\n[3] Onboarding")
        r = requests.post(f"{BASE}/api/onboard", json={
            "monthly_income": 60_000.0, "fixed_expenses": 5_000.0,
            "daily_target": 500.0, "user_profile": "Early-Career",
            "current_balance": 25_000.0, "days_until_month_end": 15
        })
        d = check("POST /api/onboard", r, status="created")
        sid = d.get("session_id", "")
        if not sid:
            print("  [FAIL] No session_id - aborting pipeline")
            return

        # -- CSV Upload -------------------------------------------------------
        print("\n[4] CSV upload")
        with open(CSV_PATH, "rb") as f:
            r = requests.post(f"{BASE}/api/upload-csv",
                data={"session_id": sid},
                files={"file": ("sample_transactions.csv", f, "text/csv")})
        csv_d = check("POST /api/upload-csv", r,
                      total_transactions=lambda v: v > 0)

        # ── Dashboard ────────────────────────────────────────────────────────
        print("\n[5] Dashboard")
        r = requests.get(f"{BASE}/api/dashboard?session_id={sid}")
        dash = check("GET /api/dashboard", r,
                     balance=lambda v: v > 0,
                     risk_tier=lambda v: v in ("Safe","Medium Risk","High Risk"))

        # ── Evaluate ─────────────────────────────────────────────────────────
        print("\n[6] Evaluate transaction")
        r = requests.post(f"{BASE}/api/evaluate", json={
            "session_id": sid, "amount": 650.0,
            "payee": "Zomato", "date": "2025-01-15", "hour": 23
        })
        ev = check("POST /api/evaluate", r,
                   decision=lambda v: v in ("SPEND","PAUSE","AVOID"),
                   transaction_id=lambda v: bool(v))
        tx_id = ev.get("transaction_id", "")

        # ── Confirm (cancel) ──────────────────────────────────────────────────
        print("\n[7] Confirm (cancel)")
        if tx_id:
            r = requests.post(f"{BASE}/api/confirm", json={
                "session_id": sid, "transaction_id": tx_id, "action": "cancel"
            })
            check("POST /api/confirm (cancel)", r, status="cancelled")

        # ── Emergency budget ──────────────────────────────────────────────────
        print("\n[8] Emergency budget")
        r = requests.get(f"{BASE}/api/emergency-budget?session_id={sid}")
        check("GET /api/emergency-budget", r,
              active=lambda v: isinstance(v, bool))

        # ── Invalid session ───────────────────────────────────────────────────
        print("\n[9] Invalid session guard")
        r = requests.get(f"{BASE}/api/dashboard?session_id=bad-session-id")
        check("GET /api/dashboard (invalid sid)", r, expected_status=404)

    finally:
        proc.terminate()
        proc.wait()

    # ── Results ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    if FAILURES:
        print(f"FAILED — {len(FAILURES)} assertion(s):")
        for f in FAILURES:
            print(f"  • {f}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
