"""Integration test for VPPGroup -> site memberships -> devices -> assets -> optimizer."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend import models
from optimization import asset_mapper
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def test_vpp_database_records_build_and_optimize_portfolio(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    vpp = models.VPPGroup(
        tenant_id=1,
        name="Integration VPP",
        market="MIBEL",
        strategy="arbitrage",
        target_kw=1000,
    )
    db.add(vpp)
    db.flush()

    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=101, weight=1.0))
    db.add(models.Device(
        tenant_id=1,
        name="BESS 01",
        site_id=101,
        protocol="test",
        device_type="battery",
        config={
            "capacity_kwh": 100,
            "max_charge_kw": 50,
            "max_discharge_kw": 50,
            "initial_soc_pct": 50,
            "min_soc": 0.1,
            "max_soc": 0.95,
        },
    ))
    db.add(models.Device(
        tenant_id=1,
        name="EV Fleet 01",
        site_id=101,
        protocol="test",
        device_type="ev",
        config={
            "capacity_kwh": 50,
            "max_charge_kw": 25,
            "initial_soc": 0.2,
            "target_soc": 0.6,
            "arrival_hour": 0,
            "departure_hour": 4,
        },
    ))
    db.commit()

    monkeypatch.setattr(asset_mapper, "_site_records", lambda db: {
        101: {
            "id": 101,
            "name": "Integration Site",
            "lat": None,
            "lng": None,
            "solar_kw": 0,
            "battery_kwh": 100,
        }
    })

    prices = [20, 20, 20, 20, 200, 200, 200, 200]
    portfolio, metadata = asset_mapper.build_portfolio_from_vpp(
        db, vpp, prices_eur_mwh=prices, base_load_kw=[10] * 8, horizon=8
    )

    assert metadata["site_ids"] == [101]
    assert metadata["device_count"] == 2
    assert metadata["asset_count"] == 2
    assert {asset.asset_id for asset in portfolio.assets} == {"device-1", "device-2"}

    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"
    assert len(result.schedule) == 8
    assert set(result.asset_dispatch) == {"device-1", "device-2"}

    db.close()
