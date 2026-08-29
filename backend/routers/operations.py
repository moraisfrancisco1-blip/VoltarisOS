"""operations.py — production operational endpoints.

`/api/admin/production-readiness` is an admin-only readiness/config check for
the first physical park onboarding. It reports the true state of each required
component — never a fake healthy. No secrets are returned (only statuses,
booleans and counts).
"""
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import SessionLocal
from backend import models
from backend.security import require_super_admin

router = APIRouter(prefix="/api/admin", tags=["operations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Expected migrations for a production physical-park deployment.
REQUIRED_MIGRATIONS = [
    "add_2fa_fields",
    "add_audit_logs",
    "add_vpp_dispatch_fields",
    "add_stripe_subscription_fields",
    "add_sites_table",
    "add_device_reading_unique",
    "add_site_timezone",
    "add_device_external_id",
]


def _db_connectivity(db: Session):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "type": db.bind.dialect.name}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc)}


def _redis_state():
    run_celery = os.getenv("RUN_CELERY", "0") == "1"
    redis_url = os.getenv("REDIS_URL", "")
    if not run_celery:
        return {"status": "not_configured", "required": False,
                "detail": "RUN_CELERY != 1 — offline detection is NOT running"}
    if not redis_url:
        return {"status": "not_configured", "required": True,
                "detail": "REDIS_URL not set"}
    from backend.cache import cache
    try:
        ok = cache.is_connected
    except Exception:
        ok = False
    if ok:
        return {"status": "healthy", "required": True}
    return {"status": "unavailable", "required": True,
            "detail": "REDIS_URL set but Redis unreachable"}


def _celery_state():
    run_celery = os.getenv("RUN_CELERY", "0") == "1"
    if not run_celery:
        return {"status": "not_configured", "required": False,
                "detail": "RUN_CELERY != 1 — Celery worker/beat not running"}
    from backend.tasks import celery_app
    beat = getattr(celery_app.conf, "beat_schedule", {}) or {}
    offline = "detect-offline-devices" in beat
    workers = []
    try:
        insp = celery_app.control.inspect(timeout=1.5)
        pong = insp.ping()
        if pong:
            workers = list(pong.keys())
    except Exception:
        workers = []
    return {
        "status": "healthy" if workers else "no_workers",
        "required": True,
        "workers": workers,
        "offline_detection_beat": "configured" if offline else "missing",
    }


def _ingest_auth_state():
    gateway_keys = os.getenv("GATEWAY_API_KEYS", "")
    if not gateway_keys:
        return {"status": "not_configured", "required": True,
                "detail": "GATEWAY_API_KEYS not set — gateways cannot ingest"}
    return {"status": "configured", "required": True}


def _migration_state(db: Session):
    try:
        rows = db.execute(text("SELECT name FROM schema_migrations")).fetchall()
        applied = {r[0] for r in rows}
    except Exception:
        return {"status": "unknown", "required": True,
                "detail": "schema_migrations table not present"}
    missing = [m for m in REQUIRED_MIGRATIONS if m not in applied]
    if not missing:
        return {"status": "up_to_date", "required": True, "applied_count": len(applied)}
    return {"status": "pending", "required": True, "missing": missing}


@router.get("/production-readiness")
def production_readiness(_sa: dict = Depends(require_super_admin), db: Session = Depends(get_db)):
    """Production configuration/readiness for the first physical park.

    Distinguishes healthy / degraded / not_configured. No secrets are returned.
    Redis/Celery are reported honestly: when RUN_CELERY != 1 the offline detection
    is NOT operational and the check reflects that instead of a false positive.
    """
    components = {
        "database": _db_connectivity(db),
        "redis": _redis_state(),
        "celery": _celery_state(),
        "ingest_auth": _ingest_auth_state(),
        "migrations": _migration_state(db),
    }

    failures = []
    for name, comp in components.items():
        if comp["status"] not in ("healthy", "configured", "up_to_date"):
            failures.append((name, comp["status"]))
    if components["celery"].get("status") == "no_workers":
        failures.append(("celery", "no_workers"))
    if components["celery"].get("offline_detection_beat") == "missing":
        failures.append(("celery_offline_detection", "missing"))

    statuses = [s for _, s in failures]
    if statuses and "unhealthy" not in statuses and all(s == "not_configured" for s in statuses):
        overall = "not_configured"
    elif statuses:
        overall = "degraded"
    else:
        overall = "healthy"

    return {
        "status": overall,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "run_celery": os.getenv("RUN_CELERY", "0") == "1",
        "components": components,
        "issues": [{"component": n, "status": s} for n, s in failures],
        "timestamp": models.utcnow_naive().isoformat(),
    }
