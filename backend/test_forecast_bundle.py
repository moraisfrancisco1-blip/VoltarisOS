from datetime import datetime, timedelta

import pytest

from forecasting.forecast_bundle import ForecastBundle, build_forecast_bundle


def _inputs():
    start = datetime(2026, 8, 18, 0)
    timestamps = [start + timedelta(hours=i) for i in range(4)]
    return timestamps, [40, 60, 100, 80], [200, 210, 220, 230], [0, 0, 30, 50]


def test_bundle_aligns_price_load_and_solar():
    timestamps, prices, load, solar = _inputs()
    bundle = build_forecast_bundle(timestamps, prices, load, solar)
    assert bundle.hours == 4
    assert bundle.prices_eur_mwh == (40.0, 60.0, 100.0, 80.0)
    assert bundle.load_kw == (200.0, 210.0, 220.0, 230.0)
    assert bundle.solar_kw == (0.0, 0.0, 30.0, 50.0)


def test_bundle_rejects_misaligned_series():
    timestamps, prices, load, solar = _inputs()
    with pytest.raises(ValueError, match="must have 4 points"):
        ForecastBundle(tuple(timestamps), tuple(prices[:3]), tuple(load), tuple(solar))


def test_bundle_rejects_non_monotonic_timestamps():
    timestamps, prices, load, solar = _inputs()
    timestamps[2] = timestamps[1]
    with pytest.raises(ValueError, match="strictly increasing"):
        build_forecast_bundle(timestamps, prices, load, solar)


def test_bundle_slice_preserves_alignment():
    timestamps, prices, load, solar = _inputs()
    bundle = build_forecast_bundle(timestamps, prices, load, solar)
    window = bundle.slice(1, 2)
    assert window.timestamps == tuple(timestamps[1:3])
    assert window.prices_eur_mwh == (60.0, 100.0)
    assert window.load_kw == (210.0, 220.0)
    assert window.solar_kw == (0.0, 30.0)
