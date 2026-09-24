"""Unit tests for the pure /ws/dashboard aggregation (backend/dashboard_metrics.py).

No DB/websocket machinery needed -- this exercises compute_dashboard_metrics
directly against synthetic (device_type, power_kw, soc_pct) tuples, the same
shape backend/routers/websocket.py now feeds it.
"""
from backend.dashboard_metrics import compute_dashboard_metrics


def test_empty_readings():
    result = compute_dashboard_metrics([])
    # avg_soc_pct is 50.0 here, not 0.0 -- that's the preserved original
    # arithmetic: avg_soc starts at a 0.5 baseline and is only ever divided
    # (and thus normalized away) when device_count > 0. Pre-existing quirk,
    # not something this extraction changed -- see compute_dashboard_metrics'
    # docstring.
    assert result == {
        "total_power_kw": 0.0,
        "solar_kw": 0.0,
        "battery_kw": 0.0,
        "avg_soc_pct": 50.0,
        "device_count": 0,
    }


def test_solar_and_battery_bucketed_separately():
    readings = [
        ("solar", 5.0, None),
        ("inverter", 3.0, None),   # also counts as solar (SOLAR_TYPES)
        ("battery", 2.0, 60.0),
        ("battery", -1.0, 80.0),   # discharging (negative) still counted, sign preserved
    ]
    result = compute_dashboard_metrics(readings)
    assert result["solar_kw"] == 8.0
    assert result["battery_kw"] == 1.0
    assert result["total_power_kw"] == 9.0
    assert result["device_count"] == 4


def test_unknown_device_type_counts_toward_total_but_not_solar_or_battery():
    readings = [("heat_pump", 4.0, None)]
    result = compute_dashboard_metrics(readings)
    assert result["total_power_kw"] == 4.0
    assert result["solar_kw"] == 0.0
    assert result["battery_kw"] == 0.0
    assert result["device_count"] == 1


def test_avg_soc_matches_previous_inline_arithmetic():
    # Reproduces the exact pre-extraction formula from websocket.py:
    # avg_soc starts at 0.5, sums raw soc_pct for any reading with a truthy
    # soc_pct, then divides by device_count (readings with truthy power_kw),
    # not by the count of readings that actually reported a soc_pct.
    readings = [
        ("battery", 2.0, 60.0),
        ("battery", 2.0, 80.0),
    ]
    result = compute_dashboard_metrics(readings)
    expected_avg_soc = round(((0.5 + 60.0 + 80.0) / 2 / 100) * 100, 1)
    assert result["avg_soc_pct"] == expected_avg_soc


def test_power_kw_none_or_zero_excluded_from_device_count():
    readings = [("solar", None, 50.0), ("solar", 0.0, 50.0), ("solar", 6.0, 50.0)]
    result = compute_dashboard_metrics(readings)
    # Only the third reading has a truthy power_kw
    assert result["device_count"] == 1
    assert result["solar_kw"] == 6.0
