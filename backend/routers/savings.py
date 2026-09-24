"""savings.py — "how much did today's energy activity earn/save this tenant".

Tenant isolation: always derived from the authenticated user, same as
carbon.py. Two real, independently-sourced components, never blended into a
single unlabeled number:

  - solar_value_eur: today's real solar production (backend.energy_metrics,
    the same helper carbon.py uses) x today's average day-ahead price. This is
    NOT "avoided grid cost" -- there is no home-consumption meter, so we can't
    know how much of that solar was actually self-consumed vs exported. It is
    disclosed as an estimate (solar_value_is_estimate: true) for exactly that
    reason.
  - trading_pnl_eur: sum of pnl_eur on this tenant's VPPBid rows accepted
    today. Real and exact -- the same field vpp.py's /performance endpoint
    already sums, just scoped to "today" and across all of the tenant's VPP
    groups instead of one.
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user
from backend.energy_metrics import solar_energy_kwh
from backend.routers.prices import get_day_ahead_prices

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _effective_tenant(user: dict):
    if user.get("role") == "SUPER_ADMIN":
        return None
    return user.get("tenant_id")


def compute_savings(solar_kwh: float, avg_price_eur_kwh: float | None, trading_pnl_eur: float) -> dict:
    """Pure calc, unit-testable without DB/HTTP. avg_price_eur_kwh may be None
    (price feed unavailable) -- in that case solar_value_eur is also None
    rather than silently computed against a fabricated price."""
    solar_value_eur = round(solar_kwh * avg_price_eur_kwh, 2) if avg_price_eur_kwh is not None else None
    trading_pnl_eur = round(trading_pnl_eur, 2)
    total_eur = round((solar_value_eur or 0.0) + trading_pnl_eur, 2)
    return {
        "solar_value_eur": solar_value_eur,
        "trading_pnl_eur": trading_pnl_eur,
        "total_eur": total_eur,
    }


@router.get("/api/savings/today")
async def savings_today(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = _effective_tenant(user)
    now = models.utcnow_naive()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    solar_kwh_today = solar_energy_kwh(db, tenant, day_start, now)

    price_data = await get_day_ahead_prices()
    hourly_prices = price_data.get("prices") if isinstance(price_data, dict) else None
    avg_price_eur_mwh = (
        sum(p["price"] for p in hourly_prices) / len(hourly_prices)
        if hourly_prices else None
    )
    # get_day_ahead_prices' simulated fallback returns EUR/kWh-scale numbers
    # (~0.05-0.17) while a real ENTSO-E response is EUR/MWh -- normalize both
    # to EUR/kWh here so solar_value_eur is always in the same unit as the
    # kWh figure it's multiplied against.
    price_source = price_data.get("source") if isinstance(price_data, dict) else None
    avg_price_eur_kwh = None
    if avg_price_eur_mwh is not None:
        avg_price_eur_kwh = avg_price_eur_mwh if price_source == "simulated" else avg_price_eur_mwh / 1000.0

    bids_q = db.query(models.VPPBid).filter(
        models.VPPBid.status == "accepted",
        models.VPPBid.submitted_at >= day_start,
    )
    if tenant is not None:
        bids_q = bids_q.filter(models.VPPBid.tenant_id == tenant)
    trading_pnl_eur_today = sum((b.pnl_eur or 0.0) for b in bids_q.all())

    result = compute_savings(solar_kwh_today, avg_price_eur_kwh, trading_pnl_eur_today)

    return {
        "date": now.strftime("%Y-%m-%d"),
        "solar_kwh_today": solar_kwh_today,
        "avg_price_eur_kwh": round(avg_price_eur_kwh, 4) if avg_price_eur_kwh is not None else None,
        "price_source": price_source,
        "solar_value_is_estimate": True,
        **result,
    }
