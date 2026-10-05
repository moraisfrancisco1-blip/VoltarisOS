"""Solar performance ratio: the maths, the exclusion rules, the "needs X" statuses and the
tenant-scoped endpoint. Open-Meteo is replaced by a fake provider (no network)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models, solar_performance
from backend.database import Base
from backend.main import app
from backend.routers import solar_performance as solar_router
from backend.security import SECRET_KEY, ALGORITHM
from forecasting.historical_irradiance import daily_poa_kwh_m2

NOW = datetime(2026, 10, 6, 8, 0, tzinfo=timezone.utc)  # 10:00 local on 2026-10-06 (CEST, UTC+2)


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


def _site(db, tenant=1, name="home", solar_kw=4.8, **kw):
    fields = dict(lat=52.09, lng=4.36, tilt_deg=10.0, azimuth_deg=90.0, timezone="Europe/Amsterdam")
    fields.update(kw)
    site = models.Site(tenant_id=tenant, name=name, solar_kw=solar_kw, battery_kwh=0, ev_chargers=0,
                       owner="x", status="active", **fields)
    db.add(site)
    db.flush()
    dev = models.Device(tenant_id=tenant, name=f"inv-{name}", protocol="solaredge_oauth",
                        device_type="inverter", site_id=site.id, config={})
    db.add(dev)
    db.flush()
    return site, dev


def _day(db, dev, day: date, readings: int, kwh_each: float):
    """Readings around local noon of `day` (10:00Z = 12:00 local in October)."""
    start = datetime(day.year, day.month, day.day, 10, 0)
    for i in range(readings):
        db.add(models.DeviceReading(device_id=dev.id, tenant_id=dev.tenant_id,
                                    timestamp=start + timedelta(minutes=5 * i), energy_kwh=kwh_each))
    db.commit()


def _poa(mapping):
    """Fake Open-Meteo: {iso date: kWh/m2}."""
    return lambda lat, lng, tilt, az, days: (
        "Europe/Amsterdam", {d: {"poa_kwh_m2": v, "hours": 24} for d, v in mapping.items()})


def _by_date(out):
    return {r["date"]: r for r in out["days"]}


def test_daily_poa_sums_hourly_values_per_local_date():
    out = daily_poa_kwh_m2(["2026-10-04T10:00", "2026-10-04T11:00", "2026-10-05T00:00"], [500, None, 250])
    assert out["2026-10-04"] == {"poa_kwh_m2": pytest.approx(0.5), "hours": 2}  # None counts as 0
    assert out["2026-10-05"] == {"poa_kwh_m2": pytest.approx(0.25), "hours": 1}


def test_pr_is_energy_over_capacity_times_irradiation(db):
    site, dev = _site(db)
    _day(db, dev, date(2026, 10, 4), 30, 0.512)  # 15.36 kWh on a 4.8 kWp system
    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=_poa({"2026-10-04": 4.0}), now=NOW)
    day = _by_date(out)["2026-10-04"]
    assert out["status"] == "ok" and day["valid"] is True
    assert day["energy_kwh"] == pytest.approx(15.36) and day["pr"] == pytest.approx(0.8)  # 15.36 / (4.8 * 4.0)
    assert out["summary"]["avg_pr"] == pytest.approx(0.8) and out["summary"]["valid_days"] == 1


def test_days_that_cannot_give_a_meaningful_ratio_are_excluded_with_a_reason(db):
    site, dev = _site(db)
    _day(db, dev, date(2026, 10, 4), 30, 0.5)   # fine
    _day(db, dev, date(2026, 10, 3), 30, 0.1)   # data, but a dark day
    _day(db, dev, date(2026, 10, 2), 5, 0.5)    # sun, but only 5 readings
    _day(db, dev, date(2026, 10, 6), 30, 0.5)   # today: still in progress
    prov = _poa({"2026-10-06": 3.0, "2026-10-04": 4.0, "2026-10-03": 0.4, "2026-10-02": 3.0, "2026-10-01": 3.0})
    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=prov, now=NOW)
    d = _by_date(out)
    assert d["2026-10-04"]["valid"] and d["2026-10-04"]["pr"] is not None
    assert d["2026-10-03"]["reason"] == "too little sun" and d["2026-10-03"]["pr"] is None
    assert d["2026-10-02"]["reason"] == "not enough readings"
    assert d["2026-10-06"]["reason"] == "day still in progress" and d["2026-10-06"]["pr"] is None
    assert d["2026-10-01"]["reason"] == "not enough readings"  # no readings that day
    assert out["summary"]["valid_days"] == 1 and out["summary"]["days_with_data"] == 4


def test_a_day_is_the_local_day_not_the_utc_day(db):
    site, dev = _site(db)
    # 22:30Z on Oct 3 is 00:30 local on Oct 4: it belongs to Oct 4, not Oct 3.
    for i in range(30):
        db.add(models.DeviceReading(device_id=dev.id, tenant_id=1, energy_kwh=0.1,
                                    timestamp=datetime(2026, 10, 3, 22, 30) + timedelta(minutes=i)))
    db.commit()
    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=_poa({"2026-10-03": 3.0, "2026-10-04": 3.0}), now=NOW)
    d = _by_date(out)
    assert d["2026-10-04"]["readings"] == 30 and d["2026-10-03"]["readings"] == 0


@pytest.mark.parametrize("change,status", [
    ({"tilt_deg": None}, "needs_orientation"), ({"azimuth_deg": None}, "needs_orientation"),
    ({"lat": None}, "needs_location"), ({"solar_kw": 0}, "no_capacity"),
])
def test_missing_inputs_give_a_status_not_an_error(db, change, status):
    kw = dict(change)
    solar_kw = kw.pop("solar_kw", 4.8)
    site, _ = _site(db, solar_kw=solar_kw, **kw)
    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=lambda *a: pytest.fail("no weather call"), now=NOW)
    assert out["status"] == status and out["days"] == [] and out["summary"] is None


def test_weather_failure_is_reported_not_raised(db):
    site, _ = _site(db)

    def boom(*a):
        raise RuntimeError("open-meteo down")

    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=boom, now=NOW)
    assert out["status"] == "weather_unavailable"


def _history(db, dev, first_day: date, kwh_by_index):
    mapping = {}
    for i, kwh in enumerate(kwh_by_index):
        day = first_day + timedelta(days=i)
        _day(db, dev, day, 24, kwh / 24)
        mapping[day.isoformat()] = 4.0
    return mapping


def test_trend_compares_the_last_week_with_the_first_week_once_there_are_14_valid_days(db):
    site, dev = _site(db)
    energies = [15.36] * 7 + [14.4] * 2 + [13.44] * 7  # PR 0.80 x7, 0.75 x2, 0.70 x7
    mapping = _history(db, dev, date(2026, 9, 19), energies)
    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=_poa(mapping), now=NOW)
    s = out["summary"]
    assert s["valid_days"] == 16 and s["trend_pp"] == pytest.approx(-10.0)
    assert s["last7_pr"] == pytest.approx(0.7)


def test_no_trend_before_14_valid_days(db):
    site, dev = _site(db)
    mapping = _history(db, dev, date(2026, 10, 1), [15.36] * 4)
    out = solar_performance.compute_site_performance(db, site, 30, poa_provider=_poa(mapping), now=NOW)
    assert out["summary"]["valid_days"] == 4 and out["summary"]["trend_pp"] is None


# ── endpoint ────────────────────────────────────────────────────────────────

def _auth(tenant_id, role="TENANT_ADMIN"):
    token = jwt.encode({"sub": "u@x.com", "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def client(db, monkeypatch):
    def _override():
        yield db

    app.dependency_overrides[solar_router.get_db] = _override
    monkeypatch.setattr(solar_performance, "get_daily_poa", _poa({"2026-10-04": 4.0}))
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def test_endpoint_requires_login(client):
    assert client.get("/api/solar/performance").status_code == 401


def test_endpoint_only_returns_the_callers_own_sites(client, db):
    _site(db, tenant=1, name="mine")
    _site(db, tenant=2, name="theirs")
    db.commit()
    body = client.get("/api/solar/performance", headers=_auth(1)).json()
    assert [s["name"] for s in body["sites"]] == ["mine"]
    assert body["degradation"]["computable"] is False and "12 months" in body["degradation"]["reason"]
    root = client.get("/api/solar/performance", headers=_auth(None, role="SUPER_ADMIN")).json()
    assert sorted(s["name"] for s in root["sites"]) == ["mine", "theirs"]


@pytest.mark.parametrize("days,status", [(3, 422), (7, 200), (90, 200), (91, 422)])
def test_days_parameter_is_bounded(client, days, status):
    assert client.get(f"/api/solar/performance?days={days}", headers=_auth(1)).status_code == status
