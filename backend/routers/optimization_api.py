"""Public optimization API built on the VPP domain model."""
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from optimization.assets import BatteryAsset, EVAsset, FlexibleLoadAsset, HeatPumpAsset, IndustrialLoadAsset, SolarAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer

router = APIRouter()


@router.get("/optimize")
def optimize():
    return {"solar": 0, "battery": 0, "grid": 0, "status": "legacy_endpoint",
            "message": "Use POST /optimize/multi-asset for real portfolio optimization."}


class SolarInput(BaseModel):
    asset_id: str; name: str = "Solar PV"; site_id: Optional[int] = None
    forecast_kw: List[float] = Field(default_factory=list); curtailment_allowed: bool = True


class BatteryInput(BaseModel):
    asset_id: str; name: str = "Battery"; site_id: Optional[int] = None
    capacity_kwh: float = 500.0; max_charge_kw: float = 250.0; max_discharge_kw: float = 250.0
    initial_soc: float = 0.5; min_soc: float = 0.1; max_soc: float = 0.95
    charge_efficiency: float = 0.95; discharge_efficiency: float = 0.95; degradation_cost_eur_kwh: float = 0.02


class EVInput(BaseModel):
    asset_id: str; name: str = "EV"; site_id: Optional[int] = None
    capacity_kwh: float = 60.0; max_charge_kw: float = 11.0; initial_soc: float = 0.3; target_soc: float = 0.8
    min_soc: float = 0.1; max_soc: float = 1.0; arrival_hour: int = 0; departure_hour: int = 24
    charge_efficiency: float = 0.95; discharge_allowed: bool = False; max_discharge_kw: float = 0.0


class FlexibleLoadInput(BaseModel):
    asset_id: str; name: str = "Flexible load"; site_id: Optional[int] = None
    min_power_kw: float = 0.0; max_power_kw: float = 100.0; energy_required_kwh: float = 0.0
    start_hour: int = 0; end_hour: int = 24; curtailment_cost_eur_kwh: float = 0.0


class IndustrialLoadInput(FlexibleLoadInput):
    baseline_kw: float = 450.0; recovery_kwh: float = 0.0; max_recovery_kw: float = 0.0


class HeatPumpInput(FlexibleLoadInput):
    baseline_power_kw: float = 8.0; nominal_power_kw: float = 20.0
    initial_thermal_kwh: float = 50.0; min_thermal_kwh: float = 0.0; max_thermal_kwh: float = 100.0
    thermal_gain_per_kwh: float = 1.0; thermal_loss_kwh: float = 0.0; target_thermal_kwh: Optional[float] = None
    operating_cost_eur_kwh: float = 0.0


class MultiAssetOptimizeRequest(BaseModel):
    base_load_kw: List[float] = Field(default_factory=list); prices_eur_mwh: List[float] = Field(default_factory=list)
    max_import_kw: float = 1000.0; max_export_kw: float = 1000.0
    peak_demand_cost_eur_per_kw: float = 0.0
    solar: List[SolarInput] = Field(default_factory=list); batteries: List[BatteryInput] = Field(default_factory=list)
    evs: List[EVInput] = Field(default_factory=list); flexible_loads: List[FlexibleLoadInput] = Field(default_factory=list)
    industrial_loads: List[IndustrialLoadInput] = Field(default_factory=list); heat_pumps: List[HeatPumpInput] = Field(default_factory=list)


@router.post("/optimize/multi-asset")
def optimize_multi_asset(request: MultiAssetOptimizeRequest):
    # Horizon is defined by the base load series; every time-series input must
    # cover it. A short price series would silently pad with zeros, producing a
    # mathematically incomplete optimisation, so reject it explicitly.
    horizon = len(request.base_load_kw)
    if horizon <= 0:
        raise HTTPException(422, "base_load_kw must contain at least 1 value")
    if len(request.prices_eur_mwh) < horizon:
        raise HTTPException(
            422,
            f"prices_eur_mwh must cover the optimization horizon ({horizon} values); got {len(request.prices_eur_mwh)}",
        )
    for solar in request.solar:
        if solar.forecast_kw and len(solar.forecast_kw) < horizon:
            raise HTTPException(
                422,
                f"solar[{solar.asset_id}].forecast_kw must cover the horizon ({horizon} values); got {len(solar.forecast_kw)}",
            )

    portfolio = VPPPortfolio(base_load_kw=request.base_load_kw, prices_eur_mwh=request.prices_eur_mwh,
        max_import_kw=request.max_import_kw, max_export_kw=request.max_export_kw,
        peak_demand_cost_eur_per_kw=request.peak_demand_cost_eur_per_kw)
    for asset in request.solar: portfolio.add(SolarAsset(**asset.model_dump()))
    for asset in request.batteries: portfolio.add(BatteryAsset(**asset.model_dump()))
    for asset in request.evs: portfolio.add(EVAsset(**asset.model_dump()))
    for asset in request.flexible_loads: portfolio.add(FlexibleLoadAsset(**asset.model_dump()))
    for asset in request.industrial_loads: portfolio.add(IndustrialLoadAsset(**asset.model_dump()))
    for asset in request.heat_pumps: portfolio.add(HeatPumpAsset(**asset.model_dump()))

    result = MultiAssetOptimizer().optimize(portfolio)
    energy_cost = sum(row["grid_import_kw"] * row["price_eur_mwh"] / 1000.0 - row["grid_export_kw"] * row["price_eur_mwh"] / 1000.0 for row in result.schedule)
    peak_cost = max((row["grid_import_kw"] for row in result.schedule), default=0.0) * request.peak_demand_cost_eur_per_kw
    non_energy_cost = result.total_cost_eur - energy_cost - peak_cost
    return {"status": result.status, "total_cost_eur": result.total_cost_eur, "economic_breakdown": {
        "energy_market_cost_eur": round(energy_cost, 4), "peak_demand_cost_eur": round(peak_cost, 4),
        "non_energy_flex_cost_eur": round(non_energy_cost, 4), "peak_demand_cost_eur_per_kw": request.peak_demand_cost_eur_per_kw},
        "total_import_kwh": result.total_import_kwh, "total_export_kwh": result.total_export_kwh, "solver_time_ms": result.solver_time_ms,
        "dispatch": {"assets": result.asset_dispatch, "sites": result.site_dispatch, "vpp": result.vpp_dispatch}, "schedule": result.schedule}
