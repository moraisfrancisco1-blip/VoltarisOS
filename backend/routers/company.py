"""
company.py — Settings > Company: the tenant's own company profile.

TENANT_ADMIN/SUPER_ADMIN only. Previously Settings.jsx's Company tab
rendered every field with a hardcoded string literal and no onChange prop
at all -- keystrokes went nowhere and Save was a local-only UI flash. This
router gives it something real to read from and write to.

    GET   /api/company   — This tenant's company profile
    PATCH /api/company   — Update it
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.database import SessionLocal
from backend.security import require_admin
from backend import models
from backend.audit import log_audit_event

router = APIRouter(prefix="/api/company", tags=["company"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CompanyOut(BaseModel):
    name: str
    vat_number: str | None = None
    address: str | None = None
    country: str | None = None
    website: str | None = None
    support_email: str | None = None
    billing_email: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    vat_number: str | None = None
    address: str | None = None
    country: str | None = None
    website: str | None = None
    support_email: str | None = None
    billing_email: str | None = None


def _tenant(db, current_user: dict) -> models.Tenant:
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.get("tenant_id")).first()
    if not tenant:
        raise HTTPException(404, "Empresa não encontrada")
    return tenant


@router.get("", response_model=CompanyOut)
def get_company(db=Depends(get_db), current_user: dict = Depends(require_admin)):
    return _tenant(db, current_user)


@router.patch("", response_model=CompanyOut)
def update_company(
    req: CompanyUpdate,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    tenant = _tenant(db, current_user)
    changed = {}
    data = req.model_dump(exclude_unset=True)
    for field, value in data.items():
        value = value.strip() if isinstance(value, str) else value
        if field == "name" and not value:
            raise HTTPException(400, "O nome da empresa não pode ficar vazio")
        current = getattr(tenant, field)
        if value != (current or ""):
            setattr(tenant, field, value or None)
            changed[field] = value

    db.commit()
    if changed:
        log_audit_event(
            db=db, action="company.updated", tenant_id=tenant.id, user_id=None,
            user_email=current_user.get("sub"), target_resource="tenant", target_id=tenant.id,
            ip_address=request.client.host if request.client else None,
            details={"fields": list(changed.keys())},
        )
    return tenant
