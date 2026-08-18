"""Ex-post peak-demand sensitivity for the mixed VPP scenario.

This report evaluates the dispatch already produced by the optimizer under
several demand-charge assumptions. It does not re-optimize the dispatch.
"""
import json
from pathlib import Path

from simulation.economic_report import _run

RATES_EUR_PER_KW = [0.0, 0.5, 1.0, 2.0, 5.0]
SCENARIOS = [
    ("Solar only", {"solar"}),
    ("Solar + Battery", {"solar", "battery"}),
    ("Solar + Battery + EV", {"solar", "battery", "ev"}),
    ("Solar + Battery + EV + Industrial", {"solar", "battery", "ev", "industrial_load"}),
    ("Solar + Battery + EV + Heat Pump", {"solar", "battery", "ev", "heat_pump"}),
    ("Full VPP", {"solar", "battery", "ev", "industrial_load", "heat_pump"}),
]


def build_report() -> dict:
    rows = []
    for name, enabled in SCENARIOS:
        metrics = _run(name, enabled)
        for rate in RATES_EUR_PER_KW:
            rows.append({
                "scenario": name,
                "peak_demand_cost_eur_per_kw": rate,
                "energy_cost_eur": metrics.total_cost_eur,
                "peak_import_kw": metrics.peak_import_kw,
                "demand_charge_eur": round(metrics.peak_import_kw * rate, 4),
                "all_in_cost_eur": round(metrics.total_cost_eur + metrics.peak_import_kw * rate, 4),
            })
    return {
        "currency": "EUR",
        "rates_eur_per_kw": RATES_EUR_PER_KW,
        "reoptimization": False,
        "notes": "Ex-post sensitivity only. Dispatch is held fixed; a future optimizer sensitivity should re-solve at each rate.",
        "rows": rows,
    }


def write_report(path: str = "artifacts/peak_cost_sensitivity.json") -> dict:
    report = build_report()
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(write_report(), indent=2))
