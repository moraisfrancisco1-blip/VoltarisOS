"""Weather forecasting using Open-Meteo with provider freshness metadata."""
import httpx
from datetime import datetime, timezone
from typing import Optional

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def get_weather_forecast(lat: float, lon: float, hours: int = 48, *,
                          tilt_deg: float | None = None, azimuth_deg: float | None = None,
                          include_metadata: bool = False):
    """tilt_deg/azimuth_deg, when both given, additionally request Open-Meteo's
    global_tilted_irradiance -- irradiance on the actual panel plane, computed
    server-side from their own radiative-transfer model (not a client-side
    approximation). Convention matches Open-Meteo exactly, passed straight
    through: tilt_deg 0-90 (0=flat), azimuth_deg 0=South, -90=East, 90=West,
    +-180=North. Omit either to get flat-horizontal irradiance (GHI) only."""
    hourly_vars = ["shortwave_radiation", "temperature_2m", "cloud_cover", "wind_speed_10m", "precipitation"]
    request_tilted = tilt_deg is not None and azimuth_deg is not None
    if request_tilted:
        hourly_vars.append("global_tilted_irradiance")
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": hourly_vars,
        "forecast_days": max(1, hours // 24 + 1), "timezone": "auto",
    }
    if request_tilted:
        params["tilt"] = tilt_deg
        params["azimuth"] = azimuth_deg
    with httpx.Client(timeout=15) as client:
        resp = client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    hourly = data["hourly"]
    times = hourly["time"]
    result = []
    for i, t in enumerate(times[:hours]):
        entry = {
            "time": t,
            "shortwave_radiation": hourly["shortwave_radiation"][i],
            "temperature_2m": hourly["temperature_2m"][i],
            "cloud_cover": hourly["cloud_cover"][i],
            "wind_speed_10m": hourly["wind_speed_10m"][i],
            "precipitation": hourly["precipitation"][i],
        }
        if request_tilted:
            entry["global_tilted_irradiance"] = hourly["global_tilted_irradiance"][i]
        result.append(entry)
    if include_metadata:
        return {
            "forecast": result,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "max_age_minutes": 60,
            "source": "Open-Meteo",
        }
    return result


def get_current_irradiance(lat: float, lon: float) -> Optional[float]:
    forecast = get_weather_forecast(lat, lon, hours=2)
    return forecast[0]["shortwave_radiation"] if forecast else None
