"""End-to-end tests for persisted VPP -> mapper -> optimizer."""
from __future__ import annotations

import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.routers.vpp import VPPOptimizeBody, _optimize_persisted_vpp


@pytest.mark.asyncio
async def test_persisted_vpp_optimizes_industrial_and_heat_pump(tmp_path, monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    sites_file = tmp_path / "sites.json"
    sites_file.write_text(json.dumps([
        {"id": 201, "name": "Industrial Site", "lat": 51.916, "lng": 4.398, "solar_kw": 250}
    ]))
    monkeypatch.chdir(tmp_path)

    vpp = models.VPPGroup(
        tenant_id=1, name="Integration VPP", market="MIBEL", strategy="peak_shaving",
        target_kw=1000, min_bid_kw=100, active=True,
    )
    db.add(vpp)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=201, weight=1.0))
    db.add_all([
        models.Device(site_id=201, name="Factory", device_type="industrial_load", protocol="simulated",
                      config={"baseline_kw": 450, "min_power_kw": 300, "recovery_kwh": 600,
                              "max_recovery_kw": 150, "start_hour": 0, "end_hour": 24}, enabled=True),
        models.Device(site_id=201, name="Heat Pump", device_type="heat_pump", protocol="simulated",
                      config={"baseline_power_kw": 8, "nominal_power_kw": 20, "initial_thermal_kwh": 50,
                              "min_thermal_kwh": 0, "max_thermal_kwh": 100}, enabled=True),
    ])
    db.commit()

    body = VPPOptimizeBody(
        horizon_hours=24,
        prices_eur_mwh=[30, 30, 30, 30, 30, 30, 30, 30, 150, 150, 150, 150,
                        30, 30, 30, 30, 30, 30, 150, 150, 30, 30, 30, 30],
        base_load_kw=[100] * 24,
        max_import_kw=1000,
    )

    vpp_out, price_source, mapping, result = await _optimize_persisted_vpp(vpp.id, body, db)

    assert vpp_out.id == vpp.id
    assert price_source == "request"
    assert mapping["device_count"] == 2
    assert mapping["asset_count"] == 3
    assert result.status == "optimal"
    assert "device-1" in result.asset_dispatch or "device-2" in result.asset_dispatch
    assert len(result.vpp_dispatch) == 24


@pytest.mark.asyncio
async def test_persisted_vpp_rejects_short_price_series():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    vpp = models.VPPGroup(tenant_id=1, name="VPP", market="MIBEL", strategy="arbitrage", active=True)
    db.add(vpp)
    db.commit()

    body = VPPOptimizeBody(horizon_hours=24, prices_eur_mwh=[30] * 23)
    with pytest.raises(Exception) as exc:
        await _optimize_persisted_vpp(vpp.id, body, db)
    assert "Need at least 24 hourly prices" in str(exc.value)
