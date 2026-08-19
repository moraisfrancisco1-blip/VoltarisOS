from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle
from forecasting.health import assess_bundle_health, require_healthy_bundle


def make_bundle(generated_at="2026-08-19T06:45:00+00:00", max_age_minutes=30):
    return ForecastBundle(
        prices_eur_mwh=[50.0] * 24,
        load_kw=[100.0] * 24,
        solar_kw=[20.0] * 24,
        timestamps=[f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)],
        source="test-provider",
        generated_at=generated_at,
        max_age_minutes=max_age_minutes,
    )


def test_fresh_provider_is_healthy():
    health = assess_bundle_health(make_bundle(), now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))
    assert health.healthy is True
    assert health.reason == "fresh"


def test_stale_provider_is_unhealthy():
    health = assess_bundle_health(make_bundle(), now=datetime(2026, 8, 19, 8, 0, tzinfo=timezone.utc))
    assert health.healthy is False
    assert health.reason == "forecast is stale"


def test_missing_freshness_metadata_fails_closed():
    health = assess_bundle_health(make_bundle(max_age_minutes=None), now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))
    assert health.healthy is False
    assert health.reason == "missing max_age_minutes"


def test_require_healthy_bundle_rejects_stale_forecast():
    with pytest.raises(ValueError, match="forecast provider unhealthy"):
        require_healthy_bundle(make_bundle(), now=datetime(2026, 8, 19, 8, 0, tzinfo=timezone.utc))
