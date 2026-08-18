"""Economic comparison for the mixed 24h VPP laboratory scenario."""
from dataclasses import asdict, dataclass
from typing import Dict

from optimization.multi_asset_optimizer import MultiAssetOptimizer
from simulation.scenarios.mixed_vpp_24h import build_mixed_vpp


@dataclass
class ScenarioMetrics:
    name: str
    total_cost_eur: float
    total_import_kwh: float
    total_export_kwh: float
    peak_import_kw: float
    solar_used_kwh: float


def _run(portfolio, name: str) -> ScenarioMetrics:
    result = MultiAssetOptimizer().optimize(portfolio)
    if result.status != "optimal":
        raise RuntimeError(f"Scenario {name} is not optimal: {result.status}")
    solar = sum(row.get("solar_kw", 0.0) for row in result.schedule)
    export = result.total_export_kwh
    return ScenarioMetrics(
        name=name,
        total_cost_eur=result.total_cost_eur,
        total_import_kwh=result.total_import_kwh,
        total_export_kwh=export,
        peak_import_kw=max((row["grid_import_kw"] for row in result.schedule), default=0.0),
        solar_used_kwh=max(0.0, solar - export),
    )


def build_report() -> Dict[str, object]:
    full = build_mixed_vpp()
    scenarios = [_run(full, "full_vpp")]

    # Counterfactuals are deliberately built from the same 24h portfolio.
    # They provide an initial product-value framework; future versions can
    # model true physical baseline behavior and asset-specific revenue streams.
    battery_only = build_mixed_vpp()
    battery_only.assets = [a for a in battery_only.assets if a.asset_id in {"solar-1", "battery-1"}]
    scenarios.append(_run(battery_only, "solar_battery"))

    return {
        "scenarios": [asdict(s) for s in scenarios],
        "value_vs_solar_battery_eur": round(
            scenarios[1].total_cost_eur - scenarios[0].total_cost_eur, 4
        ),
        "note": "Negative value means the full VPP reduced modeled energy cost.",
    }


if __name__ == "__main__":
    import json
    print(json.dumps(build_report(), indent=2))
