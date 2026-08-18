"""Connect aligned forecasts to the rolling-horizon VPP optimizer."""
from __future__ import annotations

from copy import deepcopy

from forecasting.contracts import ForecastBundle
from optimization.assets import SolarAsset, VPPPortfolio
from optimization.rolling_horizon import RollingHorizonOptimizer, RollingHorizonResult


def optimize_forecast_bundle(
    forecast: ForecastBundle,
    portfolio: VPPPortfolio,
    *,
    horizon_hours: int = 24,
    step_hours: int = 1,
    optimizer: RollingHorizonOptimizer | None = None,
) -> RollingHorizonResult:
    """Run rolling optimization using the forecast bundle as the sole time-series input.

    The portfolio is copied for each window, preserving asset parameters while
    replacing market/load/solar series with the aligned forecast window.
    """
    forecast.validate(horizon_hours)
    orchestrator = optimizer or RollingHorizonOptimizer()

    def factory(window: ForecastBundle) -> VPPPortfolio:
        result = deepcopy(portfolio)
        result.prices_eur_mwh = list(window.prices_eur_mwh)
        result.base_load_kw = list(window.load_kw)
        solar_assets = [a for a in result.assets if isinstance(a, SolarAsset) and a.enabled]
        if solar_assets:
            for asset in solar_assets:
                asset.forecast_kw = list(window.solar_kw)
        elif any(window.solar_kw):
            result.add(SolarAsset(
                asset_id="forecast-solar",
                name="Forecast Solar",
                forecast_kw=list(window.solar_kw),
            ))
        return result

    return orchestrator.optimize(
        forecast,
        factory,
        horizon_hours=horizon_hours,
        step_hours=step_hours,
    )
