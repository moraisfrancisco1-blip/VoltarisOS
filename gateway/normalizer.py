"""
Normalised DeviceReading schema — common output of all connectors.
"""
from dataclasses import dataclass, field, asdict
from typing import Optional, Any, Dict
from datetime import datetime


@dataclass
class DeviceReading:
    power_kw: Optional[float] = None
    energy_kwh: Optional[float] = None
    soc_pct: Optional[float] = None
    temp_c: Optional[float] = None
    voltage_v: Optional[float] = None
    current_a: Optional[float] = None
    frequency_hz: Optional[float] = None
    raw: Optional[Dict[str, Any]] = field(default_factory=dict)

    def to_payload(self) -> dict:
        d = asdict(self)
        # Remove None values to keep payload clean
        return {k: v for k, v in d.items() if v is not None}

    def summary(self) -> str:
        parts = []
        if self.power_kw is not None:
            parts.append(f"{self.power_kw:.2f} kW")
        if self.energy_kwh is not None:
            parts.append(f"{self.energy_kwh:.1f} kWh")
        if self.soc_pct is not None:
            parts.append(f"SoC {self.soc_pct:.1f}%")
        if self.temp_c is not None:
            parts.append(f"{self.temp_c:.1f}°C")
        return " | ".join(parts) if parts else "no data"
