"""Inputs the persisted forecast (backend.tasks.run_forecasting) needs, taken from real data.

The task used to read latitude, longitude and solar capacity from the tenant, but the tenant
has none of those: location, capacity and panel orientation live on its Sites. So the solar
forecast is the sum of one forecast per site, each with the site's own location, capacity,
tilt and azimuth.
"""
from __future__ import annotations

from backend import models
from forecasting.contracts import ProviderMetadata
from forecasting.solar_forecast import forecast_solar_production


def solar_forecast_from_sites(db, tenant_id: int, hours: int = 24, *, solar_provider=None):
    """Hourly solar energy (kWh) summed over the tenant's sites, plus the provider metadata.

    Only sites with a location and a positive solar capacity count. Raises RuntimeError with a
    message the user can act on when there are none."""
    provider = solar_provider or forecast_solar_production
    sites = (
        db.query(models.Site)
        .filter(models.Site.tenant_id == tenant_id)
        .filter(models.Site.solar_kw > 0)
        .filter(models.Site.lat.isnot(None), models.Site.lng.isnot(None))
        .order_by(models.Site.id.asc())
        .all()
    )
    if not sites:
        raise RuntimeError("solar forecast needs a site with a location and a solar capacity")

    totals = [0.0] * hours
    generated = []
    max_age = 60
    for site in sites:
        response = provider(float(site.lat), float(site.lng), float(site.solar_kw), hours=hours,
                            tilt_deg=site.tilt_deg, azimuth_deg=site.azimuth_deg, include_metadata=True)
        series = [float(item["estimated_kwh"]) for item in response["forecast"][:hours]]
        if len(series) < hours:
            raise RuntimeError(f"solar forecast for site {site.id} returned {len(series)} of {hours} hours")
        totals = [t + v for t, v in zip(totals, series)]
        generated.append(response["generated_at"])
        max_age = min(max_age, int(response["max_age_minutes"]))
    # The oldest retrieval is the one that limits how fresh the whole forecast is.
    return [round(v, 3) for v in totals], ProviderMetadata("Open-Meteo", min(generated), max_age)
