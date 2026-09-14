"""
audit_log.py — Read-only endpoint for the append-only audit_logs table.

GET /api/audit-log — TENANT_ADMIN/SUPER_ADMIN only, and Enterprise-plan
only (matches "admin_audit" in permissions.py). Returns the caller's
tenant audit trail (SUPER_ADMIN sees every tenant), newest first.

Writes to audit_logs go exclusively through backend/audit.py's
log_audit_event() from the routers that perform the audited actions;
this router only reads.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.security import require_admin, check_module_access
from backend import models

router = APIRouter(prefix="/api/audit-log", tags=["audit"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AuditLogEntry(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    target_resource: Optional[str] = None
    target_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


class AuditLogPage(BaseModel):
    entries: list[AuditLogEntry]
    total: int


@router.get("", response_model=AuditLogPage)
def list_audit_log(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_audit")),
):
    """Return the tenant's audit trail, newest first.

    SUPER_ADMIN sees every tenant's entries; TENANT_ADMIN sees only their own
    tenant's (enforced the same way sites/devices/VPP routers scope reads).
    """
    q = db.query(models.AuditLog)
    if user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.AuditLog.tenant_id == user.get("tenant_id"))
    if action:
        q = q.filter(models.AuditLog.action.ilike(f"%{action}%"))
    if user_email:
        q = q.filter(models.AuditLog.user_email.ilike(f"%{user_email}%"))

    total = q.count()
    entries = (
        q.order_by(models.AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return AuditLogPage(entries=entries, total=total)
