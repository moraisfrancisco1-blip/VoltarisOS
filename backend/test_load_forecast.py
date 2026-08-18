from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from forecasting.load_forecast import forecast_load_from_readings, forecast_site_loads_from_readings


def test_forecast_uses_same_weekday_and_hour_median():
    start = datetime(2026, 8, 17, 12)
    readings = [
        SimpleNamespace(timestamp=start - timedelta(days=7), power_kw=100),
        SimpleNamespace(timestamp=start - timedelta(days=14), power_kw=120),
        SimpleNamespace(timestamp=start - timedelta(days=21), power_kw=110),
        SimpleNamespace(timestamp=start - timedelta(hours=1), power_kw=999),
    ]
    assert forecast_load_from_readings(readings, start, hours=1) == [110.0]


def test_forecast_falls_back_to_global_median_for_missing_slot():
    start = datetime(2026, 8, 17, 12)
    readings = [SimpleNamespace(timestamp=start - timedelta(hours=1), power_kw=80)]
    assert forecast_load_from_readings(readings, start, hours=1) == [80.0]


def test_forecast_requires_history_or_explicit_fallback():
    start = datetime(2026, 8, 17, 12)
    with pytest.raises(ValueError, match="No usable historical load telemetry"):
        forecast_load_from_readings([], start, hours=1)
    assert forecast_load_from_readings([], start, hours=1, fallback_kw=42) == [42.0]


def test_site_forecasts_are_aggregated():
    start = datetime(2026, 8, 17, 12)
    readings = {
        1: [SimpleNamespace(timestamp=start - timedelta(days=7), power_kw=100)],
        2: [SimpleNamespace(timestamp=start - timedelta(days=7), power_kw=50)],
    }
    assert forecast_site_loads_from_readings(readings, start, hours=1) == [150.0]
