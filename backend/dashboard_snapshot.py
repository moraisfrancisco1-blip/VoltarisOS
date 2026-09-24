"""dashboard_snapshot.py — one tenant's current live metrics, shared between
/ws/dashboard (polled every 5s while the app is open) and the REST
/api/dashboard/snapshot endpoint (polled every ~15-30min by the Android
widget/notification background task, which can't hold a websocket open while
the app is backgrounded or killed). Same query, same shape, one definition.
"""
from sqlalchemy import and_, select, func
from sqlalchemy.orm import Session

from backend import models
from backend.dashboard_metrics import compute_dashboard_metrics


def fetch_dashboard_snapshot(db: Session, tenant_id) -> dict:
    devices = db.query(models.Device.id, models.Device.device_type).filter(
        models.Device.tenant_id == tenant_id,
        models.Device.enabled == True,
    ).all()
    device_ids = [d.id for d in devices]
    device_type_by_id = {d.id: d.device_type for d in devices}

    readings_for_metrics = []
    if device_ids:
        subq = (
            select(
                models.DeviceReading.device_id,
                func.max(models.DeviceReading.timestamp).label('max_ts')
            )
            .where(models.DeviceReading.device_id.in_(device_ids))
            .group_by(models.DeviceReading.device_id)
            .subquery()
        )
        latest_readings = db.query(models.DeviceReading).join(
            subq,
            and_(
                models.DeviceReading.device_id == subq.c.device_id,
                models.DeviceReading.timestamp == subq.c.max_ts
            )
        ).all()
        readings_for_metrics = [
            (device_type_by_id.get(reading.device_id), reading.power_kw, reading.soc_pct)
            for reading in latest_readings
        ]

    metrics = compute_dashboard_metrics(readings_for_metrics)

    latest_bid = db.query(models.VPPBid).filter(
        models.VPPBid.tenant_id == tenant_id
    ).order_by(models.VPPBid.submitted_at.desc()).first()

    return {
        **metrics,
        "active_bids": 1 if latest_bid and latest_bid.status == "pending" else 0,
        "last_bid_status": latest_bid.status if latest_bid else None,
    }
