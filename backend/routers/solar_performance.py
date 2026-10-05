"""GET /api/solar/performance -- daily performance ratio per site (see backend/solar_performance.py).

Read-only and tenant-scoped: the tenant comes from the authenticated user, never from the
query, so a user only ever sees their own sites. SUPER_ADMIN sees every tenant's sites (same
rule as the other routers).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend import models, solar_performance
from backend.database import SessionLocal
from backend.security import get_current_user

router = APIRouter(prefix="/api/solar", tags=["solar"])

DEGRADATION_NOTE = ("Annual degradation (%/year) needs at least 12 months of production data, "
                    "so it is not calculated yet.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/performance")
def solar_performance_overview(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    q = db.query(models.Site)
    if user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.Site.tenant_id == user.get("tenant_id"))
    sites = q.order_by(models.Site.name.asc()).all()
    return {
        "days": days,
        "sites": [solar_performance.compute_site_performance(db, s, days) for s in sites],
        "degradation": {"computable": False, "reason": DEGRADATION_NOTE},
    }
