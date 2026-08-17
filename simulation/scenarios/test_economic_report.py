from simulation.scenarios.economic_report import build_report


def test_economic_report_returns_comparable_scenarios():
    report = build_report()
    assert {s["name"] for s in report["scenarios"]} == {"full_vpp", "solar_battery"}
    for scenario in report["scenarios"]:
        assert scenario["total_cost_eur"] >= 0 or scenario["total_export_kwh"] > 0
        assert scenario["total_import_kwh"] >= 0
        assert scenario["peak_import_kw"] >= 0
        assert scenario["solar_used_kwh"] >= 0
    assert isinstance(report["value_vs_solar_battery_eur"], float)
