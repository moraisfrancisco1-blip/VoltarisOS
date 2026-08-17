"""Smoke tests for the multi-asset optimizer.

Run with: python -m pytest optimization/test_multi_asset_optimizer.py
"""
from optimization.assets import BatteryAsset, EVAsset, SolarAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def test_battery_and_solar_portfolio_optimizes():
    portfolio = VPPPortfolio(
        base_load_kw=[100, 100, 100, 100],
        prices_eur_mwh=[30, 30, 150, 150],
        max_import_kw=500,
        max_export_kw=500,
    )
    portfolio.add(SolarAsset(asset_id="pv-1", name="PV", forecast_kw=[0, 0, 150, 150]))
    portfolio.add(BatteryAsset(
        asset_id="bat-1", name="BESS", capacity_kwh=200,
        max_charge_kw=100, max_discharge_kw=100, initial_soc=0.5,
    ))

    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"
    assert len(result.schedule) == 4
    assert "bat-1" in result.asset_dispatch


def test_ev_reaches_departure_soc():
    portfolio = VPPPortfolio(
        base_load_kw=[0] * 8,
        prices_eur_mwh=[20, 20, 20, 20, 100, 100, 100, 100],
        max_import_kw=100,
        max_export_kw=100,
    )
    portfolio.add(EVAsset(
        asset_id="ev-1", name="EV", capacity_kwh=40,
        max_charge_kw=10, initial_soc=0.25, target_soc=0.75,
        arrival_hour=0, departure_hour=8,
    ))

    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"
    assert result.schedule[-1]["ev_ev-1"]["soc_pct"] >= 75.0
