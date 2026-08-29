"""Carbon / CO2 overview — real data integration.

Tenant isolation: the tenant is ALWAYS derived from the authenticated user (JWT),
never from query/body. Energy is aggregated from real `DeviceReading` rows of the
effective tenant; no random/hardcoded operational data is returned.

CO2 conversion uses the configurable `settings.CO2_PER_KWH_KG` (EU grid-average
reference 0.233 kg CO2e/kWh). Derived figures (certificates, trees, car-km,
flights) are documented estimates computed deterministically from real energy —
they are NOT direct measurements.
"""
from fastapi import APIRouter, Depends
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user
from backend.config import settings

router = APIRouter()

# Configurable CO2e factor (kg CO2e per kWh) — see backend/config.py.
CO2_PER_KWH = settings.CO2_PER_KWH_KG

# Derived-estimate factors (documented, deterministic — NOT measurements).
_KG_CO2_PER_TREE_YEAR = 21.0     # kg CO2 sequestered per tree per year (estimate)
_KG_CO2_PER_CAR_KM = 0.12        # kg CO2 per car-km avoided (estimate)
_KG_CO2_PER_FLIGHT_KM = 0.255    # kg CO2 per passenger flight-km (estimate)

# Solar-capable device types: readings from these devices are treated as solar
# production. Battery/EV storage devices are excluded so discharge is not
# counted as production.
SOLAR_TYPES = ("solar", "pv", "inverter")

_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
           "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


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


def _solar_energy_kwh(db: Session, tenant, start, end, site_id=None) -> float:
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


def _score_for_capacity_factor(perf):
    """Deterministic score bucket from today's capacity factor (%), documented."""
    if perf is None:
        return "N/A"
    if perf >= 50:
        return "A+"
    if perf >= 30:
        return "A"
    if perf >= 15:
        return "B"
    if perf >= 5:
        return "C"
    return "D"

@router.get("/api/carbon/overview")
def carbon_overview(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = _effective_tenant(user)
    now = models.utcnow_naive()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    hours_today = max((now - day_start).total_seconds() / 3600.0, 1.0)

    solar_today_kwh = _solar_energy_kwh(db, tenant, day_start, now)
    solar_month_kwh = _solar_energy_kwh(db, tenant, month_start, now)
    solar_year_kwh = _solar_energy_kwh(db, tenant, year_start, now)

    co2_today = round(solar_today_kwh * CO2_PER_KWH, 1)
    co2_month = round(solar_month_kwh * CO2_PER_KWH, 1)
    co2_year = round(solar_year_kwh * CO2_PER_KWH, 1)

    monthly = []
    for m in range(1, now.month + 1):
        ms = datetime(now.year, m, 1)
        me = datetime(now.year, m + 1, 1) if m < 12 else datetime(now.year + 1, 1, 1)
        mq = (
            db.query(func.coalesce(func.sum(models.DeviceReading.energy_kwh), 0.0))
            .join(models.Device, models.Device.id == models.DeviceReading.device_id)
            .filter(models.DeviceReading.timestamp >= ms)
            .filter(models.DeviceReading.timestamp < me)
            .filter(func.lower(models.Device.device_type).in_(SOLAR_TYPES))
        )
        if tenant is not None:
            mq = mq.filter(models.Device.tenant_id == tenant)
        kwh = mq.scalar() or 0.0
        monthly.append({
            "month": _MONTHS[m - 1],
            "co2_avoided": round(kwh * CO2_PER_KWH, 1),
            "kwh": round(kwh, 0),
            "certificates": round(kwh / 1000.0, 1),
        })

    sites_out = []
    sq = db.query(models.Site)
    if tenant is not None:
        sq = sq.filter(models.Site.tenant_id == tenant)
    for s in sq.order_by(models.Site.name.asc()).all():
        skwh = _solar_energy_kwh(db, tenant, day_start, now, site_id=s.id)
        cap = s.solar_kw or 0.0
        perf = round((skwh / (cap * hours_today)) * 100.0, 1) if cap > 0 else None
        sites_out.append({
            "name": s.name,
            "score": _score_for_capacity_factor(perf),
            "co2_avoided_kg": round(skwh * CO2_PER_KWH, 1),
            "performance_ratio": perf,  # capacity factor today (%)
            "certificates": round(skwh / 1000.0, 2),
            "site_id": s.id,
            "solar_kw": round(cap, 1),
        })

    return {
        "co2_today_kg": co2_today,
        "co2_month_kg": co2_month,
        "co2_year_kg": co2_year,
        "solar_today_kwh": solar_today_kwh,
        "solar_month_kwh": round(solar_month_kwh, 2),
        "solar_year_kwh": round(solar_year_kwh, 2),
        "certificates_month": round(solar_month_kwh / 1000.0, 2),
        "certificates_year": round(solar_year_kwh / 1000.0, 2),
        "trees_equivalent": round(co2_year / _KG_CO2_PER_TREE_YEAR, 0),
        "car_km_avoided": round(co2_year / _KG_CO2_PER_CAR_KM, 0),
        "flights_avoided": round(co2_year / _KG_CO2_PER_FLIGHT_KM, 1),
        "monthly": monthly,
        "sites": sites_out,
    }
