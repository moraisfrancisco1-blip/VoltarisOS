"""Generic energy-asset models used by the VoltarisOS multi-asset optimizer."""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class EnergyAsset:
    asset_id: str
    name: str
    site_id: Optional[int] = None
    enabled: bool = True


@dataclass
class SolarAsset(EnergyAsset):
    forecast_kw: List[float] = field(default_factory=list)
    curtailment_allowed: bool = True


@dataclass
class BatteryAsset(EnergyAsset):
    capacity_kwh: float = 500.0
    max_charge_kw: float = 250.0
    max_discharge_kw: float = 250.0
    initial_soc: float = 0.5
    min_soc: float = 0.10
    max_soc: float = 0.95
    charge_efficiency: float = 0.95
    discharge_efficiency: float = 0.95
    degradation_cost_eur_kwh: float = 0.02


@dataclass
class EVAsset(EnergyAsset):
    capacity_kwh: float = 60.0
    max_charge_kw: float = 11.0
    initial_soc: float = 0.30
    target_soc: float = 0.80
    min_soc: float = 0.10
    max_soc: float = 1.0
    arrival_hour: int = 0
    departure_hour: int = 24
    charge_efficiency: float = 0.95
    discharge_allowed: bool = False
    max_discharge_kw: float = 0.0


@dataclass
class FlexibleLoadAsset(EnergyAsset):
    min_power_kw: float = 0.0
    max_power_kw: float = 100.0
    energy_required_kwh: float = 0.0
    start_hour: int = 0
    end_hour: int = 24
    load_shape: Optional[List[float]] = None
    curtailment_cost_eur_kwh: float = 0.0


@dataclass
class VPPPortfolio:
    assets: List[EnergyAsset] = field(default_factory=list)
    base_load_kw: List[float] = field(default_factory=list)
    prices_eur_mwh: List[float] = field(default_factory=list)
    max_import_kw: float = 1000.0
    max_export_kw: float = 1000.0

    def add(self, asset: EnergyAsset) -> None:
        self.assets.append(asset)

    def horizon(self) -> int:
        lengths = [len(self.base_load_kw), len(self.prices_eur_mwh)]
        for asset in self.assets:
            if isinstance(asset, SolarAsset):
                lengths.append(len(asset.forecast_kw))
        return max(lengths or [0])
