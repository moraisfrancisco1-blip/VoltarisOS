"""Economic comparison report for the 24-hour mixed VPP laboratory."""
from dataclasses import asdict, dataclass
import json
from pathlib import Path

from optimization.assets import BatteryAsset, EVAsset, HeatPumpAsset, IndustrialLoadAsset, SolarAsset
from optimization.multi_asset_optimizer import MultiAssetOptimizer
from simulation.scenarios.mixed_vpp_24h import build_mixed_vpp


@dataclass
class ScenarioMetrics:
    name: str
    total_cost_eur: float
    total_import_kwh: float
    total_export_kwh: float
    peak_import_kw: float
    solar_self_consumption_kwh: float
    savings_vs_baseline_eur: float = 0.0


_ASSET_TYPES = {
    SolarAsset: "solar",
    BatteryAsset: "battery",
    EVAsset: "ev",
    IndustrialLoadAsset: "industrial_load",
    HeatPumpAsset: "heat_pump",
}


def _asset_type(asset) -> str | None:
    for cls, asset_type in _ASSET_TYPES.items():
        if isinstance(asset, cls):
            return asset_type
    return None


def _ev_baseline_profile(asset: EVAsset, horizon: int) -> list[float]:
    required_kwh = max(0.0, (asset.target_soc - asset.initial_soc) * asset.capacity_kwh)
    profile = [0.0] * horizon
    for hour in range(max(0, asset.arrival_hour), min(asset.departure_hour, horizon)):
        if required_kwh <= 1e-9:
            break
        power = min(asset.max_charge_kw, required_kwh / asset.charge_efficiency)
        profile[hour] = power
        required_kwh -= power * asset.charge_efficiency
    return profile


def _add_baseline_for_disabled_assets(portfolio, enabled_types: set[str]) -> None:
    """Keep physical load constant when a flexible asset is disabled for comparison."""
    horizon = portfolio.horizon()
    for asset in portfolio.assets:
        asset_type = _asset_type(asset)
        if asset_type in enabled_types:
            continue
        if isinstance(asset, IndustrialLoadAsset):
            for t in range(horizon):
                if asset.start_hour <= t < min(asset.end_hour, horizon):
                    portfolio.base_load_kw[t] += asset.baseline_kw
        elif isinstance(asset, HeatPumpAsset):
            for t in range(horizon):
                if asset.start_hour <= t < min(asset.end_hour, horizon):
                    portfolio.base_load_kw[t] += asset.baseline_power_kw
        elif isinstance(asset, EVAsset):
            profile = _ev_baseline_profile(asset, horizon)
            portfolio.base_load_kw = [load + profile[t] for t, load in enumerate(portfolio.base_load_kw)]


def _run(name: str, enabled_types: set[str] | None) -> ScenarioMetrics:
    portfolio = build_mixed_vpp()
    if enabled_types is not None:
        for asset in portfolio.assets:
            asset_type = _asset_type(asset)
            asset.enabled = asset_type in enabled_types
        _add_baseline_for_disabled_assets(portfolio, enabled_types)
    result = MultiAssetOptimizer().optimize(portfolio)
    if result.status != "optimal":
        raise RuntimeError(f"Scenario {name} is not optimal: {result.status}")
    solar_generation = sum(row["solar_kw"] for row in result.schedule)
    solar_self_consumption = max(0.0, solar_generation - result.total_export_kwh)
    peak_import = max((row["grid_import_kw"] for row in result.schedule), default=0.0)
    return ScenarioMetrics(name, result.total_cost_eur, result.total_import_kwh,
                           result.total_export_kwh, peak_import, solar_self_consumption)


def build_report() -> dict:
    scenarios = [
        _run("Solar only", {"solar"}),
        _run("Solar + Battery", {"solar", "battery"}),
        _run("Solar + Battery + EV", {"solar", "battery", "ev"}),
        _run("Full VPP", {"solar", "battery", "ev", "industrial_load", "heat_pump"}),
    ]
    baseline = scenarios[0].total_cost_eur
    for item in scenarios:
        item.savings_vs_baseline_eur = round(baseline - item.total_cost_eur, 4)
    return {
        "currency": "EUR",
        "horizon_hours": 24,
        "simulation_only": True,
        "scenarios": [asdict(item) for item in scenarios],
    }


def write_report(path: str = "artifacts/economic_report.json") -> dict:
    report = build_report()
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(write_report(), indent=2))
