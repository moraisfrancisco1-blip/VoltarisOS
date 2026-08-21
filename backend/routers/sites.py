"""
sites.py — Site management with plan-based limit enforcement.

POST /sites validates that the user's active plan has enough site slots
before allowing creation of a new installation (solar/battery/site).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
import json
import os
from datetime import datetime

from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user, require_super_admin
from backend.permissions import get_tenant_plan, get_max_sites_for_plan

router = APIRouter()

SITES_FILE = "sites.json"


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
    solar_kw: float
    battery_kwh: float
    ev_chargers: int
    owner: str
    status: str = "active"


class SiteOut(Site):
    id: int
    tenant_id: Optional[int] = None
    created_at: Optional[str] = None


def load_sites():
    if not os.path.exists(SITES_FILE):
        return []
    with open(SITES_FILE, "r") as f:
        return json.load(f)


def save_sites(sites):
    with open(SITES_FILE, "w") as f:
        json.dump(sites, f, indent=2)


def count_user_sites(tenant_id: int) -> int:
    """Count sites belonging to a tenant from sites.json."""
    sites = load_sites()
    return sum(1 for s in sites if s.get("tenant_id") == tenant_id)


@router.get("/sites")
def get_sites(user: dict = Depends(get_current_user)):
    """Return all sites. SUPER_ADMIN sees all; others see only their tenant's sites."""
    sites = load_sites()
    tenant_id = user.get("tenant_id")
    role = user.get("role", "")
    
    if role == "SUPER_ADMIN":
        return sites
    
    return [s for s in sites if s.get("tenant_id") == tenant_id]


@router.get("/sites/telemetry-coverage")
def telemetry_coverage(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return DeviceReading coverage for the authenticated tenant only."""
    tenant_id = user.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(status_code=400, detail="User has no tenant")
    row = (
        db.query(
            func.count(models.DeviceReading.id).label("readings_count"),
            func.min(models.DeviceReading.timestamp).label("first_reading"),
            func.max(models.DeviceReading.timestamp).label("last_reading"),
        )
        .filter(models.DeviceReading.tenant_id == tenant_id)
        .one()
    )
    return {
        "tenant_id": tenant_id,
        "readings_count": row.readings_count,
        "first_reading": row.first_reading.isoformat() if row.first_reading else None,
        "last_reading": row.last_reading.isoformat() if row.last_reading else None,
    }


@router.post("/sites")
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
        current_count = count_user_sites(tenant_id)
        
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
    
    sites = load_sites()
    new_site = site.dict()
    new_site["id"] = len(sites) + 1
    new_site["tenant_id"] = tenant_id
    new_site["created_at"] = datetime.utcnow().isoformat()
    sites.append(new_site)
    save_sites(sites)
    return new_site


@router.delete("/sites/{site_id}")
def delete_site(site_id: int, user: dict = Depends(get_current_user)):
    """Delete a site. Users can only delete their own tenant's sites.
    SUPER_ADMIN can delete any site."""
    sites = load_sites()
    tenant_id = user.get("tenant_id")
    role = user.get("role", "")
    
    # Find the site
    target = None
    for s in sites:
        if s["id"] == site_id:
            target = s
            break
    
    if not target:
        raise HTTPException(404, "Site não encontrado")
    
    # Tenant isolation: only allow deletion if site belongs to user's tenant
    if role != "SUPER_ADMIN" and target.get("tenant_id") != tenant_id:
        raise HTTPException(403, "Acesso negado — este site pertence a outra organização")
    
    sites = [s for s in sites if s["id"] != site_id]
    save_sites(sites)
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
            models.DeviceReading.tenant_id,
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
        tenant_id=row.tenant_id,
        readings_count=row.readings_count,
        first_reading=row.first_reading,
        last_reading=row.last_reading,
    )
