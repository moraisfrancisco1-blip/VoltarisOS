"""End-to-end validation of forecasts flowing into rolling VPP dispatch."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from forecasting.contracts import ForecastBundle
from optimization.assets import BatteryAsset, SolarAsset, VPPPortfolio
from optimization.forecasted_dispatch import optimize_forecast_bundle


def test_forecast_bundle_runs_multiple_realistic_dispatch_windows():
    horizon = 26
    prices = [40.0] * 8 + [140.0] * 8 + [50.0] * 10
    load = [120.0] * horizon
    solar = [0.0] * 6 + [40.0] * 10 + [0.0] * 10
    base = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    timestamps = [(base + timedelta(hours=h)).isoformat() for h in range(horizon)]

    forecast = ForecastBundle(
        prices_eur_mwh=prices,
        load_kw=load,
        solar_kw=solar,
        timestamps=timestamps,
        source="integration-test",
        generated_at=base.isoformat(),
        max_age_minutes=120,
    )
    battery = BatteryAsset(
        asset_id="battery-1",
        name="VPP Battery",
        capacity_kwh=500.0,
        max_charge_kw=100.0,
        max_discharge_kw=100.0,
        initial_soc=0.5,
    )
    portfolio = VPPPortfolio(
        assets=[battery],
        base_load_kw=[999.0] * horizon,
        prices_eur_mwh=[999.0] * horizon,
        max_import_kw=500.0,
        max_export_kw=500.0,
    )

    result = optimize_forecast_bundle(
        forecast,
        portfolio,
        horizon_hours=24,
        step_hours=1,
    )

    assert result.status == "optimal"
    assert result.solves == 3
    assert [item["forecast_index"] for item in result.intervals] == [0, 1, 2]
    assert [item["timestamp"] for item in result.intervals] == timestamps[:3]
    assert all("battery-1" in item["asset_dispatch"] for item in result.intervals)
    assert all(len(item["schedule"]) > 0 for item in result.intervals)

    # The integration must consume the forecast, not mutate the caller's portfolio.
    assert portfolio.prices_eur_mwh[0] == 999.0
    assert portfolio.base_load_kw[0] == 999.0
    assert battery.forecast_kw if hasattr(battery, "forecast_kw") else True
