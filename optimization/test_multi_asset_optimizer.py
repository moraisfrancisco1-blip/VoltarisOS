"""Unit and integration tests for the multi-asset VPP optimizer."""
from __future__ import annotations

import json

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from optimization.asset_mapper import build_portfolio_from_vpp
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


def test_persisted_vpp_maps_and_optimizes(tmp_path, monkeypatch):
    """Exercise VPPGroup -> membership -> Device -> Asset Mapper -> optimizer."""
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    sites_file = tmp_path / "sites.json"
    sites_file.write_text(json.dumps([{
        "id": 101,
        "name": "Test Site",
        "lat": 51.916,
        "lng": 4.398,
        "solar_kw": 250,
        "battery_kwh": 500,
    }]))
    monkeypatch.chdir(tmp_path)

    vpp = models.VPPGroup(
        tenant_id=1, name="Integration VPP", market="MIBEL",
        strategy="arbitrage", target_kw=1000, min_bid_kw=100,
        active=True,
    )
    db.add(vpp)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=101, weight=1.0))

    battery = models.Device(
        site_id=101, name="BESS 01", device_type="battery",
        protocol="simulated", config={
            "capacity_kwh": 500, "max_charge_kw": 250,
            "max_discharge_kw": 250, "initial_soc_pct": 50,
        }, enabled=True,
    )
    ev = models.Device(
        site_id=101, name="EV Fleet", device_type="ev",
        protocol="simulated", config={
            "capacity_kwh": 100, "max_charge_kw": 50,
            "initial_soc": 0.3, "target_soc": 0.8,
            "arrival_hour": 0, "departure_hour": 8,
        }, enabled=True,
    )
    db.add_all([battery, ev])
    db.commit()

    portfolio, mapping = build_portfolio_from_vpp(
        db=db, vpp=vpp, prices_eur_mwh=[30] * 24,
        base_load_kw=[100] * 24, horizon=24,
    )

    assert mapping["site_ids"] == [101]
    assert mapping["device_count"] == 2
    assert mapping["asset_count"] == 3  # PV + battery + EV
    assert any(isinstance(asset, BatteryAsset) for asset in portfolio.assets)
    assert any(isinstance(asset, EVAsset) for asset in portfolio.assets)
    assert any(isinstance(asset, SolarAsset) for asset in portfolio.assets)

    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"
    assert f"device-{battery.id}" in result.asset_dispatch
    assert f"device-{ev.id}" in result.asset_dispatch

    db.close()
