"""dashboard_metrics.py — pure aggregation for the /ws/dashboard live feed.

Extracted out of backend/routers/websocket.py so the bucketing logic (which
device types count as "solar" vs "battery" vs neither) is unit-testable
without spinning up a websocket connection or a database.
"""
from backend.energy_metrics import SOLAR_TYPES

BATTERY_TYPES = ("battery",)


def compute_dashboard_metrics(readings):
    """readings: iterable of (device_type: str | None, power_kw: float | None, soc_pct: float | None).

    Returns the dict shape sent over /ws/dashboard. total_power_kw / avg_soc_pct
    / device_count reproduce the arithmetic that was previously inlined in
    websocket.py EXACTLY (including its 0.5 starting baseline and dividing the
    soc sum by device_count rather than by the count of readings that actually
    had a soc_pct) -- this is a behavior-preserving extraction, not a fix, so
    Home's already-shipped "Avg SOC" figure doesn't shift. solar_kw / battery_kw
    are the only new thing, bucketed via the same SOLAR_TYPES set carbon.py uses.
    """
    total_power = 0.0
    solar_power = 0.0
    battery_power = 0.0
    avg_soc = 0.5
    device_count = 0

    for device_type, power_kw, soc_pct in readings:
        if power_kw:
            total_power += power_kw
            device_count += 1
            dt = (device_type or "").lower()
            if dt in SOLAR_TYPES:
                solar_power += power_kw
            elif dt in BATTERY_TYPES:
                battery_power += power_kw
        if soc_pct:
            avg_soc += soc_pct

    if device_count > 0:
        avg_soc = avg_soc / device_count / 100  # Convert to 0-1

    return {
        "total_power_kw": round(total_power, 2),
        "solar_kw": round(solar_power, 2),
        "battery_kw": round(battery_power, 2),
        "avg_soc_pct": round(avg_soc * 100, 1),
        "device_count": device_count,
    }
