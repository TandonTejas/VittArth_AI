"""
api/main.py (hardened)
- CORS: + http://127.0.0.1:5173
- X-Content-Type-Options middleware
- Session expiry (2h), cleanup every 30 min
- Serve built React frontend from /
"""
from __future__ import annotations
import asyncio, logging, os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from api.routes import dashboard, health, onboarding, planner, transaction
from api.state.session_store import store

log = logging.getLogger("finguard")

# ── Session expiry background task ────────────────────────────────────────────

async def _expire_sessions():
    while True:
        await asyncio.sleep(30 * 60)  # run every 30 minutes
        cutoff = datetime.now() - timedelta(hours=2)
        async with store.lock:
            expired = [
                k for k, v in store.sessions.items()
                if v.get("created_at", datetime.now()) < cutoff
            ]
            for k in expired:
                del store.sessions[k]
        if expired:
            log.info("Session cleanup: removed %d expired sessions", len(expired))

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO)
    log.info("FinGuard AI API started")
    task = asyncio.create_task(_expire_sessions())
    yield
    task.cancel()

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="FinGuard AI API", version="1.0.0",
    description="Emotional Interceptor for personal finance decisions",
    lifespan=lifespan)

# ── Security headers middleware ────────────────────────────────────────────────

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"]        = "DENY"
    return response

# ── CORS ───────────────────────────────────────────────────────────────────────

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Global exception handler ───────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled exception on %s", request.url)
    return JSONResponse(status_code=500,
        content={"error": "Internal server error", "detail": str(exc)})

# ── API Routers ────────────────────────────────────────────────────────────────

app.include_router(health.router,      prefix="/api")
app.include_router(onboarding.router,  prefix="/api")
app.include_router(dashboard.router,   prefix="/api")
app.include_router(transaction.router, prefix="/api")
app.include_router(planner.router,     prefix="/api")

# ── Serve built React frontend ─────────────────────────────────────────────────

_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
