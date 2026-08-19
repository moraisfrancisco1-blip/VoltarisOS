from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle, ProviderMetadata
from optimization.rolling_horizon import RollingHorizonOptimizer


class OptimizerMustNotRun:
    def optimize(self, portfolio):
        raise AssertionError("optimizer must not run for unhealthy forecasts")


def stale_bundle():
    return ForecastBundle(
        prices_eur_mwh=[50.0] * 24,
        load_kw=[100.0] * 24,
        solar_kw=[20.0] * 24,
        timestamps=[f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)],
        providers=(ProviderMetadata("ENTSO-E", "2026-08-19T06:00:00+00:00", 15),),
    )


def test_stale_forecast_is_rejected_before_solver():
    rolling = RollingHorizonOptimizer(optimizer=OptimizerMustNotRun())
    with pytest.raises(ValueError, match="ENTSO-E.*stale"):
        rolling.optimize(
            stale_bundle(),
            lambda forecast: (_ for _ in ()).throw(AssertionError("portfolio must not be built")),
            horizon_hours=24,
            now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc),
        )
