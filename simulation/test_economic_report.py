"""Smoke test for the canonical economic report module.

Protects the public contract of simulation/economic_report.py::build_report()
without freezing internal economic details.
"""
from simulation.economic_report import build_report


_EXPECTED_SCENARIOS = {
    "Solar only",
    "Solar + Battery",
    "Solar + Battery + EV",
    "Solar + Battery + EV + Industrial",
    "Solar + Battery + EV + Heat Pump",
    "Full VPP",
}


def test_build_report_returns_six_scenarios_with_non_negative_metrics():
    report = build_report()

    scenarios = report["scenarios"]
    names = [s["name"] for s in scenarios]

    assert len(scenarios) == 6
    assert set(names) == _EXPECTED_SCENARIOS
    assert "Full VPP" in names

    for scenario in scenarios:
        assert scenario["total_cost_eur"] >= 0
        assert scenario["total_import_kwh"] >= 0
        assert scenario["total_export_kwh"] >= 0
        assert scenario["peak_import_kw"] >= 0
        assert scenario["solar_self_consumption_kwh"] >= 0

    full_vpp = next(s for s in scenarios if s["name"] == "Full VPP")
    assert full_vpp["total_cost_eur"] > 0
