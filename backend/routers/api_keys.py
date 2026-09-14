"""
api_keys.py — User-facing API key management for external integrations.

TENANT_ADMIN/SUPER_ADMIN only (matches the "apikeys" page gate in
frontend/src/config/roleAccess.js), and Enterprise-plan only (matches
"admin_apikeys" in permissions.py). A generated key can then be used as
`Authorization: Bearer vos_...` on any endpoint a normal user could call —
see backend/security.py's get_current_user for how it's resolved, and the
ApiKey model docstring in backend/models.py for why it's always
TENANT_MEMBER-scoped regardless of the creator's own role.

    POST   /api/api-keys           — Create a new key (plaintext returned once)
    GET    /api/api-keys           — List this tenant's active keys (no secrets)
    DELETE /api/api-keys/{id}      — Revoke a key
    POST   /api/api-keys/{id}/rotate — Replace a key's secret (plaintext returned once)
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict

from backend.database import SessionLocal
from backend.security import require_admin, generate_api_key, check_module_access
from backend.models import utcnow_naive
from backend import models
from backend.audit import log_audit_event

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyOut(BaseModel):
    id: int
    name: str
    key_prefix: str
    created_at: datetime
    last_used_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreated(ApiKeyOut):
    key: str  # plaintext — present only in the create/rotate response, once


def _creator_user(db, current_user: dict) -> models.User:
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    return user


def _owned_key(db, key_id: int, current_user: dict) -> models.ApiKey:
    tenant_id = current_user.get("tenant_id")
    q = db.query(models.ApiKey).filter(models.ApiKey.id == key_id, models.ApiKey.revoked_at.is_(None))
    if current_user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.ApiKey.tenant_id == tenant_id)
    row = q.first()
    if not row:
        raise HTTPException(404, "API key não encontrada")
    return row


@router.post("", response_model=ApiKeyCreated, status_code=201)
def create_api_key(
    req: ApiKeyCreate,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_apikeys")),
):
    if not req.name.strip():
        raise HTTPException(400, "Nome é obrigatório")

    creator = _creator_user(db, current_user)
    full_key, prefix, key_hash = generate_api_key()
    row = models.ApiKey(
        tenant_id=creator.tenant_id,
        user_id=creator.id,
        name=req.name.strip(),
        key_prefix=prefix,
        key_hash=key_hash,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    log_audit_event(
        db=db, action="api_key.created", tenant_id=creator.tenant_id, user_id=creator.id,
        user_email=creator.email, target_resource="api_key", target_id=row.id,
        ip_address=request.client.host if request.client else None,
        details={"name": row.name},
    )

    return ApiKeyCreated(
        id=row.id, name=row.name, key_prefix=row.key_prefix,
        created_at=row.created_at, last_used_at=row.last_used_at, key=full_key,
    )


@router.get("", response_model=list[ApiKeyOut])
def list_api_keys(
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_apikeys")),
):
    q = db.query(models.ApiKey).filter(models.ApiKey.revoked_at.is_(None))
    if current_user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.ApiKey.tenant_id == current_user.get("tenant_id"))
    return q.order_by(models.ApiKey.created_at.desc()).all()


@router.delete("/{key_id}", status_code=204)
def revoke_api_key(
    key_id: int,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_apikeys")),
):
    row = _owned_key(db, key_id, current_user)
    actor = _creator_user(db, current_user)
    row.revoked_at = utcnow_naive()
    db.commit()

    log_audit_event(
        db=db, action="api_key.revoked", tenant_id=row.tenant_id, user_id=actor.id,
        user_email=actor.email, target_resource="api_key", target_id=row.id,
        ip_address=request.client.host if request.client else None,
    )


@router.post("/{key_id}/rotate", response_model=ApiKeyCreated)
def rotate_api_key(
    key_id: int,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_apikeys")),
):
    row = _owned_key(db, key_id, current_user)
    actor = _creator_user(db, current_user)
    full_key, prefix, key_hash = generate_api_key()
    row.key_prefix = prefix
    row.key_hash = key_hash
    row.last_used_at = None
    db.commit()
    db.refresh(row)

    log_audit_event(
        db=db, action="api_key.rotated", tenant_id=row.tenant_id, user_id=actor.id,
        user_email=actor.email, target_resource="api_key", target_id=row.id,
        ip_address=request.client.host if request.client else None,
    )

    return ApiKeyCreated(
        id=row.id, name=row.name, key_prefix=row.key_prefix,
        created_at=row.created_at, last_used_at=row.last_used_at, key=full_key,
    )
