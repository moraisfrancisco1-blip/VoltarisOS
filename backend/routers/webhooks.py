"""
webhooks.py — User-configured outbound webhooks.

TENANT_ADMIN/SUPER_ADMIN only (matches the settings "Webhooks" tab gate).
A webhook fires when one of its `event_types` is audit-logged for this
tenant -- see backend/audit.py's log_audit_event(), which enqueues delivery
via backend/tasks.py's Celery task deliver_webhook, entirely off the
request path so a slow/unreachable receiver never blocks the action that
triggered it.

    GET    /api/webhooks/event-types   — Catalog of subscribable event types
    POST   /api/webhooks               — Create (secret returned once, on creation only)
    GET    /api/webhooks               — List this tenant's webhooks
    PATCH  /api/webhooks/{id}          — Update url/event_types/active
    DELETE /api/webhooks/{id}          — Delete
    POST   /api/webhooks/{id}/test     — Send a synthetic "webhook.test" event now
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, field_validator

from backend.database import SessionLocal
from backend.security import require_admin
from backend.models import utcnow_naive
from backend import models
from backend.audit import log_audit_event
from backend.tasks import deliver_webhook

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# The only action values backend/audit.py's log_audit_event() is actually
# ever called with today. Kept in sync by hand -- deliberately a closed list
# rather than free text, so a tenant can never subscribe to an event that
# will never fire.
KNOWN_EVENT_TYPES = [
    "user.login.success",
    "user.login.failed",
    "2fa.setup.initiated",
    "2fa.enabled",
    "2fa.disabled",
    "2fa.backup_codes.regenerated",
    "2fa.backup_code.used",
    "api_key.created",
    "api_key.revoked",
    "api_key.rotated",
    "vpp.bid.submitted",
    "device.readings.batch_ingest",
    "webhook.created",
    "webhook.updated",
    "webhook.deleted",
    "white_label.domain_requested",
    "white_label.domain_removed",
    "oauth.connected",
    "oauth.disconnected",
    "user.avatar_updated",
    "user.avatar_removed",
]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class WebhookCreate(BaseModel):
    url: str
    event_types: list[str]

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("URL deve começar com http:// ou https://")
        return v

    @field_validator("event_types")
    @classmethod
    def validate_event_types(cls, v):
        if not v:
            raise ValueError("Seleciona pelo menos um tipo de evento")
        unknown = set(v) - set(KNOWN_EVENT_TYPES) - {"*"}
        if unknown:
            raise ValueError(f"Tipo(s) de evento desconhecido(s): {', '.join(sorted(unknown))}")
        return v


class WebhookUpdate(BaseModel):
    url: str | None = None
    event_types: list[str] | None = None
    active: bool | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        if v is not None and not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("URL deve começar com http:// ou https://")
        return v

    @field_validator("event_types")
    @classmethod
    def validate_event_types(cls, v):
        if v is not None:
            unknown = set(v) - set(KNOWN_EVENT_TYPES) - {"*"}
            if unknown:
                raise ValueError(f"Tipo(s) de evento desconhecido(s): {', '.join(sorted(unknown))}")
        return v


class WebhookOut(BaseModel):
    id: int
    url: str
    event_types: list[str]
    secret: str
    active: bool
    created_at: datetime
    last_triggered_at: datetime | None = None
    last_status_code: int | None = None
    last_error: str | None = None
    failure_count: int
    model_config = ConfigDict(from_attributes=True)


def _creator_user(db, current_user: dict) -> models.User:
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    return user


def _owned_webhook(db, webhook_id: int, current_user: dict) -> models.Webhook:
    q = db.query(models.Webhook).filter(models.Webhook.id == webhook_id)
    if current_user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.Webhook.tenant_id == current_user.get("tenant_id"))
    row = q.first()
    if not row:
        raise HTTPException(404, "Webhook não encontrado")
    return row


@router.get("/event-types", response_model=list[str])
def list_event_types(current_user: dict = Depends(require_admin)):
    return KNOWN_EVENT_TYPES


@router.post("", response_model=WebhookOut, status_code=201)
def create_webhook(
    req: WebhookCreate,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    import secrets as _secrets

    creator = _creator_user(db, current_user)
    row = models.Webhook(
        tenant_id=creator.tenant_id,
        user_id=creator.id,
        url=req.url,
        event_types=req.event_types,
        secret="whsec_" + _secrets.token_urlsafe(24),
        active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    log_audit_event(
        db=db, action="webhook.created", tenant_id=creator.tenant_id, user_id=creator.id,
        user_email=creator.email, target_resource="webhook", target_id=row.id,
        ip_address=request.client.host if request.client else None,
        details={"url": row.url, "event_types": row.event_types},
    )
    return row


@router.get("", response_model=list[WebhookOut])
def list_webhooks(db=Depends(get_db), current_user: dict = Depends(require_admin)):
    q = db.query(models.Webhook)
    if current_user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.Webhook.tenant_id == current_user.get("tenant_id"))
    return q.order_by(models.Webhook.created_at.desc()).all()


@router.patch("/{webhook_id}", response_model=WebhookOut)
def update_webhook(
    webhook_id: int,
    req: WebhookUpdate,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    row = _owned_webhook(db, webhook_id, current_user)
    if req.url is not None:
        row.url = req.url
    if req.event_types is not None:
        row.event_types = req.event_types
    if req.active is not None:
        row.active = req.active
    db.commit()
    db.refresh(row)

    actor = _creator_user(db, current_user)
    log_audit_event(
        db=db, action="webhook.updated", tenant_id=row.tenant_id, user_id=actor.id,
        user_email=actor.email, target_resource="webhook", target_id=row.id,
        ip_address=request.client.host if request.client else None,
    )
    return row


@router.delete("/{webhook_id}", status_code=204)
def delete_webhook(
    webhook_id: int,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    row = _owned_webhook(db, webhook_id, current_user)
    actor = _creator_user(db, current_user)
    tenant_id, row_id, url = row.tenant_id, row.id, row.url
    db.delete(row)
    db.commit()

    log_audit_event(
        db=db, action="webhook.deleted", tenant_id=tenant_id, user_id=actor.id,
        user_email=actor.email, target_resource="webhook", target_id=row_id,
        ip_address=request.client.host if request.client else None,
        details={"url": url},
    )


@router.post("/{webhook_id}/test")
def test_webhook(
    webhook_id: int,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    row = _owned_webhook(db, webhook_id, current_user)
    deliver_webhook.delay(row.id, "webhook.test", {"message": "This is a test event from VoltarisOS."})
    return {"message": "Evento de teste enviado."}
