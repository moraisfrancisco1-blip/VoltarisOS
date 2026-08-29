from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle


def bundle(**kwargs):
    base = {
        "prices_eur_mwh": [50.0] * 24,
        "load_kw": [100.0] * 24,
        "solar_kw": [20.0] * 24,
    }
    if "timestamps" not in kwargs:
        base["timestamps"] = [f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)]
    return ForecastBundle(**base, **kwargs)


def test_valid_timezone_aware_hourly_timestamps():
    bundle().validate(24)


def test_rejects_naive_timestamps():
    forecast = bundle(timestamps=[f"2026-08-19T{hour:02d}:00:00" for hour in range(24)])
    with pytest.raises(ValueError, match="timezone-aware"):
        forecast.validate(24)


def test_rejects_non_hourly_or_non_monotonic_timestamps():
    timestamps = [f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)]
    timestamps[2] = "2026-08-19T02:30:00+00:00"
    with pytest.raises(ValueError, match="hourly cadence"):
        bundle(timestamps=timestamps).validate(24)


def test_rejects_stale_forecast():
    forecast = bundle(
        generated_at="2026-08-19T06:00:00+00:00",
        max_age_minutes=30,
    )
    with pytest.raises(ValueError, match="stale"):
        forecast.validate(24, now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))


def test_accepts_fresh_forecast():
    forecast = bundle(
        generated_at="2026-08-19T06:45:00+00:00",
        max_age_minutes=30,
    )
    forecast.validate(24, now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))
