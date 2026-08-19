from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle
from optimization.rolling_horizon import RollingHorizonOptimizer


def stale_bundle():
    return ForecastBundle(
        prices_eur_mwh=[50.0] * 24,
        load_kw=[100.0] * 24,
        solar_kw=[20.0] * 24,
        timestamps=[f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)],
        source="test-provider",
        generated_at="2026-08-19T05:00:00+00:00",
        max_age_minutes=30,
    )


def test_stale_forecast_is_rejected_before_portfolio_factory():
    called = False

    def portfolio_factory(_forecast):
        nonlocal called
        called = True
        raise AssertionError("portfolio factory must not run for stale forecasts")

    optimizer = RollingHorizonOptimizer()
    with pytest.raises(ValueError, match="forecast provider unhealthy"):
        optimizer.optimize(stale_bundle(), portfolio_factory, horizon_hours=24)
    assert called is False
