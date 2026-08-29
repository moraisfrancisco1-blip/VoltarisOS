from datetime import datetime, timedelta, timezone

import pytest

from forecasting.contracts import ForecastBundle


def _inputs():
    start = datetime(2026, 8, 18, 0, tzinfo=timezone.utc)
    timestamps = [(start + timedelta(hours=i)).isoformat() for i in range(4)]
    return timestamps, [40, 60, 100, 80], [200, 210, 220, 230], [0, 0, 30, 50]


def _bundle(timestamps, prices, load, solar):
    return ForecastBundle(
        timestamps=list(timestamps),
        prices_eur_mwh=list(prices),
        load_kw=list(load),
        solar_kw=list(solar),
    )


def test_bundle_aligns_price_load_and_solar():
    timestamps, prices, load, solar = _inputs()
    bundle = _bundle(timestamps, prices, load, solar)
    bundle.validate(4)
    assert bundle.prices_eur_mwh == [40, 60, 100, 80]
    assert bundle.load_kw == [200, 210, 220, 230]
    assert bundle.solar_kw == [0, 0, 30, 50]


def test_bundle_rejects_misaligned_series():
    timestamps, prices, load, solar = _inputs()
    bundle = _bundle(timestamps, prices[:3], load, solar)
    with pytest.raises(ValueError, match="requires at least 4 values"):
        bundle.validate(4)


def test_bundle_rejects_non_monotonic_timestamps():
    timestamps, prices, load, solar = _inputs()
    timestamps[2] = timestamps[1]
    bundle = _bundle(timestamps, prices, load, solar)
    with pytest.raises(ValueError, match="strictly increasing"):
        bundle.validate(4)


def test_bundle_slice_preserves_alignment():
    timestamps, prices, load, solar = _inputs()
    bundle = _bundle(timestamps, prices, load, solar)
    window = bundle.window(1, 2)
    assert window.timestamps == timestamps[1:3]
    assert window.prices_eur_mwh == [60, 100]
    assert window.load_kw == [210, 220]
    assert window.solar_kw == [0, 30]

