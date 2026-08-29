"""Maintenance — real data integration.

Health and schedule are deterministic heuristics over real persisted data
(Device status/enabled/last_seen + Alert severity/acknowledged/fired_at).
They are explicitly heuristic rules, NOT a physical or AI model.

Degradation is NOT reliably calculable with current data (no irradiance /
expected-vs-actual production / capacity history), so the endpoint returns a
structured "not computable" response instead of fabricated numbers.

Tenant isolation: tenant always derived from the JWT; cross-tenant device
access returns 404 (no-leak).
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user

router = APIRouter()

_SEVERITY_RANK = {"critical": 3, "error": 3, "warning": 2, "info": 1, "ok": 0}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _effective_tenant(user: dict):
    """Tenant filter value, or None for SUPER_ADMIN bypass (matches other routers)."""
    if user.get("role") == "SUPER_ADMIN":
        return None
    return user.get("tenant_id")


def _health_score(status, enabled, last_seen, unacked_critical, unacked_warning, now):
    """Deterministic 0-100 heuristic health score.

    Documented rule:
      - offline status:      -40
      - error/fault/critical:-30
      - unknown status:      -15
      - disabled:            -20
      - stale last_seen:     >24h -20, >4h -10
      - each unacked critical: -5 (max 25)
      - each unacked warning:  -2 (max 10)
    Clamped to [0, 100].
    """
    score = 100
    if status == "offline":
        score -= 40
    elif status in ("error", "fault", "critical"):
        score -= 30
    elif status == "unknown":
        score -= 15
    if not enabled:
        score -= 20
    if last_seen:
        age_h = (now - last_seen).total_seconds() / 3600.0
        if age_h > 24:
            score -= 20
        elif age_h > 4:
            score -= 10
    score -= min(unacked_critical * 5, 25)
    score -= min(unacked_warning * 2, 10)
    return max(0, min(100, score))


def _severity_from_score(score):
    if score >= 80:
        return "ok"
    if score >= 50:
        return "warning"
    return "critical"


def _site_names(db, tenant):
    sq = db.query(models.Site)
    if tenant is not None:
        sq = sq.filter(models.Site.tenant_id == tenant)
    return {s.id: s.name for s in sq.all()}


@router.get("/api/maintenance/assets")
def get_assets(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = _effective_tenant(user)
    now = models.utcnow_naive()
    sites = _site_names(db, tenant)

    dq = db.query(models.Device)
    if tenant is not None:
        dq = dq.filter(models.Device.tenant_id == tenant)
    devices = dq.all()

    # Aggregate unacknowledged alerts per device/severity.
    aq = db.query(models.Alert.device_id, models.Alert.severity, func.count(models.Alert.id))
    aq = aq.filter(models.Alert.acknowledged.is_(False))
    if tenant is not None:
        aq = aq.filter(models.Alert.tenant_id == tenant)
    aq = aq.group_by(models.Alert.device_id, models.Alert.severity).all()
    alerts = {}
    for device_id, sev, cnt in aq:
        key = (sev or "info").lower()
        alerts.setdefault(device_id, {})
        alerts[device_id][key] = alerts[device_id].get(key, 0) + cnt

    assets = []
    for dev in devices:
        a = alerts.get(dev.id, {})
        crit = a.get("critical", 0) + a.get("error", 0)
        warn = a.get("warning", 0)
        score = _health_score(dev.status, dev.enabled, dev.last_seen, crit, warn, now)
        age_months = None
        if dev.created_at:
            age_months = round(max((now - dev.created_at).total_seconds() / (3600 * 24 * 30), 0.0), 1)
        assets.append({
            "id": str(dev.id),
            "name": dev.name,
            "site": sites.get(dev.site_id, "") if dev.site_id else "",
            "type": dev.device_type,
            "age_months": age_months,
            "status": dev.status,
            "enabled": dev.enabled,
            "last_seen": dev.last_seen.isoformat() if dev.last_seen else None,
            "health": score,
            "severity": _severity_from_score(score),
            "active_alerts": crit + warn,
            "critical_alerts": crit,
            "anomalies": crit + warn,
            "failure_prob_30d": None,  # not computable with current data
            "failure_prob_90d": None,
            "next_service_days": None,
        })
    return {"assets": assets}

@router.get("/api/maintenance/degradation/{device_id}")
def get_degradation(device_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = _effective_tenant(user)
    q = db.query(models.Device).filter(models.Device.id == device_id)
    if tenant is not None:
        q = q.filter(models.Device.tenant_id == tenant)
    if not q.first():
        raise HTTPException(404, "Asset not found")
    return {
        "asset_id": device_id,
        "computable": False,
        "reason": ("degradation cannot be reliably calculated with current data "
                   "(no irradiance / expected-vs-actual production / capacity history)"),
        "degradation": None,
    }


@router.get("/api/maintenance/schedule")
def get_schedule(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = _effective_tenant(user)
    now = models.utcnow_naive()
    sites = _site_names(db, tenant)

    dq = db.query(models.Device)
    if tenant is not None:
        dq = dq.filter(models.Device.tenant_id == tenant)
    device_info = {}
    for dev in dq.all():
        device_info[dev.id] = (dev.name, dev.status, dev.enabled, dev.site_id, dev.last_seen)

    schedule = []

    # 1) Unacknowledged alerts -> corrective items (severity + aging via fired_at).
    aq = db.query(models.Alert)
    if tenant is not None:
        aq = aq.filter(models.Alert.tenant_id == tenant)
    for al in aq.filter(models.Alert.acknowledged.is_(False)).all():
        rank = _SEVERITY_RANK.get((al.severity or "info").lower(), 1)
        age_days = max((now - (al.fired_at or now)).total_seconds() / 86400.0, 0.0)
        window = {3: 1, 2: 7, 1: 30}.get(rank, 30)  # deterministic maintenance window (days)
        due = (al.fired_at or now) + timedelta(days=window)
        priority = rank * 100 + min(int(age_days), 30)
        info = device_info.get(al.device_id)
        name = al.device_name or (info[0] if info else "") or ""
        site = sites.get(info[3], "") if (info and info[3] is not None) else ""
        schedule.append({
            "id": f"alert-{al.id}",
            "asset_id": str(al.device_id) if al.device_id is not None else None,
            "asset_name": name,
            "site": site,
            "due_date": due.strftime("%d/%m/%Y"),
            "days_remaining": max(int((due - now).total_seconds() // 86400), 0),
            "severity": al.severity or "info",
            "priority": priority,
            "estimated_cost": None,  # no real cost data available
            "type": "corrective" if rank >= 3 else "scheduled",
            "source": f"alert:{al.id}",
        })

    # 2) Offline/error devices -> inspection items.
    for dev_id, (name, status, enabled, site_id, last_seen) in device_info.items():
        if status in ("offline", "error", "fault", "critical"):
            age_days = max((now - (last_seen or now)).total_seconds() / 86400.0, 0.0)
            due = (last_seen or now) + timedelta(days=7)
            priority = 2 * 100 + min(int(age_days), 30)
            schedule.append({
                "id": f"device-{dev_id}",
                "asset_id": str(dev_id),
                "asset_name": name,
                "site": sites.get(site_id, "") if site_id is not None else "",
                "due_date": due.strftime("%d/%m/%Y"),
                "days_remaining": max(int((due - now).total_seconds() // 86400), 0),
                "severity": "warning",
                "priority": priority,
                "estimated_cost": None,
                "type": "inspection",
                "source": f"device:{dev_id}:{status}",
            })

    schedule.sort(key=lambda x: (-x["priority"], x["due_date"]))
    return {"schedule": schedule}

