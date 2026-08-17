"""Optimization API.

Legacy /optimize remains available; new clients should use POST /optimize/multi-asset.
"""
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field
from optimization.assets import BatteryAsset, EVAsset, FlexibleLoadAsset, SolarAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer

router = APIRouter()


@router.get("/optimize")
def optimize():
    return {"solar": 0, "battery": 0, "grid": 0, "status": "legacy_endpoint",
            "message": "Use POST /optimize/multi-asset for real portfolio optimization."}


class SolarInput(BaseModel):
    asset_id: str
    name: str = "Solar PV"
    site_id: Optional[int] = None
    forecast_kw: List[float] = Field(default_factory=list)
    curtailment_allowed: bool = True


class BatteryInput(BaseModel):
    asset_id: str
    name: str = "Battery"
    site_id: Optional[int] = None
    capacity_kwh: float = 500.0
    max_charge_kw: float = 250.0
    max_discharge_kw: float = 250.0
    initial_soc: float = 0.5
    min_soc: float = 0.1
    max_soc: float = 0.95
    charge_efficiency: float = 0.95
    discharge_efficiency: float = 0.95
    degradation_cost_eur_kwh: float = 0.02


class EVInput(BaseModel):
    asset_id: str
    name: str = "EV"
    site_id: Optional[int] = None
    capacity_kwh: float = 60.0
    max_charge_kw: float = 11.0
    initial_soc: float = 0.3
    target_soc: float = 0.8
    min_soc: float = 0.1
    max_soc: float = 1.0
    arrival_hour: int = 0
    departure_hour: int = 24
    charge_efficiency: float = 0.95


class FlexibleLoadInput(BaseModel):
    asset_id: str
    name: str = "Flexible load"
    site_id: Optional[int] = None
    min_power_kw: float = 0.0
    max_power_kw: float = 100.0
    energy_required_kwh: float = 0.0
    start_hour: int = 0
    end_hour: int = 24
    curtailment_cost_eur_kwh: float = 0.0


class MultiAssetOptimizeRequest(BaseModel):
    base_load_kw: List[float] = Field(default_factory=list)
    prices_eur_mwh: List[float] = Field(default_factory=list)
    max_import_kw: float = 1000.0
    max_export_kw: float = 1000.0
    solar: List[SolarInput] = Field(default_factory=list)
    batteries: List[BatteryInput] = Field(default_factory=list)
    evs: List[EVInput] = Field(default_factory=list)
    flexible_loads: List[FlexibleLoadInput] = Field(default_factory=list)


@router.post("/optimize/multi-asset")
def optimize_multi_asset(request: MultiAssetOptimizeRequest):
    portfolio = VPPPortfolio(
        base_load_kw=request.base_load_kw,
        prices_eur_mwh=request.prices_eur_mwh,
        max_import_kw=request.max_import_kw,
        max_export_kw=request.max_export_kw,
    )
    for asset in request.solar:
        portfolio.add(SolarAsset(**asset.model_dump()))
    for asset in request.batteries:
        portfolio.add(BatteryAsset(**asset.model_dump()))
    for asset in request.evs:
        portfolio.add(EVAsset(**asset.model_dump()))
    for asset in request.flexible_loads:
        portfolio.add(FlexibleLoadAsset(**asset.model_dump()))

    result = MultiAssetOptimizer().optimize(portfolio)
    return {
        "status": result.status,
        "total_cost_eur": result.total_cost_eur,
        "total_import_kwh": result.total_import_kwh,
        "total_export_kwh": result.total_export_kwh,
        "solver_time_ms": result.solver_time_ms,
        "asset_dispatch": result.asset_dispatch,
        "schedule": result.schedule,
    }
