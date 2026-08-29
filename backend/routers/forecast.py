"""
Forecast API router.
Returns weather + solar production + price forecast per site.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from forecasting.weather_forecast import get_weather_forecast
from forecasting.solar_forecast import forecast_solar_production
from forecasting.combined_forecast import get_full_forecast

from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


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


def _get_site(db: Session, site_id: int, user: dict):
    q = db.query(models.Site).filter(models.Site.id == site_id)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.Site.tenant_id == tenant)
    return q.first()


@router.get("/weather/{site_id}")
def weather_forecast(site_id: int, hours: int = 48, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Raw weather forecast for a site (irradiance, temperature, cloud cover)."""
    site = _get_site(db, site_id, user)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        data = get_weather_forecast(site.lat, site.lng, hours=hours)
        return {"site_id": site_id, "site_name": site.name, "forecast": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather API error: {str(e)}")


@router.get("/solar/{site_id}")
def solar_forecast(site_id: int, hours: int = 48, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Solar production forecast for a site based on real weather data."""
    site = _get_site(db, site_id, user)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        data = forecast_solar_production(
            lat=site.lat,
            lon=site.lng,
            solar_kw=site.solar_kw,
            hours=hours,
        )
        return {
            "site_id": site_id,
            "site_name": site.name,
            "solar_kw_installed": site.solar_kw,
            "forecast": data,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast error: {str(e)}")


@router.get("/combined/{site_id}")
def combined_forecast(site_id: int, hours: int = 48, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Full forecast: weather + solar production + price + recommendation."""
    site = _get_site(db, site_id, user)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    try:
        data = get_full_forecast(
            lat=site.lat,
            lon=site.lng,
            solar_kw=site.solar_kw,
            hours=hours,
        )
        return {
            "site_id": site_id,
            "site_name": site.name,
            "location": site.location,
            "solar_kw_installed": site.solar_kw,
            "battery_kwh": site.battery_kwh,
            "forecast": data,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast error: {str(e)}")


@router.get("/all-sites")
def all_sites_forecast(hours: int = 24, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Quick solar summary for all sites visible to the authenticated tenant."""
    q = db.query(models.Site)
    tenant = _effective_tenant(user)
    if tenant is not None:
        q = q.filter(models.Site.tenant_id == tenant)
    sites = q.all()
    results = []
    for site in sites:
        try:
            data = get_full_forecast(
                lat=site.lat,
                lon=site.lng,
                solar_kw=site.solar_kw,
                hours=hours,
            )
            total_kwh = sum(e["estimated_kwh"] for e in data)
            results.append({
                "site_id": site.id,
                "site_name": site.name,
                "location": site.location,
                "solar_kw_installed": site.solar_kw,
                "forecast_total_kwh": round(total_kwh, 2),
                "hours": hours,
                "next_hour": data[0] if data else None,
            })
        except Exception as e:
            results.append({
                "site_id": site.id,
                "site_name": site.name,
                "error": str(e),
            })
    return {"sites": results}


@router.get("/backtest/load/{tenant_id}")
def load_forecast_backtest(tenant_id: int):
    """Evaluate P10/P50/P90 load forecasting against persisted tenant telemetry."""
    from backend.database import SessionLocal
    from backend import models
    from forecasting.device_backtest import backtest_tenant_load

    db = SessionLocal()
    try:
        result = backtest_tenant_load(db, models, tenant_id)
        if result["status"] == "insufficient_data":
            raise HTTPException(status_code=422, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backtest error: {exc}")
    finally:
        db.close()
