"""Solar performance ratio (PR) per site and day.

    PR = E / (P_kWp x H)        (IEC 61724: final yield over reference yield)

E is the energy the site's solar devices really produced that LOCAL day (kWh), P_kWp the
installed capacity, and H the irradiation on the panel plane that day (kWh/m2, Open-Meteo
GTI for the site's real tilt and azimuth). Because H is measured on the real plane, PR does
not depend on orientation or on how sunny the day was, so it can be compared across days:
a healthy system sits around 0.75-0.90 and a lasting drop points at soiling, shading or a
fault. It is NOT temperature-corrected, so it dips a little on hot days.

What this deliberately does not do: annual degradation (%/year). That needs at least a year
of data and the response says so instead of showing a number.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func

from backend import models
from backend.energy_metrics import SOLAR_TYPES, solar_energy_kwh
from forecasting.historical_irradiance import get_daily_poa

logger = logging.getLogger(__name__)

MIN_POA_KWH_M2 = 1.0        # below this the sun is too weak for a meaningful ratio
MIN_READINGS = 24           # about two hours of data at the 5-minute cadence
TREND_MIN_VALID_DAYS = 14
TREND_WINDOW_DAYS = 7


def _local_day_bounds_utc(day: date, tz: ZoneInfo):
    """Naive-UTC [start, end) of a local calendar day (the DB stores naive UTC)."""
    start = datetime.combine(day, time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    # The end is the NEXT local midnight, so 23- and 25-hour daylight-saving days are exact.
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    return start, end


def _reading_count(db, tenant_id, site_id, start, end) -> int:
    q = (
        db.query(func.count(models.DeviceReading.id))
        .join(models.Device, models.Device.id == models.DeviceReading.device_id)
        .filter(models.DeviceReading.timestamp >= start, models.DeviceReading.timestamp < end)
        .filter(func.lower(models.Device.device_type).in_(SOLAR_TYPES))
        .filter(models.Device.site_id == site_id)
    )
    if tenant_id is not None:
        q = q.filter(models.Device.tenant_id == tenant_id)
    return int(q.scalar() or 0)


def _mean(values):
    return sum(values) / len(values) if values else None


def compute_site_performance(db, site, days: int = 30, *, poa_provider=None, now=None) -> dict:
    """Daily PR for one site. Never raises for missing data: it returns a `status` instead
    (needs_orientation / needs_location / no_capacity / weather_unavailable / ok)."""
    base = {"site_id": site.id, "name": site.name, "solar_kw": site.solar_kw,
            "tilt_deg": site.tilt_deg, "azimuth_deg": site.azimuth_deg}

    if not site.solar_kw or site.solar_kw <= 0:
        return {**base, "status": "no_capacity", "days": [], "summary": None}
    if site.lat is None or site.lng is None:
        return {**base, "status": "needs_location", "days": [], "summary": None}
    if site.tilt_deg is None or site.azimuth_deg is None:
        return {**base, "status": "needs_orientation", "days": [], "summary": None}

    provider = poa_provider or get_daily_poa
    try:
        tz_name, poa_by_day = provider(site.lat, site.lng, site.tilt_deg, site.azimuth_deg, days)
    except Exception:
        logger.warning("Irradiance history unavailable for site %s", site.id, exc_info=True)
        return {**base, "status": "weather_unavailable", "days": [], "summary": None}

    try:
        tz = ZoneInfo(site.timezone or tz_name or "UTC")
    except Exception:
        tz = ZoneInfo(tz_name or "UTC")
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(tz).date()

    rows = []
    for day_str in sorted(poa_by_day, reverse=True):
        day = date.fromisoformat(day_str)
        if day > today:
            continue
        if len(rows) >= days + 1:  # the requested days plus today
            break
        poa = round(poa_by_day[day_str]["poa_kwh_m2"], 3)
        start, end = _local_day_bounds_utc(day, tz)
        energy = solar_energy_kwh(db, site.tenant_id, start, end, site_id=site.id)
        readings = _reading_count(db, site.tenant_id, site.id, start, end)

        reason = None
        if day == today:
            reason = "day still in progress"
        elif readings < MIN_READINGS:
            reason = "not enough readings"
        elif poa < MIN_POA_KWH_M2:
            reason = "too little sun"
        pr = None
        if reason is None:
            pr = round(energy / (site.solar_kw * poa), 3)
        rows.append({"date": day_str, "energy_kwh": round(energy, 2), "poa_kwh_m2": poa,
                     "readings": readings, "pr": pr, "valid": reason is None, "reason": reason})

    rows.sort(key=lambda r: r["date"])  # chronological
    valid = [r for r in rows if r["valid"]]
    prs = [r["pr"] for r in valid]
    trend_pp = None
    if len(valid) >= TREND_MIN_VALID_DAYS:
        first = _mean(prs[:TREND_WINDOW_DAYS])
        last = _mean(prs[-TREND_WINDOW_DAYS:])
        trend_pp = round((last - first) * 100, 1)  # percentage points, last week vs first week

    summary = {
        "valid_days": len(valid),
        "days_with_data": sum(1 for r in rows if r["readings"] > 0),
        "avg_pr": round(_mean(prs), 3) if prs else None,
        "last7_pr": round(_mean(prs[-TREND_WINDOW_DAYS:]), 3) if prs else None,
        "trend_pp": trend_pp,
        "trend_needs_valid_days": TREND_MIN_VALID_DAYS,
    }
    return {**base, "status": "ok", "timezone": str(tz), "days": rows, "summary": summary}
