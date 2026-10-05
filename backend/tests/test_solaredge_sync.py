"""SolarEdge OAuth connection -> device readings (backend/solaredge_sync.py).
httpx is mocked; no network."""
from __future__ import annotations

from datetime import datetime, timedelta

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models, solaredge_sync
from backend.database import Base

TENANT = 1


class FakeResponse:
    def __init__(self, json_data, status_code: int = 200):
        self._json = json_data
        self.status_code = status_code
        self.text = str(json_data)

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=self)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _connect(db, tenant_id=TENANT, site="2951500"):
    db.add(models.OAuthConnection(
        tenant_id=tenant_id, user_id=1, provider="solaredge", account_label=f"Site {site}",
        access_token="tok", refresh_token="rt", expires_at=datetime.utcnow() + timedelta(hours=1),
    ))
    db.commit()


def test_parse_overview_v1_wrapped_shape():
    out = solaredge_sync.parse_overview({"overview": {
        "currentPower": {"power": 4200.0}, "lastDayData": {"energy": 18500.0}}})
    assert out == {"power_kw": 4.2, "energy_kwh": 18.5}


def test_parse_overview_unwrapped_bare_numbers():
    out = solaredge_sync.parse_overview({"currentPower": 1234, "lastDayData": 2000})
    assert out == {"power_kw": 1.234, "energy_kwh": 2.0}


def test_parse_overview_v2_production_total_with_unit():
    # Real response from the SolarEdge v2 overview of a connected site.
    body = {"siteId": 860695,
            "production": {"total": 2433, "unit": "WH", "toSelfConsumption": None,
                           "toStorage": None, "toGrid": None},
            "consumption": {"total": None, "unit": "WH", "fromPv": None,
                            "fromStorage": None, "fromGrid": None}}
    assert solaredge_sync.parse_overview(body) == {"power_kw": None, "energy_kwh": 2.433}


def test_parse_overview_v2_unknown_unit_is_not_guessed():
    out = solaredge_sync.parse_overview({"production": {"total": 5, "unit": "BTU"}})
    assert out == {"power_kw": None, "energy_kwh": None}


def test_parse_overview_unknown_shape_gives_none():
    assert solaredge_sync.parse_overview({"foo": 1}) == {"power_kw": None, "energy_kwh": None}


def test_sync_stores_reading_and_creates_device_once(db, monkeypatch):
    _connect(db)
    monkeypatch.setattr(httpx, "get", lambda url, **kw: FakeResponse(
        {"overview": {"currentPower": {"power": 3000}, "lastDayData": {"energy": 9000}}}))

    first = solaredge_sync.sync_tenant(db, TENANT)
    assert first["stored"] is True and first["power_kw"] == 3.0

    second = solaredge_sync.sync_tenant(db, TENANT)
    assert second["device_id"] == first["device_id"]  # same device, not a new one

    devs = db.query(models.Device).all()
    assert len(devs) == 1
    assert devs[0].protocol == "solaredge_oauth" and devs[0].tenant_id == TENANT
    assert devs[0].status == "online" and devs[0].last_seen is not None
    assert db.query(models.DeviceReading).count() == 2


def test_sync_unrecognised_response_stores_nothing(db, monkeypatch):
    _connect(db)
    monkeypatch.setattr(httpx, "get", lambda url, **kw: FakeResponse({"something": "else"}))
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["stored"] is False and out["keys"] == ["something"]
    assert db.query(models.Device).count() == 0
    assert db.query(models.DeviceReading).count() == 0


def test_sync_all_isolates_failures_per_tenant(db, monkeypatch):
    _connect(db, tenant_id=1, site="111")
    _connect(db, tenant_id=2, site="222")

    def fake_get(url, **kw):
        if "/sites/111/" in url:
            return FakeResponse({}, status_code=500)
        return FakeResponse({"overview": {"currentPower": {"power": 1000}}})

    monkeypatch.setattr(httpx, "get", fake_get)
    res = solaredge_sync.sync_all(db)
    assert res == {"synced": 1, "failed": 1, "skipped": 0}
    assert db.query(models.DeviceReading).filter(models.DeviceReading.tenant_id == 2).count() == 1
    assert db.query(models.DeviceReading).filter(models.DeviceReading.tenant_id == 1).count() == 0


def _site(db, tenant_id, name="home"):
    s = models.Site(tenant_id=tenant_id, name=name, solar_kw=4.8, battery_kwh=0, ev_chargers=0,
                    owner="x", status="active")
    db.add(s)
    db.commit()
    return s


def _fake_overview(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda url, **kw: FakeResponse(
        {"production": {"total": 2433, "unit": "WH"}}))


def test_device_is_linked_to_the_tenants_only_site(db, monkeypatch):
    _connect(db)
    site = _site(db, TENANT)
    _fake_overview(monkeypatch)
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert db.get(models.Device, out["device_id"]).site_id == site.id


def test_device_stays_unlinked_when_tenant_has_several_sites(db, monkeypatch):
    _connect(db)
    _site(db, TENANT, "a")
    _site(db, TENANT, "b")
    _fake_overview(monkeypatch)
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert db.get(models.Device, out["device_id"]).site_id is None


def test_existing_site_link_is_never_moved(db, monkeypatch):
    _connect(db)
    first = _site(db, TENANT, "a")
    _fake_overview(monkeypatch)
    out = solaredge_sync.sync_tenant(db, TENANT)
    _site(db, TENANT, "b")  # now ambiguous, but the device keeps its site
    solaredge_sync.sync_tenant(db, TENANT)
    assert db.get(models.Device, out["device_id"]).site_id == first.id


def test_other_tenants_site_is_ignored(db, monkeypatch):
    _connect(db)
    _site(db, 99)
    _fake_overview(monkeypatch)
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert db.get(models.Device, out["device_id"]).site_id is None


def _energy(monkeypatch, wh):
    monkeypatch.setattr(httpx, "get", lambda url, **kw: FakeResponse(
        {"production": {"total": wh, "unit": "WH"}}))


def _age_last_reading(db, minutes, energy_kwh):
    """Pretend the latest stored reading was taken `minutes` ago with this energy."""
    r = db.query(models.DeviceReading).order_by(models.DeviceReading.id.desc()).first()
    r.timestamp = datetime.utcnow() - timedelta(minutes=minutes)
    r.energy_kwh = energy_kwh
    db.commit()


def test_power_is_estimated_from_energy_gained_since_an_older_reading(db, monkeypatch):
    _connect(db)
    _energy(monkeypatch, 1000)
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=20, energy_kwh=1.0)  # 1.0 kWh, 20 min ago

    _energy(monkeypatch, 2000)                          # 2.0 kWh now: +1 kWh in 1/3 h
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_estimated"] is True
    assert out["power_kw"] == pytest.approx(3.0, rel=0.02)
    last = db.query(models.DeviceReading).order_by(models.DeviceReading.id.desc()).first()
    assert last.power_kw == pytest.approx(3.0, rel=0.02)
    assert last.raw["voltaris_power_estimate"]["method"] == "energy_delta"


def test_power_not_estimated_when_previous_reading_is_too_recent(db, monkeypatch):
    _connect(db)
    _energy(monkeypatch, 1000)
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=2, energy_kwh=1.0)  # SolarEdge hasn't refreshed yet

    _energy(monkeypatch, 1000)
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_kw"] is None and out["power_estimated"] is False


def test_power_not_estimated_when_previous_reading_is_too_old(db, monkeypatch):
    _connect(db)
    _energy(monkeypatch, 1000)
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=90, energy_kwh=0.5)

    _energy(monkeypatch, 2000)
    assert solaredge_sync.sync_tenant(db, TENANT)["power_kw"] is None


def test_power_not_estimated_when_the_daily_counter_reset(db, monkeypatch):
    _connect(db)
    _energy(monkeypatch, 9000)
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=20, energy_kwh=9.0)

    _energy(monkeypatch, 50)  # new day: the total restarted
    assert solaredge_sync.sync_tenant(db, TENANT)["power_kw"] is None


def test_zero_when_energy_did_not_change_over_the_window(db, monkeypatch):
    _connect(db)
    _energy(monkeypatch, 3000)
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=20, energy_kwh=3.0)

    _energy(monkeypatch, 3000)  # night: nothing produced
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_kw"] == 0.0 and out["power_estimated"] is True


def test_a_real_power_value_is_never_overridden(db, monkeypatch):
    _connect(db)
    monkeypatch.setattr(httpx, "get", lambda url, **kw: FakeResponse(
        {"overview": {"currentPower": {"power": 4000}, "lastDayData": {"energy": 1000}}}))
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=20, energy_kwh=0.0)
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_kw"] == 4.0 and out["power_estimated"] is False
