"""Translate optimizer dispatch into safe device setpoints.

Physical device writes are intentionally not implemented yet. The executor defaults
and currently only supports dry-run output, giving us a safe contract for the future
inverter/charger gateways.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class Setpoint:
    device_id: int
    site_id: int | None
    asset_id: str
    device_type: str
    hour: int
    power_kw: float
    action: str
    mode: str = "dry_run"


class DispatchExecutor:
    """Convert optimizer asset dispatch into device-level setpoints."""

    def __init__(self, mode: str = "dry_run"):
        if mode != "dry_run":
            raise ValueError("Physical execution is not enabled; only dry_run is supported")
        self.mode = mode

    def build_setpoints(self, devices: List[Any], asset_dispatch: Dict[str, List[float]]) -> List[Setpoint]:
        """Build validated setpoints without writing to physical equipment."""
        device_by_asset = {f"device-{device.id}": device for device in devices}
        setpoints: List[Setpoint] = []

        for asset_id, series in asset_dispatch.items():
            device = device_by_asset.get(asset_id)
            if device is None:
                continue

            kind = (device.device_type or "").lower()
            config = device.config or {}
            max_charge = self._number(config, "max_charge_kw", "charge_kw", default=0.0)
            max_discharge = self._number(config, "max_discharge_kw", "discharge_kw", default=0.0)
            max_power = self._number(config, "max_power_kw", "power_kw", default=0.0)

            for hour, raw_value in enumerate(series):
                value = float(raw_value or 0.0)
                action = "hold"

                if kind in {"battery", "bess", "storage"}:
                    # Optimizer convention: positive = discharge, negative = charge.
                    value = max(-max_charge, min(max_discharge, value))
                    action = "discharge" if value > 0 else "charge" if value < 0 else "hold"
                elif kind in {"ev", "ev_charger", "ev_charger_fleet"}:
                    # EV dispatch is negative while charging.
                    value = max(-max_charge, min(0.0, value))
                    action = "charge" if value < 0 else "hold"
                elif kind in {"flexible_load", "load", "industrial_load"}:
                    value = max(0.0, min(max_power, value))
                    action = "consume" if value > 0 else "hold"
                else:
                    continue

                setpoints.append(Setpoint(
                    device_id=device.id,
                    site_id=device.site_id,
                    asset_id=asset_id,
                    device_type=kind,
                    hour=hour,
                    power_kw=round(value, 3),
                    action=action,
                    mode=self.mode,
                ))

        return setpoints

    @staticmethod
    def _number(config: dict, *keys: str, default: float) -> float:
        for key in keys:
            try:
                if config.get(key) is not None:
                    return float(config[key])
            except (TypeError, ValueError):
                pass
        return default

    def execute(self, setpoints: List[Setpoint]) -> Dict[str, Any]:
        """Return the dry-run command plan; never writes to a physical device."""
        return {
            "mode": self.mode,
            "executed": False,
            "physical_control": "not_connected",
            "setpoint_count": len(setpoints),
            "setpoints": [sp.__dict__ for sp in setpoints],
        }
