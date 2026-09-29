"""
gateway/connectors/alfen_eve.py
================================
Alfen Eve Pro-line Single — Modbus TCP connector for VoltarisOS.

Handles:
- Reading charger status, power, current, session energy
- Writing charge current setpoint (A x10 per Alfen spec)
- Pause / resume session via availability register
- Solar-first optimisation logic (surplus -> current setpoint)

Register map: Alfen Eve Pro-line Modbus TCP Interface v3.8
"""

import logging
from typing import Optional
from pymodbus.client import AsyncModbusTcpClient

log = logging.getLogger("voltaris.alfen")


# --- Register Map -------------------------------------------------------------

class R:
    """Alfen Eve Pro-line Modbus register addresses."""
    # Input registers (FC04) - read-only
    STATUS          = 1200
    CURRENT_L1      = 1201
    CURRENT_L2      = 1202
    CURRENT_L3      = 1203
    POWER_TOTAL     = 1208
    ENERGY_SESSION  = 1210
    VOLTAGE_L1      = 1220

    # Holding registers (FC03 read / FC06 write)
    MAX_CURRENT     = 1210   # A x 10
    AVAILABILITY    = 1280   # 1=allow, 0=block

    STATUS_NAMES = {
        0: "available", 1: "preparing", 2: "charging",
        3: "suspended", 4: "finishing", 5: "faulted",
    }


# --- Low-level client ---------------------------------------------------------

class AlfenModbusClient:
    def __init__(self, host: str, port: int = 502, slave_id: int = 1, timeout: int = 5):
        self.host = host
        self.port = port
        self.slave_id = slave_id
        self._client = AsyncModbusTcpClient(host, port=port, timeout=timeout)

    async def connect(self) -> bool:
        await self._client.connect()
        if self._client.connected:
            log.info(f"Alfen connected at {self.host}:{self.port}")
            return True
        log.error(f"Alfen connection failed at {self.host}:{self.port}")
        return False

    def close(self):
        self._client.close()

    async def read_input(self, register: int, count: int = 1) -> Optional[list]:
        try:
            r = await self._client.read_input_registers(
                address=register, count=count, slave=self.slave_id
            )
            return None if r.isError() else r.registers
        except Exception as e:
            log.warning(f"read_input({register}) error: {e}")
            return None

    async def write_holding(self, register: int, value: int) -> bool:
        try:
            r = await self._client.write_register(
                address=register, value=value, slave=self.slave_id
            )
            return not r.isError()
        except Exception as e:
            log.warning(f"write_holding({register}={value}) error: {e}")
            return False


# --- poll() - called by gateway every 30s ------------------------------------

async def poll(config: dict) -> dict:
    client = AlfenModbusClient(
        host=config.get("host", "192.168.1.65"),
        port=int(config.get("port", 502)),
        slave_id=int(config.get("slave_id", 1)),
    )
    connected = await client.connect()
    if not connected:
        raise ConnectionError(f"Cannot connect to Alfen at {config.get('host')}")

    try:
        status_reg  = await client.read_input(R.STATUS)
        current_l1  = await client.read_input(R.CURRENT_L1)
        current_l2  = await client.read_input(R.CURRENT_L2)
        current_l3  = await client.read_input(R.CURRENT_L3)
        power_reg   = await client.read_input(R.POWER_TOTAL)
        energy_reg  = await client.read_input(R.ENERGY_SESSION)
        voltage_reg = await client.read_input(R.VOLTAGE_L1)

        status_code = status_reg[0] if status_reg else 5
        status_name = R.STATUS_NAMES.get(status_code, "unknown")

        return {
            "device_type": "ev_charger",
            "brand": "alfen",
            "model": "eve_pro_single",
            "status": status_name,
            "status_code": status_code,
            "is_charging": status_code == 2,
            "is_available": status_code == 0,
            "current_l1_a": (current_l1[0] / 10.0) if current_l1 else None,
            "current_l2_a": (current_l2[0] / 10.0) if current_l2 else None,
            "current_l3_a": (current_l3[0] / 10.0) if current_l3 else None,
            "power_kw":     (power_reg[0] / 1000.0) if power_reg else None,
            "session_energy_kwh": (energy_reg[0] / 1000.0) if energy_reg else None,
            "voltage_l1_v": (voltage_reg[0] / 10.0) if voltage_reg else None,
        }
    finally:
        client.close()


# --- send_command() - called by optimiser & API ------------------------------

async def send_command(config: dict, command: str, value: float = 0.0) -> dict:
    client = AlfenModbusClient(
        host=config.get("host", "192.168.1.65"),
        port=int(config.get("port", 502)),
        slave_id=int(config.get("slave_id", 1)),
    )
    min_amps = float(config.get("min_amps", 5))
    max_amps = float(config.get("max_amps", 16))

    connected = await client.connect()
    if not connected:
        return {"ok": False, "message": f"Cannot connect to Alfen at {config.get('host')}"}

    try:
        if command == "set_current":
            clamped = max(min_amps, min(float(value), max_amps))
            raw = int(clamped * 10)
            ok = await client.write_holding(R.MAX_CURRENT, raw)
            log.info(f"set_current -> {clamped}A ({'ok' if ok else 'FAILED'})")
            return {"ok": ok, "command": command, "amps": clamped, "raw": raw}

        elif command == "pause":
            ok = await client.write_holding(R.AVAILABILITY, 0)
            log.info(f"pause -> {'ok' if ok else 'FAILED'}")
            return {"ok": ok, "command": "pause"}

        elif command == "resume":
            ok = await client.write_holding(R.AVAILABILITY, 1)
            log.info(f"resume -> {'ok' if ok else 'FAILED'}")
            return {"ok": ok, "command": "resume"}

        else:
            return {"ok": False, "message": f"Unknown command: {command}"}
    finally:
        client.close()


# --- solar_optimise() - called by background task every 30s ------------------

async def solar_optimise(config: dict, solar_surplus_kw: float, spot_price_eur: float) -> dict:
    """
    Solar-first EV charging for Ivo: 3x25A, P1 load balancing, Tesla min 5A.
    Load balancing via P1 is handled inside the Alfen - we set target current
    and the charger reduces it internally to protect the 25A fuses.
    """
    phases       = int(config.get("phases", 3))
    min_amps     = float(config.get("min_amps", 5))
    max_amps     = float(config.get("max_amps", 16))
    start_kw     = float(config.get("solar_start_kw", 3.5))
    price_pause  = float(config.get("price_pause_above", 0.18))
    price_resume = float(config.get("price_resume_below", 0.10))

    solar_amps = (solar_surplus_kw * 1000) / (230.0 * phases)

    if solar_surplus_kw >= start_kw:
        target = min(solar_amps, max_amps)
        await send_command(config, "resume")
        result = await send_command(config, "set_current", target)
        action = "solar_charging"
        reason = f"Solar {solar_surplus_kw:.1f} kW -> {target:.1f}A per phase"

    elif spot_price_eur <= price_resume:
        await send_command(config, "resume")
        result = await send_command(config, "set_current", max_amps)
        action = "price_charging"
        reason = f"Spot {spot_price_eur:.3f} EUR/kWh (cheap) -> max {max_amps}A"

    elif spot_price_eur >= price_pause:
        result = await send_command(config, "pause")
        action = "paused"
        reason = f"Spot {spot_price_eur:.3f} EUR/kWh (high), solar {solar_surplus_kw:.1f} kW"

    else:
        action = "holding"
        reason = f"Price {spot_price_eur:.3f} EUR/kWh, solar {solar_surplus_kw:.1f} kW - holding"
        result = {"ok": True}

    log.info(f"[EV OPTIMISER] {action}: {reason}")
    return {
        "action": action,
        "reason": reason,
        "solar_surplus_kw": solar_surplus_kw,
        "spot_price_eur": spot_price_eur,
        "command_result": result,
    }
