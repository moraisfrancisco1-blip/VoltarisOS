from dotenv import load_dotenv
load_dotenv()

from optimization.ai_optimizer import optimize_energy
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import engine
from backend import models
from backend.routers.trading_api import router as trading_router
from backend.routers import prices
from backend.routers.optimization_api import router as optimization_router
from simulation.building_simulation import run_simulation
from backend.routers import sites
from backend.routers import auth
from backend.routers.forecast import router as forecast_router
from backend.routers.copilot import router as copilot_router
from backend.routers.trading_agent import router as trading_agent_router
from backend.routers.carbon import router as carbon_router
from backend.routers.maintenance import router as maintenance_router
from backend.routers.devices import router as devices_router
from backend.routers.vpp import router as vpp_router
from backend.routers.reports import router as reports_router
from backend.routers.alerts_ws import router as alerts_ws_router
from backend.routers.payments import router as payments_router
from backend.security import get_current_user, limiter
from fastapi import Depends, Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os

models.Base.metadata.create_all(bind=engine)

# Lightweight migration: add columns introduced after the table already existed
# in production. create_all() only creates missing tables, never alters existing
# ones, so new nullable columns need an explicit ALTER TABLE (safe/idempotent,
# works on both SQLite and Postgres).
def _migrate_add_missing_columns():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("users")}
    if "terms_accepted_at" not in existing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP"))

_migrate_add_missing_columns()

app = FastAPI()

# Rate limiting — protects /api/auth/login and /api/auth/register from brute-force/spam
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed origins — production Railway domain + local dev. No wildcard with credentials.
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get(
        "CORS_ORIGINS",
        "https://voltarisos-production.up.railway.app,http://localhost:5173,http://localhost:3000"
    ).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All data/business routers require a valid JWT — only /health, /api/auth/login and
# /api/auth/register (defined inside auth.router without this dependency) stay public.
_auth_dep = [Depends(get_current_user)]

app.include_router(optimization_router, dependencies=_auth_dep)
app.include_router(trading_router, dependencies=_auth_dep)
app.include_router(forecast_router, dependencies=_auth_dep)
app.include_router(copilot_router, dependencies=_auth_dep)
app.include_router(trading_agent_router, dependencies=_auth_dep)
app.include_router(carbon_router, dependencies=_auth_dep)
app.include_router(maintenance_router, dependencies=_auth_dep)
app.include_router(devices_router, dependencies=_auth_dep)
app.include_router(prices.router, prefix="/api", dependencies=_auth_dep)
app.include_router(sites.router, prefix="/api", dependencies=_auth_dep)
app.include_router(auth.router, prefix="/api")  # login/register must stay public; /users routes self-protect
app.include_router(vpp_router, dependencies=_auth_dep)
app.include_router(reports_router, dependencies=_auth_dep)
app.include_router(alerts_ws_router)  # websocket does its own token check on connect
app.include_router(payments_router)  # Stripe payments - public endpoints


@app.get("/ai_decision")
def ai_decision(price: float, battery: float, _user: dict = Depends(get_current_user)):
    decision = optimize_energy(price, battery)
    return {"decision": decision}


@app.get("/health")
def health():
    return {"status": "ok", "message": "VoltarisOS backend running"}


# Serve React frontend — must be LAST
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}")
    def catch_all(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def home():
        return {"message": "VoltarisOS backend running (no frontend build found)"}


@app.get("/simulation")
def simulation(_user: dict = Depends(get_current_user)):
    result = run_simulation()
    return {
        "solar": result["solar"],
        "load": result["load"],
        "grid": result["grid"],
        "battery": result["battery_soc"],
        "timeseries": result["timeseries"],
    }
