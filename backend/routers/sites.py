"""
sites.py — Site management with plan-based limit enforcement.

POST /sites validates that the user's active plan has enough site slots
before allowing creation of a new installation (solar/battery/site).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user, require_super_admin
from backend.permissions import get_tenant_plan, get_max_sites_for_plan

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Site(BaseModel):
    name: str
    location: str
    lat: float
    lng: float
    timezone: Optional[str] = None   # IANA timezone, e.g. "Europe/Lisbon"
    solar_kw: float
    battery_kwh: float
    ev_chargers: int
    owner: str
    status: str = "active"

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v):
        if v is None or v == "":
            return v
        try:
            from zoneinfo import ZoneInfo
            ZoneInfo(v)
        except Exception:
            raise ValueError(f"Invalid IANA timezone: {v!r}")
        return v


class SiteOut(Site):
    id: int
    tenant_id: int
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


def _effective_tenant(user: dict):
    """Return a tenant filter value for `user`, or None for SUPER_ADMIN bypass."""
    if user.get("role") == "SUPER_ADMIN":
        return None
    return user.get("tenant_id")


def _get_owned_site(db: Session, site_id: int, user: dict) -> models.Site:
    """Return a Site visible to `user`, or 404 without revealing existence."""
    q = db.query(models.Site).filter(models.Site.id == site_id)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.Site.tenant_id == tenant)
    site = q.first()
    if not site:
        raise HTTPException(404, "Site não encontrado")
    return site


@router.get("/sites", response_model=List[SiteOut])
def get_sites(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all sites. SUPER_ADMIN sees all; others see only their tenant's sites."""
    q = db.query(models.Site)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.Site.tenant_id == tenant)
    return q.all()


@router.post("/sites", response_model=SiteOut, status_code=201)
def create_site(site: Site, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new installation site. Enforces plan-based max_sites limit.
    
    If the user's current site count >= max_sites for their plan,
    returns HTTP 403 with an upgrade message.
    """
    tenant_id = user.get("tenant_id")
    role = user.get("role", "")
    
    # SUPER_ADMIN bypasses site limits
    if role != "SUPER_ADMIN":
        # Resolve plan and max_sites
        plan = get_tenant_plan(user, db)
        max_sites = get_max_sites_for_plan(plan)
        current_count = db.query(models.Site).filter(models.Site.tenant_id == tenant_id).count()
        
        if current_count >= max_sites:
            plan_names = {
                "beta": "Beta",
                "home": "Home",
                "smart": "Smart",
                "starter": "Starter",
                "pro": "Pro",
                "enterprise": "Enterprise",
            }
            plan_name = plan_names.get(plan, plan.capitalize())
            raise HTTPException(
                status_code=403,
                detail=f"Limite de instalações atingido para o plano {plan_name}. "
                       f"O teu plano permite {max_sites} instalação(ões) e já tens {current_count}. "
                       f"Faz upgrade para adicionar mais."
            )
    
    db_site = models.Site(tenant_id=tenant_id, **site.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


@router.delete("/sites/{site_id}")
def delete_site(site_id: int, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a site. Users can only delete their own tenant's sites (404 no-leak)."""
    site = _get_owned_site(db, site_id, user)
    # Explicitly remove VPP memberships for this site (SQLite does not enforce
    # the FK ON DELETE CASCADE), so no orphan memberships are left behind.
    db.query(models.VPPSiteMembership).filter(models.VPPSiteMembership.site_id == site_id).delete()
    db.delete(site)
    db.commit()
    return {"message": "Site removido"}


# ── Telemetry Coverage ────────────────────────────────────────────────────────

class TelemetryCoverageOut(BaseModel):
    tenant_id: int
    readings_count: int
    first_reading: Optional[datetime]
    last_reading: Optional[datetime]


@router.get("/sites/telemetry-coverage", response_model=TelemetryCoverageOut)
def get_telemetry_coverage(
    tenant_id: Optional[int] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return telemetry coverage summary for the authenticated tenant.

    Uses real DeviceReading data from PostgreSQL.
    Normal users only see their own tenant.
    SUPER_ADMIN may pass ?tenant_id=<id> to inspect another tenant.
    """
    role = user.get("role", "")
    effective_tenant = user.get("tenant_id")

    if role == "SUPER_ADMIN" and tenant_id is not None:
        effective_tenant = tenant_id

    if effective_tenant is None:
        raise HTTPException(400, "tenant_id could not be resolved")

    row = (
        db.query(
            func.count(models.DeviceReading.id).label("readings_count"),
            func.min(models.DeviceReading.timestamp).label("first_reading"),
            func.max(models.DeviceReading.timestamp).label("last_reading"),
        )
        .filter(models.DeviceReading.tenant_id == effective_tenant)
        .one_or_none()
    )

    if row is None or row.readings_count == 0:
        return TelemetryCoverageOut(
            tenant_id=effective_tenant,
            readings_count=0,
            first_reading=None,
            last_reading=None,
        )

    return TelemetryCoverageOut(
        tenant_id=effective_tenant,
        readings_count=row.readings_count,
        first_reading=row.first_reading,
        last_reading=row.last_reading,
    )
