"""run_forecasting end to end, with only the outside world faked (ENTSO-E and Open-Meteo).

This task hid five bugs behind one another (naive/aware dates, tenant attributes that do not
exist, a PT default market, an unparsable ENTSO-E document, shifted prices) because nothing ran
it as a whole. The load forecast, the site lookup, the price alignment, the bundle validation and
the persistence here are all real code."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.database as dbmod
from backend import models
from backend.database import Base
from backend.market import entsoe

TENANT = 3


@pytest.fixture()
def Session(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(dbmod, "SessionLocal", factory)  # the task imports SessionLocal when it runs
    yield factory
    Base.metadata.drop_all(bind=engine)


def _seed(factory, readings=30):
    db = factory()
    db.add(models.Tenant(id=TENANT, name="T", slug="t", plan="enterprise"))
    site = models.Site(tenant_id=TENANT, name="home", solar_kw=4.8, battery_kwh=0, ev_chargers=0, owner="x",
                       status="active", lat=52.09, lng=4.36, tilt_deg=10.0, azimuth_deg=90.0)
    db.add(site)
    db.flush()
    dev = models.Device(tenant_id=TENANT, name="inv", protocol="solaredge_oauth", device_type="inverter",
                        site_id=site.id, config={})
    db.add(dev)
    db.flush()
    now = datetime.now(timezone.utc).replace(tzinfo=None)  # the database stores naive UTC
    for h in range(1, readings + 1):
        db.add(models.DeviceReading(device_id=dev.id, tenant_id=TENANT, power_kw=1.0 + (h % 5) * 0.1,
                                    timestamp=now - timedelta(hours=h, minutes=7)))
    db.commit()
    db.close()


def _fake_market(monkeypatch, hours_from_now=None):
    """ENTSO-E: price = 100 + hours since the UTC midnight of that day, for today and tomorrow (or only
    `hours_from_now` hours from the current one, to simulate tomorrow not being published yet)."""
    class Client:
        async def get_day_ahead_prices(self, country_code, start=None, end=None):
            if hours_from_now is None:
                first, count = start, 48
            else:
                first = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
                count = hours_from_now
            data = [entsoe.PricePoint(first + timedelta(hours=i), 100.0 + ((first + timedelta(hours=i)).hour))
                    for i in range(count)]
            # Retrieved just now: LATER than the forecast's first (floored) hour, the exact case that failed.
            return entsoe.EntsoeResponse(success=True, data=data, generated_at=datetime.now(timezone.utc),
                                         max_age_minutes=120)

    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: Client())


def _fake_solar(monkeypatch):
    def solar(lat, lon, kw, hours=24, tilt_deg=None, azimuth_deg=None, include_metadata=False):
        return {"forecast": [{"estimated_kwh": 0.5} for _ in range(hours)],
                "generated_at": datetime.now(timezone.utc).isoformat(), "max_age_minutes": 60}

    monkeypatch.setattr("backend.forecast_inputs.forecast_solar_production", solar)


def _run():
    from backend.tasks import run_forecasting
    return run_forecasting()


def test_a_forecast_is_persisted_with_prices_aligned_to_its_hours(Session, monkeypatch):
    _seed(Session)
    _fake_market(monkeypatch)
    _fake_solar(monkeypatch)

    out = _run()

    tenant_result = next(r for r in out["results"] if r["tenant_id"] == TENANT)
    assert tenant_result["status"] == "completed", tenant_result
    db = Session()
    record = db.query(models.ForecastRecord).filter(models.ForecastRecord.tenant_id == TENANT).one()
    assert record.horizon_hours == 24 and record.status == "valid"
    assert len(record.prices_eur_mwh) == len(record.load_kw) == len(record.solar_kw) == 24
    first = datetime.fromisoformat(record.timestamps[0])
    # price(hour h) = 100 + h: the first price is the one for the forecast's own first hour
    assert record.prices_eur_mwh[0] == 100.0 + first.hour
    assert record.prices_eur_mwh[5] == 100.0 + (first + timedelta(hours=5)).hour
    assert record.solar_kw == [0.5] * 24
    assert {p["name"] for p in record.providers} == {"ENTSO-E", "device-telemetry-load", "Open-Meteo"}
    # generated_at is the real time of generation, not the floored forecast hour
    assert record.generated_at >= first.replace(tzinfo=None)
    db.close()


def test_tomorrows_prices_not_being_out_yet_is_a_skip_not_an_error(Session, monkeypatch):
    _seed(Session)
    _fake_market(monkeypatch, hours_from_now=10)  # only the next 10 hours are published
    _fake_solar(monkeypatch)

    out = _run()

    tenant_result = next(r for r in out["results"] if r["tenant_id"] == TENANT)
    assert tenant_result["status"] == "skipped"
    assert tenant_result["reason"] == "day_ahead_prices_incomplete"
    assert "13:00 CET" in tenant_result["detail"]
    db = Session()
    assert db.query(models.ForecastRecord).count() == 0
    db.close()


def test_too_little_history_is_still_skipped(Session, monkeypatch):
    _seed(Session, readings=5)
    _fake_market(monkeypatch)
    _fake_solar(monkeypatch)
    out = _run()
    tenant_result = next(r for r in out["results"] if r["tenant_id"] == TENANT)
    assert tenant_result == {"tenant_id": TENANT, "status": "skipped", "reason": "insufficient_data", "readings_count": 5}


def test_a_tenant_without_a_usable_site_reports_what_is_missing(Session, monkeypatch):
    db = Session()
    db.add(models.Tenant(id=TENANT, name="T", slug="t", plan="enterprise"))
    db.commit()
    db.close()
    _seed_readings_only(Session)
    _fake_market(monkeypatch)
    _fake_solar(monkeypatch)
    out = _run()
    tenant_result = next(r for r in out["results"] if r["tenant_id"] == TENANT)
    assert tenant_result["status"] == "error"
    assert "needs a site with a location and a solar capacity" in tenant_result["error"]


def _seed_readings_only(factory):
    db = factory()
    dev = models.Device(tenant_id=TENANT, name="inv", protocol="solaredge_oauth", device_type="inverter", config={})
    db.add(dev)
    db.flush()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for h in range(1, 31):
        db.add(models.DeviceReading(device_id=dev.id, tenant_id=TENANT, power_kw=1.0, timestamp=now - timedelta(hours=h, minutes=7)))
    db.commit()
    db.close()
