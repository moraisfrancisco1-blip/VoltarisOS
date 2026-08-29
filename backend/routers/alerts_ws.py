"""
Real-time alerts via WebSocket + alert rules engine.
GET  /api/alerts              — list fired alerts (paginated)
POST /api/alerts/{id}/ack     — acknowledge
GET  /api/alert-rules         — CRUD rules
POST /api/alert-rules
DELETE /api/alert-rules/{id}
WS   /ws/alerts?token=...     — push stream
POST /api/alerts/fire         — internal: gateway fires alert → broadcasts
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import asyncio, json
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user, require_gateway_key

router = APIRouter()

# ─── WebSocket connection manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}  # tenant_id → [ws]

    async def connect(self, ws: WebSocket, tenant_id: str):
        await ws.accept()
        self._connections.setdefault(tenant_id, []).append(ws)

    def disconnect(self, ws: WebSocket, tenant_id: str):
        conns = self._connections.get(tenant_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, tenant_id: str, message: dict):
        dead = []
        for ws in self._connections.get(tenant_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, tenant_id)

    async def broadcast_all(self, message: dict):
        """Broadcast to all tenants (for system-wide events)."""
        for tid in list(self._connections.keys()):
            await self.broadcast(tid, message)


manager = ConnectionManager()


# ─── Dependency ──────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Tenant isolation helper ─────────────────────────────────────────────────
def _effective_tenant(user: dict):
    """Return a tenant filter value for `user`, or None for SUPER_ADMIN bypass."""
    if user.get("role") == "SUPER_ADMIN":
        return None
    return user.get("tenant_id")


# ─── Schemas ─────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id: int
    tenant_id: int
    device_id: Optional[int]
    device_name: Optional[str]
    severity: str
    title: str
    message: Optional[str]
    metric: Optional[str]
    value: Optional[float]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    fired_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AlertRuleCreate(BaseModel):
    name: str
    device_id: Optional[int] = None
    metric: str
    operator: str   # gt | lt | eq | ne
    threshold: Optional[float] = None
    severity: str = "warning"

class AlertRuleOut(AlertRuleCreate):
    id: int
    tenant_id: int
    enabled: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class FireAlertRequest(BaseModel):
    tenant_id: int
    device_id: Optional[int] = None
    device_name: Optional[str] = None
    severity: str = "warning"
    title: str
    message: Optional[str] = None
    metric: Optional[str] = None
    value: Optional[float] = None
    rule_id: Optional[int] = None


# ─── WebSocket endpoint ──────────────────────────────────────────────────────
@router.websocket("/ws/alerts")
async def alerts_ws(ws: WebSocket, token: str = Query(default="")):
    """
    Connect: ws://host/ws/alerts?token=<jwt>
    A valid JWT (same one used for the REST API) is required — connection is
    rejected before accept() if the token is missing or invalid.
    """
    tenant_id = _tenant_from_token(token)
    if tenant_id is None:
        await ws.close(code=4401)  # custom close code: unauthorized
        return
    await manager.connect(ws, tenant_id)
    try:
        # Send last 10 unacknowledged alerts on connect
        db = SessionLocal()
        try:
            alerts = (
                db.query(models.Alert)
                .filter(models.Alert.tenant_id == int(tenant_id), models.Alert.acknowledged == False)
                .order_by(models.Alert.fired_at.desc())
                .limit(10).all()
            )
            for a in reversed(alerts):
                await ws.send_json({
                    "type": "alert",
                    "id": a.id,
                    "severity": a.severity,
                    "title": a.title,
                    "message": a.message,
                    "device_name": a.device_name,
                    "metric": a.metric,
                    "value": a.value,
                    "fired_at": a.fired_at.isoformat(),
                })
        finally:
            db.close()

        # Keep alive — ping every 30s
        while True:
            await asyncio.sleep(30)
            await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(ws, tenant_id)


def _tenant_from_token(token: str):
    """Returns the tenant_id string for a valid JWT, or None if the token is missing/invalid."""
    if not token:
        return None
    try:
        from backend.security import decode_token
        data = decode_token(token)
        return str(data.get("tenant_id", 1))
    except Exception:
        return None


# ─── REST: Alerts ─────────────────────────────────────────────────────────────
@router.get("/api/alerts", response_model=List[AlertOut])
def list_alerts(
    unacked_only: bool = Query(default=False),
    limit: int = Query(default=50),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    q = db.query(models.Alert)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.Alert.tenant_id == tenant)
    if unacked_only:
        q = q.filter(models.Alert.acknowledged == False)
    return q.order_by(models.Alert.fired_at.desc()).limit(limit).all()


@router.post("/api/alerts/{alert_id}/ack")
def acknowledge_alert(alert_id: int, by: str = "user", db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    q = db.query(models.Alert).filter(models.Alert.id == alert_id)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.Alert.tenant_id == tenant)
    a = q.first()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.acknowledged = True
    a.acknowledged_by = by
    a.acknowledged_at = models.utcnow_naive()
    db.commit()
    return {"ok": True}


@router.post("/api/alerts/fire")
async def fire_alert(body: FireAlertRequest, db: Session = Depends(get_db), _svc: None = Depends(require_gateway_key)):
    """Called by the device gateway / rules engine (service-to-service), not by a logged-in user.
    Protected by GATEWAY_API_KEY, separate from user JWTs."""
    alert = models.Alert(
        tenant_id=body.tenant_id,
        device_id=body.device_id,
        device_name=body.device_name,
        severity=body.severity,
        title=body.title,
        message=body.message,
        metric=body.metric,
        value=body.value,
        rule_id=body.rule_id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Broadcast via WebSocket
    await manager.broadcast(str(body.tenant_id), {
        "type": "alert",
        "id": alert.id,
        "severity": alert.severity,
        "title": alert.title,
        "message": alert.message,
        "device_name": alert.device_name,
        "metric": alert.metric,
        "value": alert.value,
        "fired_at": alert.fired_at.isoformat(),
    })
    return {"ok": True, "id": alert.id}


# ─── REST: Alert Rules ────────────────────────────────────────────────────────
@router.get("/api/alert-rules", response_model=List[AlertRuleOut])
def list_rules(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    q = db.query(models.AlertRule)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.AlertRule.tenant_id == tenant)
    return q.all()


@router.post("/api/alert-rules", response_model=AlertRuleOut, status_code=201)
def create_rule(body: AlertRuleCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant_id = user.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(400, "tenant_id could not be resolved")
    rule = models.AlertRule(tenant_id=tenant_id, **body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/api/alert-rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    q = db.query(models.AlertRule).filter(models.AlertRule.id == rule_id)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.AlertRule.tenant_id == tenant)
    rule = q.first()
    if not rule:
        raise HTTPException(404)
    db.delete(rule)
    db.commit()


# ─── Rules engine — shared threshold/dedup logic ──────────────────────────────
def _rule_matches(rule, val) -> bool:
    if rule.operator == "gt" and val > rule.threshold:
        return True
    if rule.operator == "lt" and val < rule.threshold:
        return True
    if rule.operator == "eq" and val == rule.threshold:
        return True
    if rule.operator == "ne" and val != rule.threshold:
        return True
    return False


def _active_alert_exists(db: Session, tenant_id: int, device_id: int, rule_id: int) -> bool:
    """True if an unacknowledged alert already exists for this (tenant, device, rule).
    Used to avoid duplicate alerts for a persistent condition."""
    return db.query(models.Alert).filter(
        models.Alert.tenant_id == tenant_id,
        models.Alert.rule_id == rule_id,
        models.Alert.device_id == device_id,
        models.Alert.acknowledged.is_(False),
    ).first() is not None


def _build_alert(rule, tenant_id: int, device_id: int, device_name: str, val):
    return models.Alert(
        tenant_id=tenant_id,
        device_id=device_id,
        device_name=device_name,
        rule_id=rule.id,
        severity=rule.severity,
        title=f"{rule.name}: {rule.metric} {rule.operator} {rule.threshold}",
        message=f"{device_name} reported {rule.metric}={float(val):.2f} (threshold {rule.threshold})",
        metric=rule.metric,
        value=float(val),
    )


def evaluate_rules_sync(tenant_id: int, device_id: int, device_name: str, reading: dict, db: Session) -> list:
    """Evaluate one reading against the tenant's enabled rules and persist deduplicated
    alerts. Returns the newly created Alert objects. Non-critical errors are swallowed
    so an already-persisted reading is never lost because of alert evaluation."""
    created = []
    try:
        rules = db.query(models.AlertRule).filter(
            models.AlertRule.tenant_id == tenant_id,
            models.AlertRule.enabled == True,
        ).all()
        for rule in rules:
            if rule.device_id and rule.device_id != device_id:
                continue
            val = reading.get(rule.metric)
            if val is None or not _rule_matches(rule, val):
                continue
            if _active_alert_exists(db, tenant_id, device_id, rule.id):
                continue  # persistent condition already alerted (dedup)
            alert = _build_alert(rule, tenant_id, device_id, device_name, val)
            db.add(alert)
            created.append(alert)
        if created:
            db.commit()
    except Exception:
        db.rollback()
        return []
    return created


async def evaluate_rules(tenant_id: int, device_id: int, device_name: str, reading: dict, db: Session):
    """Async variant used where a live websocket push is desired. Reuses the same
    threshold/dedup logic as evaluate_rules_sync."""
    rules = db.query(models.AlertRule).filter(
        models.AlertRule.tenant_id == tenant_id,
        models.AlertRule.enabled == True,
    ).all()
    for rule in rules:
        if rule.device_id and rule.device_id != device_id:
            continue
        val = reading.get(rule.metric)
        if val is None or not _rule_matches(rule, val):
            continue
        if _active_alert_exists(db, tenant_id, device_id, rule.id):
            continue
        alert = _build_alert(rule, tenant_id, device_id, device_name, val)
        db.add(alert)
        db.commit()
        db.refresh(alert)
        await manager.broadcast(str(tenant_id), {
            "type": "alert",
            "id": alert.id,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message,
            "device_name": device_name,
            "metric": rule.metric,
            "value": float(val),
            "fired_at": alert.fired_at.isoformat(),
        })
