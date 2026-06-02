"""
OPC-UA connector for wind farm SCADAs.
Config keys:
  url           — e.g. opc.tcp://scada.site.local:4840
  username      — optional
  password      — optional
  node_power    — NodeId string for active power, e.g. "ns=2;i=1001"
  node_energy   — NodeId string for cumulative energy
  node_temp     — NodeId string for generator temp
  node_voltage  — NodeId string for grid voltage
  node_freq     — NodeId string for grid frequency
"""
from asyncua import Client as OpcClient
from typing import Optional
from gateway.normalizer import DeviceReading
import logging

logger = logging.getLogger(__name__)


async def poll(config: dict) -> Optional[DeviceReading]:
    url = config.get("url", "opc.tcp://localhost:4840")
    username = config.get("username")
    password = config.get("password")

    async with OpcClient(url=url, timeout=10) as client:
        if username:
            await client.set_user(username)
            await client.set_password(password or "")

        power_kw = await _safe_read(client, config.get("node_power"))
        energy_kwh = await _safe_read(client, config.get("node_energy"))
        temp_c = await _safe_read(client, config.get("node_temp"))
        voltage_v = await _safe_read(client, config.get("node_voltage"))
        freq_hz = await _safe_read(client, config.get("node_freq"))

    return DeviceReading(
        power_kw=power_kw,
        energy_kwh=energy_kwh,
        temp_c=temp_c,
        voltage_v=voltage_v,
        frequency_hz=freq_hz,
        raw={"source": "opcua", "url": url},
    )


async def _safe_read(client: OpcClient, node_id: Optional[str]) -> Optional[float]:
    if not node_id:
        return None
    try:
        node = client.get_node(node_id)
        val = await node.read_value()
        return float(val)
    except Exception as e:
        logger.warning(f"OPC-UA read {node_id} failed: {e}")
        return None


async def send_command(config: dict, command: str, value: float) -> dict:
    """
    Write a setpoint via OPC-UA.
    config must include 'node_setpoint' NodeId.
    """
    url = config.get("url", "opc.tcp://localhost:4840")
    node_id = config.get("node_setpoint")
    if not node_id:
        return {"ok": False, "message": "node_setpoint not configured"}

    async with OpcClient(url=url, timeout=10) as client:
        node = client.get_node(node_id)
        await node.write_value(value)

    return {"ok": True, "command": command, "value": value, "node": node_id}
