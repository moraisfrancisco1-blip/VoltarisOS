from dotenv import load_dotenv
load_dotenv()

import os
from datetime import datetime
from optimization.ai_optimizer import optimize_energy
from fastapi import FastAPI

# ─── Sentry Initialization (must be first) ──────────────────────────────────
from backend.config import settings
if settings.SENTRY_ENABLED and settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=os.getenv("ENVIRONMENT", "development"),
        release=os.getenv("RELEASE_VERSION", "voltarisos@1.0.0"),
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=0.1,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            StarletteIntegration(),
            SqlalchemyIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        # Send default PII (user IP, etc.) for debugging
        send_default_pii=True,
        # Ignore common noise errors
        ignore_errors=[
            KeyboardInterrupt,
            ConnectionResetError,
        ],
    )
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
from backend.routers.devices import ingest_router as devices_ingest_router
from backend.routers.vpp import router as vpp_router
from backend.routers.reports import router as reports_router
from backend.routers.alerts_ws import router as alerts_ws_router
from backend.routers.payments import router as payments_router
from backend.routers.twofa import router as twofa_router
from backend.routers.websocket import router as websocket_router
from backend.security import get_current_user, limiter
from fastapi import Depends, Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

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


# ─── Security Headers Middleware ─────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses.
    
    Implements:
    - HSTS (HTTP Strict Transport Security)
    - X-Frame-Options (clickjacking protection)
    - X-Content-Type-Options (MIME sniffing protection)
    - X-XSS-Protection (XSS filter)
    - Referrer-Policy
    - Permissions-Policy
    - Content-Security-Policy (CSP)
    """
    
    async def dispatch(self, request, call_next):
        response: Response = await call_next(request)
        
        # HSTS — force HTTPS for 1 year, include subdomains
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Clickjacking protection
        response.headers["X-Frame-Options"] = "DENY"
        
        # MIME sniffing protection
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions policy (restrict browser features)
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        
        # Content Security Policy (restrict resource loading)
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.stripe.com wss:",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # Remove server header (information disclosure)
        if "server" in response.headers:
            del response.headers["server"]
        
        return response


app.add_middleware(SecurityHeadersMiddleware)

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
# Ingestion accepts either a user JWT or a tenant-scoped gateway key — its own
# dependency (require_ingest_identity) enforces auth per-route, so it is NOT
# wrapped by the global get_current_user dependency.
app.include_router(devices_ingest_router)
app.include_router(prices.router, prefix="/api", dependencies=_auth_dep)
app.include_router(sites.router, prefix="/api", dependencies=_auth_dep)
app.include_router(auth.router, prefix="/api")  # login/register must stay public; /users routes self-protect
app.include_router(vpp_router, dependencies=_auth_dep)
app.include_router(reports_router, dependencies=_auth_dep)
app.include_router(alerts_ws_router)  # websocket does its own token check on connect
app.include_router(payments_router)  # Stripe payments - public endpoints
app.include_router(twofa_router, prefix="/api", dependencies=_auth_dep)  # 2FA endpoints require auth
app.include_router(websocket_router)  # WebSockets handle auth internally via token query param


@app.get("/ai_decision")
def ai_decision(price: float, battery: float, _user: dict = Depends(get_current_user)):
    decision = optimize_energy(price, battery)
    return {"decision": decision}


@app.get("/health")
def health():
    """Basic health check endpoint.
    
    Returns simple status for load balancers and monitoring.
    For detailed health status, use /health/detailed or /ready.
    """
    return {"status": "ok", "message": "VoltarisOS backend running"}


@app.get("/health/detailed")
def health_detailed():
    """Detailed health check endpoint.
    
    Checks:
    - Database connectivity
    - Redis connectivity (if configured)
    - Celery worker status (if configured)
    
    Returns detailed status for each component.
    """
    from backend.database import engine
    from backend.cache import cache
    from sqlalchemy import text
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }
    
    # Check database
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health_status["components"]["database"] = {
            "status": "healthy",
            "type": engine.dialect.name,
        }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e),
        }
        health_status["status"] = "degraded"
    
    # Check Redis
    try:
        from backend.cache import cache
        if hasattr(cache, '_cache') and hasattr(cache._cache, 'is_connected'):
            if cache._cache.is_connected:
                health_status["components"]["redis"] = {
                    "status": "healthy",
                    "type": "redis",
                }
            else:
                health_status["components"]["redis"] = {
                    "status": "unavailable",
                    "type": "in-memory-fallback",
                }
        else:
            health_status["components"]["redis"] = {
                "status": "healthy",
                "type": "in-memory",
            }
    except Exception as e:
        health_status["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e),
        }
        health_status["status"] = "degraded"
    
    # Check Celery workers (optional)
    try:
        from backend.tasks import celery_app
        # Try to ping workers
        inspect = celery_app.control.inspect(timeout=2.0)
        active_workers = inspect.ping()
        if active_workers:
            health_status["components"]["celery"] = {
                "status": "healthy",
                "workers": list(active_workers.keys()),
            }
        else:
            health_status["components"]["celery"] = {
                "status": "no_workers",
                "message": "No active Celery workers detected",
            }
    except Exception as e:
        health_status["components"]["celery"] = {
            "status": "unavailable",
            "message": "Celery not configured or not reachable",
        }
    
    return health_status


@app.get("/ready")
def readiness_check():
    """Readiness check endpoint for Kubernetes/load balancers.
    
    Returns 200 if the application is ready to serve traffic.
    Returns 503 if any critical component is unhealthy.
    """
    from backend.database import engine
    from sqlalchemy import text
    
    # Check database (critical)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        return {
            "status": "not_ready",
            "reason": "database_unavailable",
            "error": str(e),
        }, 503
    
    # All critical checks passed
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat(),
    }


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
