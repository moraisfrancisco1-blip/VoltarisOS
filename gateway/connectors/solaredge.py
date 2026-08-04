"""
SolarEdge Monitoring API v1 connector.
Requires: api_key, site_id in config.
Docs: https://knowledge-center.solaredge.com/sites/kc/files/se_monitoring_api.pdf
"""
import httpx
from typing import Optional
from gateway.normalizer import DeviceReading


BASE = "https://monitoringapi.solaredge.com"


async def poll(config: dict) -> Optional[DeviceReading]:
    api_key: str = config["api_key"]
    site_id: str = str(config["site_id"])

    async with httpx.AsyncClient(timeout=10) as client:
        overview = await client.get(
            f"{BASE}/site/{site_id}/overview",
            params={"api_key": api_key},
        )
        overview.raise_for_status()
        data = overview.json().get("overview", {})

    current = data.get("currentPower", {})
    last_day = data.get("lastDayData", {})
    power_w = current.get("power", 0.0)

    return DeviceReading(
        power_kw=power_w / 1000.0,
        energy_kwh=last_day.get("energy", 0.0) / 1000.0,
        raw=data,
    )


async def send_command(config: dict, command: str, value: float) -> dict:
    """SolarEdge cloud API does not support remote setpoints — return info."""
    return {"ok": False, "message": "SolarEdge cloud API is read-only. Use local RS485 for control."}
