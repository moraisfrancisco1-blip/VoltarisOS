from dataclasses import dataclass
from typing import List


@dataclass
class VirtualAsset:
    asset_id: str
    site_id: int
    asset_type: str
    max_charge_kw: float = 0.0
    max_discharge_kw: float = 0.0
    capacity_kwh: float = 0.0
    soc_kwh: float = 0.0
    min_soc_kwh: float = 0.0
    max_soc_kwh: float = 0.0

    def apply(self, power_kw: float, hours: float = 1.0) -> float:
        if self.asset_type == "battery":
            power_kw = max(-self.max_charge_kw, min(self.max_discharge_kw, power_kw))
            if power_kw >= 0:
                energy = min(power_kw * hours, max(0.0, self.soc_kwh - self.min_soc_kwh))
                actual = energy / hours if hours else 0.0
                self.soc_kwh -= energy
                return actual
            energy = min((-power_kw) * hours, max(0.0, self.max_soc_kwh - self.soc_kwh))
            actual = -(energy / hours) if hours else 0.0
            self.soc_kwh += energy
            return actual
        return power_kw


@dataclass
class SimulationStep:
    hour: int
    requested_kw: float
    delivered_kw: float
    soc_kwh: float


class VirtualAssetSimulator:
    def __init__(self, assets: List[VirtualAsset]):
        self.assets = assets

    def run(self, dispatch: dict, hours: int = 24) -> List[SimulationStep]:
        steps = []
        for hour in range(hours):
            requested = 0.0
            delivered = 0.0
            for asset in self.assets:
                series = dispatch.get(asset.asset_id, [])
                requested_kw = float(series[hour]) if hour < len(series) else 0.0
                requested += requested_kw
                delivered += asset.apply(requested_kw)
            soc = sum(a.soc_kwh for a in self.assets if a.asset_type == "battery")
            steps.append(SimulationStep(hour, requested, delivered, soc))
        return steps
