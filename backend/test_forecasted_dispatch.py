from forecasting.contracts import ForecastBundle
from optimization.assets import BatteryAsset, VPPPortfolio
from optimization.forecasted_dispatch import optimize_forecast_bundle


class FakeRollingOptimizer:
    def optimize(self, forecast, portfolio_factory, *, horizon_hours, step_hours):
        return portfolio_factory(forecast.window(0, horizon_hours))


def test_forecast_bundle_replaces_portfolio_time_series():
    forecast = ForecastBundle(
        prices_eur_mwh=[10, 20, 30],
        load_kw=[100, 110, 120],
        solar_kw=[5, 6, 7],
        timestamps=["2026-08-19T00:00:00+00:00", "2026-08-19T01:00:00+00:00", "2026-08-19T02:00:00+00:00"],
    )
    portfolio = VPPPortfolio(
        assets=[BatteryAsset(asset_id="b1", name="Battery")],
        prices_eur_mwh=[999, 999, 999],
        base_load_kw=[999, 999, 999],
    )

    result = optimize_forecast_bundle(
        forecast, portfolio, horizon_hours=3, step_hours=1, optimizer=FakeRollingOptimizer()
    )

    assert result.prices_eur_mwh == [10, 20, 30]
    assert result.base_load_kw == [100, 110, 120]


def test_forecasted_dispatch_does_not_mutate_template():
    forecast = ForecastBundle(prices_eur_mwh=[10, 20], load_kw=[100, 100], solar_kw=[0, 0])
    portfolio = VPPPortfolio(prices_eur_mwh=[999, 999], base_load_kw=[999, 999])

    optimize_forecast_bundle(
        forecast, portfolio, horizon_hours=2, step_hours=1, optimizer=FakeRollingOptimizer()
    )

    assert portfolio.prices_eur_mwh == [999, 999]
    assert portfolio.base_load_kw == [999, 999]
