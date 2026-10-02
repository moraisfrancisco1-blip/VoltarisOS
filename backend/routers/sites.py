"""
sites.py — Site management with plan-based limit enforcement.

POST /sites validates that the user's active plan has enough site slots
before allowing creation of a new installation (solar/battery/site).
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from backend.database import SessionLocal
from backend import models
from backend.audit import audit_request
from backend.security import get_current_user, require_super_admin
from backend.permissions import get_tenant_plan, get_max_sites_for_plan

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns of models.Site that are NOT NULL (or must never be blanked): a PATCH
# that sends an explicit null for one of these would hit the DB constraint and
# surface as a 500, so it is rejected with a 422 instead. Everything else in
# SiteUpdate is nullable and may be cleared with null.
_NON_NULLABLE_SITE_FIELDS = ("name", "solar_kw", "battery_kwh", "ev_chargers", "status")


def _validate_name(v):
    if v is not None:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
    return v


def _validate_lat(v):
    if v is not None and not (-90 <= v <= 90):
        raise ValueError("lat must be between -90 and 90")
    return v


def _validate_lng(v):
    if v is not None and not (-180 <= v <= 180):
        raise ValueError("lng must be between -180 and 180")
    return v


def _validate_non_negative(v):
    if v is not None and v < 0:
        raise ValueError("must be greater than or equal to 0")
    return v


class Site(BaseModel):
    name: str
    # Only the name is required: the create form lets every other field stay
    # blank and sends null/0 for it, and the DB columns are nullable/defaulted.
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    timezone: Optional[str] = None   # IANA timezone, e.g. "Europe/Lisbon"
    solar_kw: float = 0.0
    battery_kwh: float = 0.0
    ev_chargers: int = 0
    owner: Optional[str] = None
    status: str = "active"
    # Panel orientation, Open-Meteo convention (see backend/models.py:Site) --
    # unset means the solar forecast falls back to flat-horizontal (GHI).
    tilt_deg: Optional[float] = None
    azimuth_deg: Optional[float] = None

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

    @field_validator("tilt_deg")
    @classmethod
    def validate_tilt(cls, v):
        if v is not None and not (0 <= v <= 90):
            raise ValueError("tilt_deg must be between 0 (flat) and 90 (vertical)")
        return v

    @field_validator("azimuth_deg")
    @classmethod
    def validate_azimuth(cls, v):
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("azimuth_deg must be between -180 and 180 (0=South, -90=East, 90=West, +-180=North)")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return _validate_name(v)

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v):
        return _validate_lat(v)

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v):
        return _validate_lng(v)

    @field_validator("solar_kw", "battery_kwh", "ev_chargers")
    @classmethod
    def validate_non_negative(cls, v):
        return _validate_non_negative(v)


class SiteOut(BaseModel):
    """Response shape. Deliberately NOT derived from `Site`: the input
    validators (ranges, non-blank name) must not run on rows already stored, or
    a single legacy row with a NULL/out-of-range value would turn the whole
    GET /sites listing into a 500."""
    id: int
    tenant_id: int
    name: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    timezone: Optional[str] = None
    solar_kw: Optional[float] = None
    battery_kwh: Optional[float] = None
    ev_chargers: Optional[int] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    tilt_deg: Optional[float] = None
    azimuth_deg: Optional[float] = None
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
def create_site(site: Site, request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new installation site. Enforces plan-based max_sites limit.
    
    If the user's current site count >= max_sites for their plan,
    returns HTTP 403 with an upgrade message.
    """
    tenant_id = user.get("tenant_id")
    role = user.get("role", "")

    # A site always belongs to a tenant (sites.tenant_id is NOT NULL); without
    # one the insert would fail at the DB and surface as a 500.
    if tenant_id is None:
        raise HTTPException(400, "tenant_id could not be resolved")

    # SUPER_ADMIN bypasses site limits
    if role != "SUPER_ADMIN":
        # Serialise concurrent creations for the same tenant (row lock on
        # Postgres; a no-op on SQLite) so two parallel requests cannot both
        # pass the count check below and exceed the plan's site limit.
        db.query(models.Tenant).filter(models.Tenant.id == tenant_id).with_for_update().first()
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
    audit_request(db, request, user, "site.created", target_resource="site", target_id=db_site.id,
                  details={"name": db_site.name})
    return db_site


class SiteUpdate(BaseModel):
    """Partial update — every field optional, only provided ones are changed."""
    name: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    timezone: Optional[str] = None
    solar_kw: Optional[float] = None
    battery_kwh: Optional[float] = None
    ev_chargers: Optional[int] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    tilt_deg: Optional[float] = None
    azimuth_deg: Optional[float] = None

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

    @field_validator("tilt_deg")
    @classmethod
    def validate_tilt(cls, v):
        if v is not None and not (0 <= v <= 90):
            raise ValueError("tilt_deg must be between 0 (flat) and 90 (vertical)")
        return v

    @field_validator("azimuth_deg")
    @classmethod
    def validate_azimuth(cls, v):
        if v is not None and not (-180 <= v <= 180):
            raise ValueError("azimuth_deg must be between -180 and 180 (0=South, -90=East, 90=West, +-180=North)")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return _validate_name(v)

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v):
        return _validate_lat(v)

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v):
        return _validate_lng(v)

    @field_validator("solar_kw", "battery_kwh", "ev_chargers")
    @classmethod
    def validate_non_negative(cls, v):
        return _validate_non_negative(v)


@router.patch("/sites/{site_id}", response_model=SiteOut)
def update_site(site_id: int, patch: SiteUpdate, request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Partially update a site. Same ownership rules as delete: tenant-scoped, 404 no-leak."""
    site = _get_owned_site(db, site_id, user)
    changes = patch.model_dump(exclude_unset=True)
    for field in _NON_NULLABLE_SITE_FIELDS:
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    for field, value in changes.items():
        setattr(site, field, value)
    db.commit()
    db.refresh(site)
    # Field NAMES only: owner/location can be personal data.
    audit_request(db, request, user, "site.updated", target_resource="site", target_id=site.id,
                  tenant_id=site.tenant_id, details={"fields": sorted(changes)})
    return site


@router.delete("/sites/{site_id}")
def delete_site(site_id: int, request: Request, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a site. Users can only delete their own tenant's sites (404 no-leak)."""
    site = _get_owned_site(db, site_id, user)
    # Explicitly remove VPP memberships for this site (SQLite does not enforce
    # the FK ON DELETE CASCADE), so no orphan memberships are left behind.
    db.query(models.VPPSiteMembership).filter(models.VPPSiteMembership.site_id == site_id).delete()
    site_name, site_tenant = site.name, site.tenant_id
    db.delete(site)
    db.commit()
    audit_request(db, request, user, "site.deleted", target_resource="site", target_id=site_id,
                  tenant_id=site_tenant, details={"name": site_name})
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

    # Older telemetry only exists as hourly summaries (backend/retention.py): count
    # the samples they stand for and let them extend the first/last timestamps.
    hrow = (
        db.query(
            func.coalesce(func.sum(models.DeviceReadingHourly.sample_count), 0).label("samples"),
            func.min(models.DeviceReadingHourly.hour_start).label("first_hour"),
            func.max(models.DeviceReadingHourly.hour_start).label("last_hour"),
        )
        .filter(models.DeviceReadingHourly.tenant_id == effective_tenant)
        .one_or_none()
    )
    raw_count = row.readings_count if row is not None else 0
    hourly_samples = int(hrow.samples) if hrow is not None else 0
    total = raw_count + hourly_samples
    if total == 0:
        return TelemetryCoverageOut(
            tenant_id=effective_tenant,
            readings_count=0,
            first_reading=None,
            last_reading=None,
        )

    firsts = [t for t in (row.first_reading if raw_count else None, hrow.first_hour if hourly_samples else None) if t]
    last = row.last_reading if raw_count else (hrow.last_hour if hourly_samples else None)
    return TelemetryCoverageOut(
        tenant_id=effective_tenant,
        readings_count=total,
        first_reading=min(firsts) if firsts else None,
        last_reading=last,
    )
