"""Weather forecasting using Open-Meteo with provider freshness metadata."""
import httpx
from datetime import datetime, timezone
from typing import Optional

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def get_weather_forecast(lat: float, lon: float, hours: int = 48, *, include_metadata: bool = False):
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": ["shortwave_radiation", "temperature_2m", "cloud_cover", "wind_speed_10m", "precipitation"],
        "forecast_days": max(1, hours // 24 + 1), "timezone": "auto",
    }
    with httpx.Client(timeout=15) as client:
        resp = client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    hourly = data["hourly"]
    times = hourly["time"]
    result = []
    for i, t in enumerate(times[:hours]):
        result.append({
            "time": t,
            "shortwave_radiation": hourly["shortwave_radiation"][i],
            "temperature_2m": hourly["temperature_2m"][i],
            "cloud_cover": hourly["cloud_cover"][i],
            "wind_speed_10m": hourly["wind_speed_10m"][i],
            "precipitation": hourly["precipitation"][i],
        })
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
