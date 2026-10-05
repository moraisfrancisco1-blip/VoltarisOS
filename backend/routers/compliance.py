"""Regulatory compliance tracker -- real, tenant-scoped CRUD.

The Regulatory Compliance page tracks obligations (filings, certifications,
inspections, reports): what is due, to whom, by when, how risky, and where it
stands. The data is entered by the tenant's own admins -- there is no external
source -- so this is plain CRUD, not an integration.

Tenant isolation: the tenant is always derived from the authenticated user (JWT),
never from the body. Anything belonging to another tenant is a 404 (no leak of
its existence). Reading is open to any member of the tenant; creating, changing
and deleting need TENANT_ADMIN or SUPER_ADMIN.
"""
from datetime import date
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from backend import models
from backend.audit import audit_request
from backend.database import SessionLocal
from backend.security import get_current_user, require_admin

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

Category = Literal["Safety", "Regulatory", "ESG", "Grid", "Market", "Environmental", "ISO"]
Risk = Literal["low", "medium", "high"]
Status = Literal["pending", "inprogress", "done"]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _effective_tenant(user: dict):
    """Tenant filter value, or None for the SUPER_ADMIN bypass (same rule as other routers)."""
    if user.get("role") == "SUPER_ADMIN":
        return None
    return user.get("tenant_id")


class ComplianceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: Optional[str] = Field(default=None, max_length=200)
    due_date: date
    category: Category = "Regulatory"
    risk: Risk = "medium"
    status: Status = "pending"
    notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("title must not be blank")
        return v


class ComplianceUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: Optional[str] = Field(default=None, max_length=200)
    due_date: Optional[date] = None
    category: Optional[Category] = None
    risk: Optional[Risk] = None
    status: Optional[Status] = None
    notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("title must not be blank")
        return v


class ComplianceOut(BaseModel):
    id: int
    tenant_id: int
    title: str
    body: Optional[str]
    due_date: date
    category: str
    risk: str
    status: str
    notes: Optional[str]
    completed_at: Optional[str] = None
    created_by: Optional[str]
    model_config = ConfigDict(from_attributes=True)

    @field_validator("completed_at", mode="before")
    @classmethod
    def _iso(cls, v):
        return v.isoformat() if hasattr(v, "isoformat") else v


def _get_owned(db: Session, item_id: int, user: dict) -> models.ComplianceItem:
    q = db.query(models.ComplianceItem).filter(models.ComplianceItem.id == item_id)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.ComplianceItem.tenant_id == tenant)
    item = q.first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@router.get("", response_model=List[ComplianceOut])
def list_items(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    q = db.query(models.ComplianceItem)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.ComplianceItem.tenant_id == tenant)
    return q.order_by(models.ComplianceItem.due_date.asc(), models.ComplianceItem.id.asc()).all()


@router.post("", response_model=ComplianceOut, status_code=201)
def create_item(body: ComplianceCreate, request: Request, db: Session = Depends(get_db),
                user: dict = Depends(require_admin)):
    tenant_id = user.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(400, "Open a tenant account to add compliance items")
    item = models.ComplianceItem(tenant_id=tenant_id, created_by=user.get("sub"), **body.model_dump())
    if item.status == "done":
        item.completed_at = models.utcnow_naive()
    db.add(item)
    db.commit()
    db.refresh(item)
    audit_request(db, request, user, "compliance.created", target_resource="compliance_item",
                  target_id=item.id, tenant_id=item.tenant_id, details={"title": item.title})
    return item


@router.put("/{item_id}", response_model=ComplianceOut)
def update_item(item_id: int, body: ComplianceUpdate, request: Request, db: Session = Depends(get_db),
                user: dict = Depends(require_admin)):
    item = _get_owned(db, item_id, user)
    changes = body.model_dump(exclude_unset=True)
    for field in ("title", "due_date", "category", "risk", "status"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")
    for field, value in changes.items():
        setattr(item, field, value)
    if "status" in changes:
        # completed_at follows the status: set when it becomes done, cleared when reopened.
        if item.status == "done" and item.completed_at is None:
            item.completed_at = models.utcnow_naive()
        elif item.status != "done":
            item.completed_at = None
    db.commit()
    db.refresh(item)
    audit_request(db, request, user, "compliance.updated", target_resource="compliance_item",
                  target_id=item.id, tenant_id=item.tenant_id, details={"fields": sorted(changes)})
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, request: Request, db: Session = Depends(get_db),
                user: dict = Depends(require_admin)):
    item = _get_owned(db, item_id, user)
    title, tenant_id = item.title, item.tenant_id
    db.delete(item)
    db.commit()
    audit_request(db, request, user, "compliance.deleted", target_resource="compliance_item",
                  target_id=item_id, tenant_id=tenant_id, details={"title": title})
