"""Re-optimize the mixed VPP under several peak-demand tariffs."""
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from optimization.multi_asset_optimizer import MultiAssetOptimizer
from simulation.scenarios.mixed_vpp_24h import build_mixed_vpp

TARIFFS = [0.0, 0.5, 1.0, 2.0, 5.0]


@dataclass
class Result:
    peak_cost_eur_per_kw: float
    total_cost_eur: float
    energy_cost_component_eur: float
    peak_import_kw: float
    total_import_kwh: float
    total_export_kwh: float
    flexible_energy_shifted_kwh: float
    battery_throughput_kwh: float
    vpp_dispatch: list[float]
    asset_dispatch: dict[str, list[float]]


def run_tariff(tariff: float) -> Result:
    portfolio = build_mixed_vpp()
    portfolio.peak_demand_cost_eur_per_kw = tariff
    result = MultiAssetOptimizer().optimize(portfolio)
    if result.status != "optimal":
        raise RuntimeError(f"tariff {tariff}: {result.status}")
    peak = max((row["grid_import_kw"] for row in result.schedule), default=0.0)
    shifted = sum(sum(abs(x) for x in dispatch) for dispatch in result.asset_dispatch.values())
    battery = sum(sum(abs(x) for x in dispatch) for asset_id, dispatch in result.asset_dispatch.items() if asset_id.startswith("battery-"))
    peak_cost = peak * tariff
    return Result(
        peak_cost_eur_per_kw=tariff,
        total_cost_eur=result.total_cost_eur,
        energy_cost_component_eur=result.total_cost_eur - peak_cost,
        peak_import_kw=peak,
        total_import_kwh=result.total_import_kwh,
        total_export_kwh=result.total_export_kwh,
        flexible_energy_shifted_kwh=round(shifted, 4),
        battery_throughput_kwh=round(battery, 4),
        vpp_dispatch=result.vpp_dispatch,
        asset_dispatch=result.asset_dispatch,
    )


def write_report(path: str = "artifacts/peak_cost_reoptimization.json") -> dict:
    results = [run_tariff(t) for t in TARIFFS]
    baseline = results[0].total_cost_eur
    report = {
        "simulation_only": True,
        "reoptimization": True,
        "tariffs_eur_per_kw": TARIFFS,
        "baseline_tariff_eur_per_kw": 0.0,
        "results": [
            {**asdict(r), "savings_vs_zero_tariff_eur": round(baseline - r.total_cost_eur, 4)}
            for r in results
        ],
    }
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(write_report(), indent=2))
