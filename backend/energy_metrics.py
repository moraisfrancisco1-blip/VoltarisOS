"""energy_metrics.py — shared, real energy-aggregation helpers.

Extracted out of backend/routers/carbon.py so any router that needs "how
much solar did this tenant actually produce" (carbon overview, savings)
computes it the same way, from the same definition of what counts as solar.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend import models

# Solar-capable device types: readings from these devices are treated as solar
# production. Battery/EV storage devices are excluded so discharge is not
# counted as production.
SOLAR_TYPES = ("solar", "pv", "inverter")


def solar_energy_kwh(db: Session, tenant, start, end, site_id=None) -> float:
    """Real produced solar energy (kWh) in the [start, end) window.

    Primary source: SUM(DeviceReading.energy_kwh) for solar-capable devices of
    the effective tenant. Only if no `energy_kwh` was ever recorded in the window
    do we fall back to a conservative `power_kw` integration (gaps clamped to 1h).
    """
    base = (
        db.query(models.DeviceReading)
        .join(models.Device, models.Device.id == models.DeviceReading.device_id)
        .filter(models.DeviceReading.timestamp >= start)
        .filter(models.DeviceReading.timestamp < end)
        .filter(func.lower(models.Device.device_type).in_(SOLAR_TYPES))
    )
    if site_id is not None:
        base = base.filter(models.Device.site_id == site_id)
    if tenant is not None:
        base = base.filter(models.Device.tenant_id == tenant)

    energy = base.with_entities(
        func.coalesce(func.sum(models.DeviceReading.energy_kwh), 0.0)
    ).scalar() or 0.0
    if energy and energy > 0:
        return round(float(energy), 2)

    has_energy = base.with_entities(func.count(models.DeviceReading.id)).filter(
        models.DeviceReading.energy_kwh.isnot(None)
    ).scalar() or 0
    if has_energy:
        return 0.0  # energy_kwh present but genuinely zero in window

    rows = base.with_entities(
        models.DeviceReading.timestamp, models.DeviceReading.power_kw
    ).order_by(models.DeviceReading.timestamp.asc()).all()
    if not rows:
        return 0.0
    total = 0.0
    for i, (ts, pw) in enumerate(rows):
        if pw is None:
            continue
        nxt = rows[i + 1][0] if i + 1 < len(rows) else end
        dt = (nxt - ts).total_seconds()
        dt = min(max(dt, 0.0), 3600.0)  # clamp gaps to 1h
        total += pw * dt / 3600.0
    return round(total, 2)
