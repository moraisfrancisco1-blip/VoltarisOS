"""
Modbus TCP connector — SunSpec compatible.
Config keys:
  host       — IP address of the inverter / meter
  port       — TCP port (default 502)
  unit_id    — Modbus unit/slave ID (default 1)
  registers  — optional dict: {name: {address, scale, type}}
               if omitted, uses SunSpec auto-discovery
"""
from pymodbus.client import AsyncModbusTcpClient
from pymodbus.constants import Endian
from pymodbus.payload import BinaryPayloadDecoder
from typing import Optional
from gateway.normalizer import DeviceReading


# ── SunSpec well-known registers (Model 103 — Three Phase Inverter) ──────────
SUNSPEC_REGS = {
    "power_w":   {"address": 40083, "count": 1, "scale_reg": 40084},
    "energy_kwh":{"address": 40093, "count": 2},
    "voltage_v": {"address": 40079, "count": 1, "scale_reg": 40080},
    "current_a": {"address": 40072, "count": 1, "scale_reg": 40075},
    "temp_c":    {"address": 40103, "count": 1, "scale": 0.01},
    "freq_hz":   {"address": 40085, "count": 1, "scale": 0.01},
}


async def poll(config: dict) -> Optional[DeviceReading]:
    host = config.get("host", "127.0.0.1")
    port = int(config.get("port", 502))
    unit = int(config.get("unit_id", 1))

    client = AsyncModbusTcpClient(host, port=port)
    if not await client.connect():
        raise ConnectionError(f"Cannot connect to Modbus TCP {host}:{port}")

    try:
        reading = await _read_sunspec(client, unit)
    finally:
        await client.close()

    return reading


async def _read_sunspec(client, unit: int) -> DeviceReading:
    async def read16(addr: int) -> int:
        r = await client.read_holding_registers(addr, count=1, slave=unit)
        if r.isError():
            return 0
        return r.registers[0]

    async def read32(addr: int) -> int:
        r = await client.read_holding_registers(addr, count=2, slave=unit)
        if r.isError():
            return 0
        dec = BinaryPayloadDecoder.fromRegisters(r.registers, byteorder=Endian.BIG, wordorder=Endian.BIG)
        return dec.decode_32bit_int()

    power_raw = await read16(40083)
    power_sf_raw = await read16(40084)
    power_sf = _sunspec_sf(power_sf_raw)
    power_w = power_raw * (10 ** power_sf)

    energy_raw = await read32(40093)
    energy_kwh = energy_raw * 0.001

    volt_raw = await read16(40079)
    volt_sf_raw = await read16(40080)
    volt_sf = _sunspec_sf(volt_sf_raw)
    voltage_v = volt_raw * (10 ** volt_sf)

    temp_raw = await read16(40103)
    temp_c = temp_raw * 0.01

    freq_raw = await read16(40085)
    freq_sf_raw = await read16(40086)
    freq_sf = _sunspec_sf(freq_sf_raw)
    freq_hz = freq_raw * (10 ** freq_sf)

    return DeviceReading(
        power_kw=power_w / 1000.0,
        energy_kwh=energy_kwh,
        voltage_v=voltage_v,
        temp_c=temp_c,
        frequency_hz=freq_hz,
        raw={
            "power_w": power_w,
            "energy_kwh": energy_kwh,
            "voltage_v": voltage_v,
            "temp_c": temp_c,
            "frequency_hz": freq_hz,
        },
    )


def _sunspec_sf(raw: int) -> int:
    """Decode SunSpec scale factor (signed 16-bit)."""
    if raw > 32767:
        raw -= 65536
    return raw if raw != -32768 else 0


async def send_command(config: dict, command: str, value: float) -> dict:
    """
    Send a setpoint command over Modbus TCP.
    command: 'power_setpoint_kw' | 'reactive_power_var' | 'enable' | 'disable'
    """
    host = config.get("host", "127.0.0.1")
    port = int(config.get("port", 502))
    unit = int(config.get("unit_id", 1))

    client = AsyncModbusTcpClient(host, port=port)
    if not await client.connect():
        return {"ok": False, "message": f"Cannot connect to {host}:{port}"}

    try:
        if command == "power_setpoint_kw":
            # SunSpec WMaxLimPct at register 40232 (0–10000 = 0–100%)
            pct = min(max(int(value * 100), 0), 10000)
            r = await client.write_register(40232, pct, slave=unit)
            # Enable WMaxLim_Ena at 40236
            await client.write_register(40236, 1, slave=unit)
            ok = not r.isError()
        elif command == "disable":
            r = await client.write_register(40236, 0, slave=unit)
            ok = not r.isError()
        else:
            return {"ok": False, "message": f"Unknown command: {command}"}
    finally:
        await client.close()

    return {"ok": ok, "command": command, "value": value}
