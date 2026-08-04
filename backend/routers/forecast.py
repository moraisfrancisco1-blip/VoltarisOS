"""
Forecast API router.
Returns weather + solar production + price forecast per site.
"""

from fastapi import APIRouter, HTTPException
from forecasting.weather_forecast import get_weather_forecast
from forecasting.solar_forecast import forecast_solar_production
from forecasting.combined_forecast import get_full_forecast
import json
import os

router = APIRouter(prefix="/api/forecast", tags=["forecast"])

SITES_FILE = "sites.json"


def _load_sites():
    if not os.path.exists(SITES_FILE):
        return []
    with open(SITES_FILE, "r") as f:
        return json.load(f)


def _get_site(site_id: int):
    sites = _load_sites()
    for s in sites:
        if s["id"] == site_id:
            return s
    return None


@router.get("/weather/{site_id}")
def weather_forecast(site_id: int, hours: int = 48):
    """Raw weather forecast for a site (irradiance, temperature, cloud cover)."""
    site = _get_site(site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        data = get_weather_forecast(site["lat"], site["lng"], hours=hours)
        return {"site_id": site_id, "site_name": site["name"], "forecast": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather API error: {str(e)}")


@router.get("/solar/{site_id}")
def solar_forecast(site_id: int, hours: int = 48):
    """Solar production forecast for a site based on real weather data."""
    site = _get_site(site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        data = forecast_solar_production(
            lat=site["lat"],
            lon=site["lng"],
            solar_kw=site["solar_kw"],
            hours=hours,
        )
        return {
            "site_id": site_id,
            "site_name": site["name"],
            "solar_kw_installed": site["solar_kw"],
            "forecast": data,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast error: {str(e)}")


@router.get("/combined/{site_id}")
def combined_forecast(site_id: int, hours: int = 48):
    """Full forecast: weather + solar production + price + recommendation."""
    site = _get_site(site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        data = get_full_forecast(
            lat=site["lat"],
            lon=site["lng"],
            solar_kw=site["solar_kw"],
            hours=hours,
        )
        return {
            "site_id": site_id,
            "site_name": site["name"],
            "location": site["location"],
            "solar_kw_installed": site["solar_kw"],
            "battery_kwh": site["battery_kwh"],
            "forecast": data,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast error: {str(e)}")


@router.get("/all-sites")
def all_sites_forecast(hours: int = 24):
    """Quick solar summary for all registered sites."""
    sites = _load_sites()
    results = []
    for site in sites:
        try:
            data = get_full_forecast(
                lat=site["lat"],
                lon=site["lng"],
                solar_kw=site["solar_kw"],
                hours=hours,
            )
            total_kwh = sum(e["estimated_kwh"] for e in data)
            results.append({
                "site_id": site["id"],
                "site_name": site["name"],
                "location": site["location"],
                "solar_kw_installed": site["solar_kw"],
                "forecast_total_kwh": round(total_kwh, 2),
                "hours": hours,
                "next_hour": data[0] if data else None,
            })
        except Exception as e:
            results.append({
                "site_id": site["id"],
                "site_name": site["name"],
                "error": str(e),
            })
    return {"sites": results}
