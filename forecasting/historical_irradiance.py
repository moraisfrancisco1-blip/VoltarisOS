"""Past-day irradiance on the panel plane, from Open-Meteo, for performance-ratio work.

Uses the same forecast endpoint as weather_forecast.py with `past_days`, asking for
global_tilted_irradiance (GTI) -- irradiance on the real tilt/azimuth, computed by
Open-Meteo's own model -- so no client-side transposition is approximated. Times come back
in the site's LOCAL time (timezone=auto) and values in W/m2, hourly: summing the hourly
values of a local day and dividing by 1000 gives that day's irradiation in kWh/m2.

Convention (Open-Meteo, passed straight through): tilt 0-90 (0 = flat), azimuth
0 = South, -90 = East, 90 = West, +-180 = North.
"""
import time

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MAX_PAST_DAYS = 92          # Open-Meteo's limit for past_days
_CACHE_TTL_SECONDS = 1800   # weather history for a day does not change by the minute
_CACHE: dict = {}


def daily_poa_kwh_m2(times, gti):
    """Sum hourly W/m2 samples into kWh/m2 per LOCAL date.

    `times` are local "YYYY-MM-DDTHH:MM" strings (so the date is simply their first 10
    characters). Missing samples (None) count as 0. Returns
    {"YYYY-MM-DD": {"poa_kwh_m2": float, "hours": int}}.
    """
    days: dict = {}
    for t, v in zip(times, gti):
        entry = days.setdefault(str(t)[:10], {"poa_kwh_m2": 0.0, "hours": 0})
        entry["poa_kwh_m2"] += (v or 0.0) / 1000.0
        entry["hours"] += 1
    return days


def fetch_hourly_poa(lat: float, lon: float, tilt_deg: float, azimuth_deg: float, past_days: int) -> dict:
    """Hourly GTI for the last `past_days` days plus today. Cached for 30 minutes."""
    past_days = min(max(int(past_days), 1), MAX_PAST_DAYS)
    key = (round(lat, 3), round(lon, 3), float(tilt_deg), float(azimuth_deg), past_days)
    hit = _CACHE.get(key)
    if hit and time.monotonic() - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1]
    params = {
        "latitude": lat, "longitude": lon,
        "hourly": "global_tilted_irradiance",
        "tilt": tilt_deg, "azimuth": azimuth_deg,
        "past_days": past_days, "forecast_days": 1,
        "timezone": "auto",
    }
    with httpx.Client(timeout=20) as client:
        resp = client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        body = resp.json()
    data = {
        "timezone": body.get("timezone"),
        "times": body["hourly"]["time"],
        "gti": body["hourly"]["global_tilted_irradiance"],
    }
    _CACHE[key] = (time.monotonic(), data)
    return data


def get_daily_poa(lat: float, lon: float, tilt_deg: float, azimuth_deg: float, past_days: int):
    """(timezone name, {local date: {"poa_kwh_m2", "hours"}}) for the last `past_days` days."""
    data = fetch_hourly_poa(lat, lon, tilt_deg, azimuth_deg, past_days)
    return data["timezone"], daily_poa_kwh_m2(data["times"], data["gti"])
