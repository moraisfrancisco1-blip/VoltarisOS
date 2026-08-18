from dataclasses import dataclass, field
from typing import List


@dataclass
class AssetSimulation:
    asset_id: str
    asset_type: str
    power_kw: List[float]
    energy_kwh: List[float] = field(default_factory=list)


@dataclass
class IndustrialLoadSimulator:
    asset_id: str
    baseline_kw: float
    min_kw: float
    max_kw: float
    recovery_kwh: float = 0.0

    def simulate(self, setpoints: List[float]) -> AssetSimulation:
        power = []
        recovery = self.recovery_kwh
        for requested in setpoints:
            value = min(max(requested, self.min_kw), self.max_kw)
            delta = self.baseline_kw - value
            if delta < 0:
                recovery += -delta
            elif recovery > 0:
                recovery = max(0.0, recovery - delta)
            power.append(value)
        return AssetSimulation(self.asset_id, "industrial_load", power)


@dataclass
class HeatPumpSimulator:
    asset_id: str
    nominal_kw: float
    min_kw: float = 0.0
    thermal_capacity_kwh: float = 100.0
    thermal_soc_kwh: float = 50.0

    def simulate(self, setpoints: List[float]) -> AssetSimulation:
        power = []
        thermal = self.thermal_soc_kwh
        for requested in setpoints:
            value = min(max(requested, self.min_kw), self.nominal_kw)
            thermal = min(self.thermal_capacity_kwh, max(0.0, thermal + value - self.nominal_kw * 0.5))
            power.append(value)
        return AssetSimulation(self.asset_id, "heat_pump", power, [thermal])
