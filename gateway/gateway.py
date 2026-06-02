"""
VoltarisOS Edge Gateway
─────────────────────────────────────────────────────────────────────────────
Runs as a background service (on-prem or edge device).
Polls all enabled devices from the backend API, normalises readings,
and pushes them back via POST /api/devices/{id}/ingest.

Usage:
  python -m gateway.gateway --api http://localhost:8000 --interval 30

Environment variables (override CLI flags):
  VOLTARIS_API_URL      — backend URL
  VOLTARIS_API_KEY      — Bearer token (if auth enabled)
  GATEWAY_INTERVAL      — polling interval in seconds (default 30)
"""
import asyncio
import httpx
import logging
import argparse
import os
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("voltaris.gateway")

# ── Connector registry ────────────────────────────────────────────────────────
from gateway.connectors import solaredge, modbus_tcp, opcua_client
from gateway.connectors import modbus_rtu          # sync — run in executor


ASYNC_CONNECTORS = {
    "solaredge": solaredge.poll,
    "modbus_tcp": modbus_tcp.poll,
    "opcua": opcua_client.poll,
}

SYNC_CONNECTORS = {
    "modbus_rtu": modbus_rtu.poll,
}

# Vendor HTTP APIs — treated like SolarEdge (httpx async polling)
HTTP_API_PROTOCOLS = {"fronius", "huawei", "sma"}


async def poll_device(device: dict, api_url: str, headers: dict) -> None:
    device_id = device["id"]
    protocol = device["protocol"]
    config = device["config"]
    name = device["name"]

    try:
        if protocol in ASYNC_CONNECTORS:
            reading = await ASYNC_CONNECTORS[protocol](config)
        elif protocol in SYNC_CONNECTORS:
            loop = asyncio.get_event_loop()
            reading = await loop.run_in_executor(None, SYNC_CONNECTORS[protocol], config)
        elif protocol in HTTP_API_PROTOCOLS:
            # Generic HTTP vendor polling
            reading = await _poll_http_vendor(protocol, config)
        else:
            logger.warning(f"[{name}] Unknown protocol '{protocol}' — skipping")
            return

        if reading is None:
            logger.warning(f"[{name}] connector returned None")
            return

        payload = reading.to_payload()
        async with httpx.AsyncClient(timeout=10, headers=headers) as client:
            r = await client.post(f"{api_url}/api/devices/{device_id}/ingest", json=payload)
            r.raise_for_status()

        logger.info(f"[{name}] ✓ {reading.summary()}")

    except Exception as e:
        logger.error(f"[{name}] ✗ {e}")
        # Mark device offline
        try:
            async with httpx.AsyncClient(timeout=5, headers=headers) as client:
                await client.put(
                    f"{api_url}/api/devices/{device_id}",
                    json={"config": config},  # PUT to trigger status update
                )
        except Exception:
            pass


async def _poll_http_vendor(protocol: str, config: dict):
    """Generic polling for Fronius / SMA / Huawei — returns normalised reading."""
    from gateway.normalizer import DeviceReading
    host = config.get("host", "")
    if protocol == "fronius":
        url = f"http://{host}/solar_api/v1/GetInverterRealtimeData.cgi?Scope=System"
        async with httpx.AsyncClient(timeout=8, verify=False) as c:
            r = await c.get(url)
            r.raise_for_status()
            body = r.json()
        # Fronius response: Body.Data.PAC.Value = active power in W
        try:
            pac = body["Body"]["Data"]["PAC"]["Value"]
            power_kw = pac / 1000.0
        except (KeyError, TypeError):
            power_kw = None
        return DeviceReading(power_kw=power_kw, raw=body)

    elif protocol == "sma":
        url = f"https://{host}/dyn/getDashValues.json"
        async with httpx.AsyncClient(timeout=8, verify=False) as c:
            r = await c.post(url, json={"destDev": []})
            r.raise_for_status()
            body = r.json()
        return DeviceReading(raw=body)

    elif protocol == "huawei":
        # Huawei FusionSolar — login then get real-time data
        token = config.get("token")
        plant_id = config.get("plant_id")
        if not token or not plant_id:
            return None
        url = f"https://{host}/rest/pvms/web/station/v1/overview/energy-flow?stationDn={plant_id}"
        headers = {"XSRF-TOKEN": token}
        async with httpx.AsyncClient(timeout=8, verify=False, headers=headers) as c:
            r = await c.get(url)
            r.raise_for_status()
            body = r.json()
        return DeviceReading(raw=body)

    return None


async def run(api_url: str, api_key: str, interval: int) -> None:
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    logger.info(f"Gateway starting — API: {api_url}, interval: {interval}s")

    while True:
        try:
            async with httpx.AsyncClient(timeout=10, headers=headers) as client:
                r = await client.get(f"{api_url}/api/devices")
                r.raise_for_status()
                devices = r.json()

            enabled = [d for d in devices if d.get("enabled", True)]
            logger.info(f"Polling {len(enabled)} device(s)…")

            await asyncio.gather(*[poll_device(d, api_url, headers) for d in enabled])

        except Exception as e:
            logger.error(f"Gateway loop error: {e}")

        await asyncio.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="VoltarisOS Edge Gateway")
    parser.add_argument("--api", default=os.getenv("VOLTARIS_API_URL", "http://localhost:8000"))
    parser.add_argument("--key", default=os.getenv("VOLTARIS_API_KEY", ""))
    parser.add_argument("--interval", type=int, default=int(os.getenv("GATEWAY_INTERVAL", "30")))
    args = parser.parse_args()
    asyncio.run(run(args.api, args.key, args.interval))


if __name__ == "__main__":
    main()
