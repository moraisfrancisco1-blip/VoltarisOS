"""
tenant_settings.py — Settings > Energy / Trading / Notifications.

These three tabs previously wrote only to each browser's localStorage (via
frontend/src/store/appStore.js's energySettings/tradingSettings/
alertSettings) -- real for that one browser, invisible to the backend,
lost the moment someone opens the app on another device. This router makes
them a real, tenant-wide row instead.

Each block (energy/trading/notifications) is stored and returned as an
opaque JSON object -- this router doesn't validate its internal shape
beyond what the frontend already sends; see appStore.js for the fields
each block currently carries.

KNOWN LIMITATION: the actual trading/optimization engine (backend/tasks.py,
trading_agent.py, run_milp_optimization) does not yet read the `trading`/
`energy` blocks here. This change makes the values real and persisted
tenant-wide -- it does not (yet) make the optimization engine consult
them. That is a separate, larger piece of work.

    GET   /api/tenant-settings                     — This tenant's settings (any member)
    PATCH /api/tenant-settings                      — Merge-update one or more blocks (admin only)
    POST  /api/tenant-settings/notifications/test    — Send a real test message to the saved Slack webhook (admin only)
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.database import SessionLocal
from backend.security import require_admin, get_current_user
from backend import models
from backend.audit import log_audit_event

router = APIRouter(prefix="/api/tenant-settings", tags=["tenant-settings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TenantSettingsOut(BaseModel):
    energy: dict | None = None
    trading: dict | None = None
    notifications: dict | None = None


class TenantSettingsUpdate(BaseModel):
    energy: dict | None = None
    trading: dict | None = None
    notifications: dict | None = None


def _row(db, tenant_id: int) -> models.TenantSettings:
    row = db.query(models.TenantSettings).filter(models.TenantSettings.tenant_id == tenant_id).first()
    if not row:
        row = models.TenantSettings(tenant_id=tenant_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=TenantSettingsOut)
def get_tenant_settings(db=Depends(get_db), current_user: dict = Depends(get_current_user)):
    return _row(db, current_user.get("tenant_id"))


@router.patch("", response_model=TenantSettingsOut)
def update_tenant_settings(
    req: TenantSettingsUpdate,
    request: Request,
    db=Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    row = _row(db, current_user.get("tenant_id"))
    changed_blocks = []
    for block in ("energy", "trading", "notifications"):
        incoming = getattr(req, block)
        if incoming is None:
            continue
        current = getattr(row, block) or {}
        setattr(row, block, {**current, **incoming})
        changed_blocks.append(block)

    if changed_blocks:
        db.commit()
        log_audit_event(
            db=db, action="tenant_settings.updated", tenant_id=row.tenant_id, user_id=None,
            user_email=current_user.get("sub"), target_resource="tenant_settings", target_id=row.tenant_id,
            ip_address=request.client.host if request.client else None,
            details={"blocks": changed_blocks},
        )
    db.refresh(row)
    return row


@router.post("/notifications/test")
def send_test_notification(db=Depends(get_db), current_user: dict = Depends(require_admin)):
    row = _row(db, current_user.get("tenant_id"))
    webhook_url = (row.notifications or {}).get("slackWebhook")
    if not webhook_url:
        raise HTTPException(400, "Nenhum Slack webhook URL guardado. Preenche e grava o campo primeiro.")

    try:
        resp = httpx.post(
            webhook_url,
            json={"text": "🔔 Mensagem de teste da VoltarisOS — as notificações Slack estão configuradas corretamente."},
            timeout=10.0,
        )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Não foi possível contactar o Slack: {e}")

    if resp.status_code != 200:
        raise HTTPException(502, f"O Slack recusou a mensagem (status {resp.status_code}): {resp.text[:200]}")

    return {"message": "Mensagem de teste enviada com sucesso."}
