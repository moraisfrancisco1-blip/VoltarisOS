"""Unit and integration tests for the multi-asset VPP optimizer."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from optimization.asset_mapper import build_portfolio_from_vpp
from optimization.assets import (
    BatteryAsset, EVAsset, HeatPumpAsset, IndustrialLoadAsset, SolarAsset, VPPPortfolio,
)
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def test_battery_and_solar_portfolio_optimizes():
    portfolio = VPPPortfolio(
        base_load_kw=[100, 100, 100, 100],
        prices_eur_mwh=[30, 30, 150, 150],
        max_import_kw=500,
        max_export_kw=500,
    )
    portfolio.add(SolarAsset(asset_id="pv-1", name="PV", forecast_kw=[0, 0, 150, 150]))
    portfolio.add(BatteryAsset(asset_id="bat-1", name="BESS", capacity_kwh=200,
                               max_charge_kw=100, max_discharge_kw=100, initial_soc=0.5))
    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"
    assert len(result.schedule) == 4
    assert "bat-1" in result.asset_dispatch


def test_battery_closes_at_initial_soc():
    portfolio = VPPPortfolio(base_load_kw=[100] * 8, prices_eur_mwh=[20, 20, 20, 20, 100, 100, 100, 100],
                              max_import_kw=500, max_export_kw=500)
    portfolio.add(BatteryAsset(asset_id="bat-1", name="BESS", capacity_kwh=200,
                               max_charge_kw=100, max_discharge_kw=100, initial_soc=0.5))
    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"
    assert result.schedule[-1]["battery_bat-1"]["soc_pct"] == 50.0


def test_ev_reaches_departure_soc():
    portfolio = VPPPortfolio(base_load_kw=[0] * 8, prices_eur_mwh=[20, 20, 20, 20, 100, 100, 100, 100],
                              max_import_kw=100, max_export_kw=100)
    portfolio.add(EVAsset(asset_id="ev-1", name="EV", capacity_kwh=40, max_charge_kw=10,
                          initial_soc=0.25, target_soc=0.75, arrival_hour=0, departure_hour=8))
    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"
    assert result.schedule[-1]["ev_ev-1"]["soc_pct"] >= 75.0


def test_dispatch_reports_absolute_power_not_baseline_relative_delta():
    """Regression test for the energy-engineering audit finding: dispatch{}
    (what control.dispatch_executor actually receives) must equal the
    already-correct baseline+delta figures already shown in `schedule`, for
    every asset whose baseline power isn't zero. Before the fix, EV and heat
    pump dispatch stored only -delta, and industrial-load dispatch omitted its
    baseline entirely -- both silently wrong (or, for curtailment, silently
    dropped by dispatch_executor's >=0 clamp) whenever baseline != 0, which is
    the normal case for a plugged-in EV, a running heat pump, or a running
    industrial process.
    """
    n = 6
    prices = [80, 80, 20, 20, 80, 80]  # cheap at hours 2-3: incentive to shift/curtail
    portfolio = VPPPortfolio(base_load_kw=[0] * n, prices_eur_mwh=prices, max_import_kw=200, max_export_kw=200)
    portfolio.add(EVAsset(asset_id="ev-1", name="EV", capacity_kwh=40, max_charge_kw=10,
                          initial_soc=0.30, target_soc=0.80, arrival_hour=0, departure_hour=n))
    portfolio.add(HeatPumpAsset(asset_id="hp-1", name="HP", baseline_power_kw=8.0, nominal_power_kw=20.0,
                                start_hour=0, end_hour=n))
    portfolio.add(IndustrialLoadAsset(asset_id="il-1", name="Line 1", baseline_kw=50.0,
                                       min_power_kw=0.0, max_power_kw=50.0,
                                       recovery_kwh=30.0, max_recovery_kw=15.0,
                                       start_hour=0, end_hour=n))
    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"

    for t in range(n):
        row = result.schedule[t]
        # EV and heat pump: dispatch_executor's "negative = consuming" convention
        # means dispatch must be -(actual absolute power), matching `schedule`.
        assert result.asset_dispatch["ev-1"][t] == pytest.approx(-row["ev_ev-1"]["charge_kw"])
        assert result.asset_dispatch["hp-1"][t] == pytest.approx(-row["heat_pump_hp-1"]["power_kw"])
        # Industrial load: dispatch_executor's "positive = consuming" convention
        # means dispatch must equal the actual absolute power directly.
        assert result.asset_dispatch["il-1"][t] == pytest.approx(row["load_il-1_kw"])
        # And, now that baseline is included, dispatch must be a plausible
        # absolute power draw -- never negative (this asset cannot export).
        assert result.asset_dispatch["il-1"][t] >= -1e-6


def test_persisted_vpp_maps_and_optimizes(tmp_path, monkeypatch):
    """Exercise VPPGroup -> membership -> Device -> Asset Mapper -> optimizer."""
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    db.add(models.Site(id=101, tenant_id=1, name="Test Site", lat=51.916, lng=4.398, solar_kw=250, battery_kwh=500))
    vpp = models.VPPGroup(tenant_id=1, name="Integration VPP", market="MIBEL", strategy="arbitrage",
                          target_kw=1000, min_bid_kw=100, active=True)
    db.add(vpp)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=101, weight=1.0))
    battery = models.Device(site_id=101, name="BESS 01", device_type="battery", protocol="simulated",
                            config={"capacity_kwh": 500, "max_charge_kw": 250, "max_discharge_kw": 250, "initial_soc_pct": 50}, enabled=True)
    ev = models.Device(site_id=101, name="EV Fleet", device_type="ev", protocol="simulated",
                       config={"capacity_kwh": 100, "max_charge_kw": 50, "initial_soc": 0.3, "target_soc": 0.8,
                               "arrival_hour": 0, "departure_hour": 8}, enabled=True)
    db.add_all([battery, ev])
    db.commit()
    portfolio, mapping = build_portfolio_from_vpp(db=db, vpp=vpp, prices_eur_mwh=[30] * 24,
                                                   base_load_kw=[100] * 24, horizon=24)
    assert mapping["site_ids"] == [101]
    assert mapping["device_count"] == 2
    assert mapping["asset_count"] == 3
    assert any(isinstance(asset, BatteryAsset) for asset in portfolio.assets)
    assert any(isinstance(asset, EVAsset) for asset in portfolio.assets)
    assert any(isinstance(asset, SolarAsset) for asset in portfolio.assets)
    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"
    assert f"device-{battery.id}" in result.asset_dispatch
    assert f"device-{ev.id}" in result.asset_dispatch
    assert "101" in result.site_dispatch
    assert len(result.site_dispatch["101"]) == 24
    assert len(result.vpp_dispatch) == 24
    assert result.vpp_dispatch == result.site_dispatch["101"]
    db.close()
