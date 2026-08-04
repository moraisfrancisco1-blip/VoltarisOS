"""
Modbus RTU (RS-485 serial) connector.
Config keys:
  port      — serial port, e.g. /dev/ttyUSB0 or COM3
  baudrate  — e.g. 9600, 19200, 38400, 115200
  parity    — N | E | O  (default N)
  stopbits  — 1 | 2 (default 1)
  unit_id   — Modbus slave ID (default 1)
Note: pymodbus sync client used here (RTU over serial is synchronous).
"""
from pymodbus.client import ModbusSerialClient
from pymodbus.payload import BinaryPayloadDecoder
from pymodbus.constants import Endian
from typing import Optional
from gateway.normalizer import DeviceReading
import logging

logger = logging.getLogger(__name__)


def poll(config: dict) -> Optional[DeviceReading]:
    port = config.get("port", "/dev/ttyUSB0")
    baud = int(config.get("baudrate", 9600))
    parity = config.get("parity", "N")
    stopbits = int(config.get("stopbits", 1))
    unit = int(config.get("unit_id", 1))

    client = ModbusSerialClient(
        port=port,
        baudrate=baud,
        parity=parity,
        stopbits=stopbits,
        bytesize=8,
        timeout=3,
    )
    if not client.connect():
        raise ConnectionError(f"Cannot open serial port {port}")

    try:
        reading = _read_registers(client, unit)
    finally:
        client.close()

    return reading


def _read_registers(client, unit: int) -> DeviceReading:
    def r16(addr: int) -> int:
        res = client.read_holding_registers(addr, count=1, slave=unit)
        return res.registers[0] if not res.isError() else 0

    def r32(addr: int) -> int:
        res = client.read_holding_registers(addr, count=2, slave=unit)
        if res.isError():
            return 0
        dec = BinaryPayloadDecoder.fromRegisters(
            res.registers, byteorder=Endian.BIG, wordorder=Endian.BIG
        )
        return dec.decode_32bit_int()

    power_raw = r16(40083)
    power_sf = _sf(r16(40084))
    power_w = power_raw * (10 ** power_sf)

    energy_raw = r32(40093)
    energy_kwh = energy_raw * 0.001

    volt_raw = r16(40079)
    volt_sf = _sf(r16(40080))
    voltage_v = volt_raw * (10 ** volt_sf)

    temp_c = r16(40103) * 0.01
    freq_hz = r16(40085) * 0.01

    return DeviceReading(
        power_kw=power_w / 1000.0,
        energy_kwh=energy_kwh,
        voltage_v=voltage_v,
        temp_c=temp_c,
        frequency_hz=freq_hz,
        raw={"source": "modbus_rtu"},
    )


def _sf(raw: int) -> int:
    if raw > 32767:
        raw -= 65536
    return raw if raw != -32768 else 0


def send_command(config: dict, command: str, value: float) -> dict:
    port = config.get("port", "/dev/ttyUSB0")
    baud = int(config.get("baudrate", 9600))
    unit = int(config.get("unit_id", 1))

    client = ModbusSerialClient(port=port, baudrate=baud, timeout=3)
    if not client.connect():
        return {"ok": False, "message": f"Cannot open {port}"}

    try:
        if command == "power_setpoint_kw":
            pct = min(max(int(value * 100), 0), 10000)
            r = client.write_register(40232, pct, slave=unit)
            client.write_register(40236, 1, slave=unit)
            ok = not r.isError()
        elif command == "disable":
            r = client.write_register(40236, 0, slave=unit)
            ok = not r.isError()
        else:
            return {"ok": False, "message": f"Unknown command: {command}"}
    finally:
        client.close()

    return {"ok": ok, "command": command, "value": value}
