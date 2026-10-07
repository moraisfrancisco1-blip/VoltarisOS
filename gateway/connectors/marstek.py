"""
Marstek Venus (E) connector -- local Open API over UDP (JSON-RPC style).

Runs on a device INSIDE the home network (the battery only answers on the LAN, UDP 30000), so it
lives in the edge gateway, not in the cloud backend. Needs "Open API" switched on in the Marstek app.
Config: {"host": "<battery LAN IP>", "port": 30000 (optional)}.

Written against a real VenusE 3.0 (firmware 148) answer, kept as the fixture in
gateway/test_marstek_connector.py. Only READ methods are ever sent (no Set*), so it cannot change the
battery's mode or schedule.

What is normalised (verified against that sample):
  soc_pct  <- Bat.GetStatus.soc            (bat_capacity / rated_capacity agrees with it)
  temp_c   <- Bat.GetStatus.bat_temp       (degrees C)
Provisional (one observation against the Marstek app): the sign of ES.GetStatus.ongrid_power,
negative = charging. It only feeds raw["marstek"]["battery_state_provisional"].
What is deliberately NOT normalised yet: battery power as power_kw, grid (CT) power and the energy
counters. Their units/signs are not verified (and DeviceReading.power_kw cannot be negative), so the
raw numbers are kept under raw["marstek"]["unverified"] until compared with the Marstek app on more
known states. No identifiers (IP, MAC, Wi-Fi name, src) are stored.
"""
import asyncio
import json
import logging
import socket
import time
from typing import Optional

from gateway.normalizer import DeviceReading

logger = logging.getLogger("voltaris.gateway.marstek")

DEFAULT_PORT = 30000
MIN_INTERVAL_S = 60.0   # the device is reported to become unstable when polled faster
REQUEST_TIMEOUT_S = 5.0
ATTEMPTS = 2
PAUSE_S = 0.3
IDLE_BAND_W = 5.0       # |battery power| below this is reported as idle

# Read-only methods only. PV.GetStatus / EM.GetStatus are not answered by a Venus E (no PV input).
READ_METHODS = ("ES.GetStatus", "ES.GetMode", "Bat.GetStatus")

_IDENTIFIER_KEYS = {"ip", "mac", "wifi_mac", "ble_mac", "wifi_name", "ssid", "bssid", "src"}


def _exchange(host: str, port: int, local_port: int, timeout: float = REQUEST_TIMEOUT_S,
              attempts: int = ATTEMPTS, pause: float = PAUSE_S) -> dict:
    """Send each read method once (retry on silence) and return {method: answer-dict}. The device
    answers to UDP port 30000 on the asking host, hence the fixed local port."""
    from gateway.marstek_probe import _open_socket, _wait_for  # same socket handling as the probe
    answers = {}
    sock = _open_socket(local_port)
    try:
        for msg_id, method in enumerate(READ_METHODS, start=1):
            request = json.dumps({"id": msg_id, "method": method, "params": {"id": 0}}).encode()
            for _ in range(attempts):
                sock.sendto(request, (host, port))
                answer = _wait_for(sock, msg_id, timeout)
                if answer:
                    answers[method] = answer[0]
                    break
            time.sleep(pause)
    finally:
        sock.close()
    return answers


def _result(answers: dict, method: str) -> dict:
    entry = answers.get(method)
    result = entry.get("result") if isinstance(entry, dict) else None
    return result if isinstance(result, dict) else {}


def _number(value) -> Optional[float]:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def parse(answers: dict) -> DeviceReading:
    """Normalise the answers of READ_METHODS. Raises ValueError when nothing usable came back or a
    value is out of range, so a bad answer is an error, never a made-up reading."""
    status = _result(answers, "ES.GetStatus")
    mode = _result(answers, "ES.GetMode")
    battery = _result(answers, "Bat.GetStatus")
    if not (status or mode or battery):
        raise ValueError("the Marstek battery gave no usable answer")

    soc = _number(battery.get("soc"))
    if soc is None:
        soc = _number(status.get("bat_soc"))
    if soc is None:
        soc = _number(mode.get("bat_soc"))
    if soc is not None and not 0 <= soc <= 100:
        raise ValueError(f"Marstek reported an impossible state of charge: {soc}")

    temp = _number(battery.get("bat_temp"))

    # Whatever was measured, kept as the device reported it. Units/signs of this block are unverified.
    unverified = {k: v for k, v in {**status, **mode}.items() if k not in _IDENTIFIER_KEYS and k != "id"}
    # PROVISIONAL (one observation): ES.GetStatus.ongrid_power was -33 W while the Marstek app showed
    # "Opladen" (charging) with "Net 32 W", and the stored energy rose 1320 -> ~1340 Wh in between.
    # So negative = the battery is charging. Needs one more observation while discharging.
    battery_w = _number(status.get("ongrid_power"))
    if battery_w is None:
        battery_w = _number(mode.get("ongrid_power"))
    battery_state = None
    if battery_w is not None:
        battery_state = "charging" if battery_w < -IDLE_BAND_W else "discharging" if battery_w > IDLE_BAND_W else "idle"

    marstek = {
        "mode": mode.get("mode"),
        "battery_state_provisional": battery_state,
        "bat_capacity_wh": _number(battery.get("bat_capacity")),       # energy currently stored
        "rated_capacity_wh": _number(battery.get("rated_capacity")),   # nominal capacity
        "charging_allowed": battery.get("charg_flag"),
        "discharging_allowed": battery.get("dischrg_flag"),
        "unverified": unverified,
    }
    return DeviceReading(soc_pct=soc, temp_c=temp, raw={"marstek": {k: v for k, v in marstek.items() if v is not None}})


class _MinInterval:
    """Makes sure two reads of the same battery are at least `seconds` apart (sleeps if needed)."""

    def __init__(self, seconds: float, clock=time.monotonic):
        self.seconds = seconds
        self.clock = clock
        self._last: dict = {}

    def wait_time(self, key) -> float:
        last = self._last.get(key)
        return 0.0 if last is None else max(0.0, last + self.seconds - self.clock())

    def mark(self, key) -> None:
        self._last[key] = self.clock()


_limiter = _MinInterval(MIN_INTERVAL_S)
_lock: Optional[asyncio.Lock] = None  # all batteries share local UDP port 30000, so one read at a time


async def poll(config: dict) -> Optional[DeviceReading]:
    global _lock
    host = str(config["host"])
    port = int(config.get("port", DEFAULT_PORT))
    if _lock is None:
        _lock = asyncio.Lock()
    async with _lock:
        delay = _limiter.wait_time(host)
        if delay > 0:
            await asyncio.sleep(delay)
        _limiter.mark(host)
        loop = asyncio.get_running_loop()
        answers = await loop.run_in_executor(None, _exchange, host, port, DEFAULT_PORT)
    return parse(answers)
