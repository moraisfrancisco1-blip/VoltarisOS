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
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import asyncio, json
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

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
    class Config:
        from_attributes = True

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
    class Config:
        from_attributes = True

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
async def alerts_ws(ws: WebSocket, token: str = Query(default="demo")):
    """
    Connect: ws://host/ws/alerts?token=<jwt>
    For demo: token=demo → tenant_id=1
    """
    # Decode tenant from token (simplified — production would verify JWT)
    tenant_id = _tenant_from_token(token)
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


def _tenant_from_token(token: str) -> str:
    if token == "demo":
        return "1"
    try:
        from jose import jwt
        data = jwt.decode(token, "voltarisos-secret-2026", algorithms=["HS256"])
        return str(data.get("tenant_id", 1))
    except Exception:
        return "1"


# ─── REST: Alerts ─────────────────────────────────────────────────────────────
@router.get("/api/alerts", response_model=List[AlertOut])
def list_alerts(
    tenant_id: int = Query(default=1),
    unacked_only: bool = Query(default=False),
    limit: int = Query(default=50),
    db: Session = Depends(get_db),
):
    q = db.query(models.Alert).filter(models.Alert.tenant_id == tenant_id)
    if unacked_only:
        q = q.filter(models.Alert.acknowledged == False)
    return q.order_by(models.Alert.fired_at.desc()).limit(limit).all()


@router.post("/api/alerts/{alert_id}/ack")
def acknowledge_alert(alert_id: int, by: str = "user", db: Session = Depends(get_db)):
    a = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.acknowledged = True
    a.acknowledged_by = by
    a.acknowledged_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/api/alerts/fire")
async def fire_alert(body: FireAlertRequest, db: Session = Depends(get_db)):
    """Called by gateway or rules engine to fire an alert."""
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
def list_rules(tenant_id: int = Query(default=1), db: Session = Depends(get_db)):
    return db.query(models.AlertRule).filter(models.AlertRule.tenant_id == tenant_id).all()


@router.post("/api/alert-rules", response_model=AlertRuleOut, status_code=201)
def create_rule(body: AlertRuleCreate, tenant_id: int = Query(default=1), db: Session = Depends(get_db)):
    rule = models.AlertRule(tenant_id=tenant_id, **body.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/api/alert-rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(models.AlertRule).filter(models.AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404)
    db.delete(rule)
    db.commit()


# ─── Rules engine — called by gateway ingest ─────────────────────────────────
async def evaluate_rules(tenant_id: int, device_id: int, device_name: str, reading: dict, db: Session):
    """Check a reading against all rules for this tenant. Fire alerts as needed."""
    rules = (
        db.query(models.AlertRule)
        .filter(
            models.AlertRule.tenant_id == tenant_id,
            models.AlertRule.enabled == True,
        )
        .all()
    )
    for rule in rules:
        if rule.device_id and rule.device_id != device_id:
            continue
        val = reading.get(rule.metric)
        if val is None:
            continue
        triggered = False
        if rule.operator == "gt" and val > rule.threshold:
            triggered = True
        elif rule.operator == "lt" and val < rule.threshold:
            triggered = True
        elif rule.operator == "eq" and val == rule.threshold:
            triggered = True
        elif rule.operator == "ne" and val != rule.threshold:
            triggered = True

        if triggered:
            alert = models.Alert(
                tenant_id=tenant_id,
                device_id=device_id,
                device_name=device_name,
                rule_id=rule.id,
                severity=rule.severity,
                title=f"{rule.name}: {rule.metric} {rule.operator} {rule.threshold}",
                message=f"{device_name} reported {rule.metric}={val:.2f} (threshold {rule.threshold})",
                metric=rule.metric,
                value=float(val),
            )
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
