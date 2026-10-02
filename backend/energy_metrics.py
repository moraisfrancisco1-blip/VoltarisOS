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


def hourly_energy_kwh(db: Session, tenant, start, end, site_id=None, fallback_to_power=True) -> float:
    """Solar energy (kWh) in [start, end) from hours that retention already
    summarised into device_readings_hourly (backend/retention.py).

    Hours older than the raw-telemetry window live ONLY there, so any reader that
    looks back further than that window must add this to its raw-reading total.
    An hour is in exactly one of the two tables, so the sum never double counts.
    `fallback_to_power` mirrors solar_energy_kwh: hours where the device never
    reported energy_kwh use the energy integrated from power instead.
    """
    h = models.DeviceReadingHourly
    energy = (func.coalesce(h.energy_kwh_sum, h.energy_from_power_kwh, 0.0)
              if fallback_to_power else func.coalesce(h.energy_kwh_sum, 0.0))
    q = (
        db.query(func.coalesce(func.sum(energy), 0.0))
        .join(models.Device, models.Device.id == h.device_id)
        .filter(h.hour_start >= start)
        .filter(h.hour_start < end)
        .filter(func.lower(models.Device.device_type).in_(SOLAR_TYPES))
    )
    if site_id is not None:
        q = q.filter(models.Device.site_id == site_id)
    if tenant is not None:
        q = q.filter(models.Device.tenant_id == tenant)
    return float(q.scalar() or 0.0)


def solar_energy_kwh(db: Session, tenant, start, end, site_id=None) -> float:
    """Real produced solar energy (kWh) in the [start, end) window: recent raw
    readings plus hours already summarised by the retention job."""
    raw = _raw_solar_energy_kwh(db, tenant, start, end, site_id)
    return round(raw + hourly_energy_kwh(db, tenant, start, end, site_id), 2)


def _raw_solar_energy_kwh(db: Session, tenant, start, end, site_id=None) -> float:
    """Raw-readings part of solar_energy_kwh.

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
