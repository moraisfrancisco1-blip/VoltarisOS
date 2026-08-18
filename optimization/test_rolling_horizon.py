from __future__ import annotations

import pytest

from forecasting.contracts import ForecastBundle
from optimization.assets import VPPPortfolio
from optimization.rolling_horizon import RollingHorizonOptimizer


def make_portfolio(forecast: ForecastBundle) -> VPPPortfolio:
    return VPPPortfolio(
        prices_eur_mwh=forecast.prices_eur_mwh,
        base_load_kw=forecast.load_kw,
        max_import_kw=1000,
        max_export_kw=1000,
    )


def test_forecast_bundle_rejects_misaligned_horizon():
    bundle = ForecastBundle(prices_eur_mwh=[50] * 24, load_kw=[100] * 24, solar_kw=[0] * 23)
    with pytest.raises(ValueError, match="solar_kw requires at least 24 values"):
        bundle.validate(24)


def test_rolling_horizon_solves_each_window_and_commits_first_interval():
    forecast = ForecastBundle(
        prices_eur_mwh=[40, 50, 60, 70, 80, 90],
        load_kw=[100] * 6,
        solar_kw=[0] * 6,
        timestamps=[f"2026-08-18T{hour:02d}:00:00" for hour in range(6)],
        source="test",
    )

    result = RollingHorizonOptimizer().optimize(
        forecast,
        make_portfolio,
        horizon_hours=4,
        step_hours=1,
    )

    assert result.status == "optimal"
    assert result.solves == 3
    assert len(result.intervals) == 3
    assert [item["forecast_index"] for item in result.intervals] == [0, 1, 2]
    assert [item["timestamp"] for item in result.intervals] == [
        "2026-08-18T00:00:00",
        "2026-08-18T01:00:00",
        "2026-08-18T02:00:00",
    ]


def test_rolling_horizon_requires_positive_step():
    forecast = ForecastBundle(prices_eur_mwh=[50] * 4, load_kw=[100] * 4, solar_kw=[0] * 4)
    with pytest.raises(ValueError, match="horizon_hours and step_hours must be positive"):
        RollingHorizonOptimizer().optimize(forecast, make_portfolio, horizon_hours=2, step_hours=0)
