"""
Weather forecasting using Open-Meteo API (free, no API key needed).
Fetches hourly solar irradiance, temperature and cloud cover for a given lat/lon.
"""

import httpx
from datetime import datetime, timezone
from typing import Optional


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def get_weather_forecast(lat: float, lon: float, hours: int = 48) -> list[dict]:
    """
    Returns hourly weather forecast for a location.

    Each entry contains:
      - time (ISO string)
      - shortwave_radiation (W/m²) — solar irradiance
      - temperature_2m (°C)
      - cloud_cover (%)
      - wind_speed_10m (km/h)
      - precipitation (mm)
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "shortwave_radiation",
            "temperature_2m",
            "cloud_cover",
            "wind_speed_10m",
            "precipitation",
        ],
        "forecast_days": max(1, hours // 24 + 1),
        "timezone": "auto",
    }

    with httpx.Client(timeout=15) as client:
        resp = client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    hourly = data["hourly"]
    times = hourly["time"]

    result = []
    now = datetime.now(timezone.utc)

    for i, t in enumerate(times[:hours]):
        entry = {
            "time": t,
            "shortwave_radiation": hourly["shortwave_radiation"][i],
            "temperature_2m": hourly["temperature_2m"][i],
            "cloud_cover": hourly["cloud_cover"][i],
            "wind_speed_10m": hourly["wind_speed_10m"][i],
            "precipitation": hourly["precipitation"][i],
        }
        result.append(entry)

    return result


def get_current_irradiance(lat: float, lon: float) -> Optional[float]:
    """Returns the current hour's shortwave radiation (W/m²)."""
    forecast = get_weather_forecast(lat, lon, hours=2)
    if forecast:
        return forecast[0]["shortwave_radiation"]
    return None
