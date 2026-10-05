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
    """Pretend the latest stored reading was taken `minutes` ago, when the day
    counter read `energy_kwh` (the counter lives in raw; energy_kwh is the interval)."""
    r = db.query(models.DeviceReading).order_by(models.DeviceReading.id.desc()).first()
    r.timestamp = datetime.utcnow() - timedelta(minutes=minutes)
    r.raw = {**r.raw, solaredge_sync.DAY_TOTAL_KEY: energy_kwh}
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


# ── SolarEdge v2 /power endpoint (real current power) ────────────────────────
from datetime import timezone  # noqa: E402


def _iso(minutes_ago):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


def _route(monkeypatch, power_body=None, power_status=200):
    """overview -> production only (no power); /power -> power_body."""
    def fake_get(url, **kw):
        if url.endswith("/power"):
            return FakeResponse(power_body if power_body is not None else {}, status_code=power_status)
        return FakeResponse({"production": {"total": 2433, "unit": "WH"}})
    monkeypatch.setattr(httpx, "get", fake_get)


def test_parse_power_takes_latest_non_null_bucket_in_kw():
    body = {"unit": "W", "values": [
        {"timestamp": _iso(40), "value": 100.0},
        {"timestamp": _iso(10), "value": 1500.0},
        {"timestamp": _iso(0), "value": None},  # quarter hour still open
    ]}
    assert solaredge_sync.parse_power(body) == 1.5


def test_parse_power_accepts_power_key_and_kw_unit():
    body = {"unit": "kW", "values": [{"timestamp": _iso(5), "power": 2.0}]}
    assert solaredge_sync.parse_power(body) == 2.0


@pytest.mark.parametrize("body", [
    None, {}, {"values": "x"},
    {"unit": "W", "values": []},
    {"unit": "W", "values": [{"timestamp": _iso(5), "value": None}]},
    {"unit": "W", "values": [{"timestamp": _iso(90), "value": 900.0}]},       # stale
    {"unit": "W", "values": [{"timestamp": "2026-10-05T10:00:00", "value": 9.0}]},  # naive ts
    {"unit": "W", "values": [{"timestamp": "garbage", "value": 9.0}]},
    {"unit": "BTU", "values": [{"timestamp": _iso(5), "value": 9.0}]},
])
def test_parse_power_never_returns_unprovable_or_stale_values(body):
    assert solaredge_sync.parse_power(body) is None


def test_sync_prefers_the_real_power_endpoint(db, monkeypatch):
    _connect(db)
    _route(monkeypatch, {"unit": "W", "values": [{"timestamp": _iso(2), "value": 228.0}]})
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_kw"] == pytest.approx(0.228) and out["power_estimated"] is False
    last = db.query(models.DeviceReading).order_by(models.DeviceReading.id.desc()).first()
    assert last.raw["voltaris_power_source"] == "solaredge_power_endpoint"


def test_sync_falls_back_to_estimate_when_power_endpoint_fails(db, monkeypatch):
    _connect(db)
    _route(monkeypatch, power_status=500)
    solaredge_sync.sync_tenant(db, TENANT)
    _age_last_reading(db, minutes=20, energy_kwh=1.433)  # +1.0 kWh over 20 min

    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_estimated"] is True and out["power_kw"] == pytest.approx(3.0, rel=0.02)


def test_sync_ignores_a_stale_power_bucket(db, monkeypatch):
    _connect(db)
    _route(monkeypatch, {"unit": "W", "values": [{"timestamp": _iso(120), "value": 5000.0}]})
    out = solaredge_sync.sync_tenant(db, TENANT)
    assert out["power_kw"] is None


# ── energy_kwh is per-reading energy, not the day counter ─────────────────────
from backend import energy_counter  # noqa: E402


@pytest.mark.parametrize("prev,now,expected", [
    (None, 5.0, 5.0),      # first reading: the counter is "today so far", so it all belongs to today
    (1.0, 1.5, 0.5),       # normal growth
    (2.0, 2.0, 0.0),       # nothing produced
    (9.0, 0.2, 0.2),       # midnight reset: everything since is new
    (2.0, 1.8, 0.0),       # small dip is noise, not a reset
    (1.0, None, None),     # no counter value now
])
def test_interval_kwh_rule(prev, now, expected):
    assert energy_counter.interval_kwh(prev, now) == pytest.approx(expected) if expected is not None \
        else energy_counter.interval_kwh(prev, now) is None


def test_summing_stored_energy_gives_the_day_total_not_a_multiple(db, monkeypatch):
    """Regression: every 5-min reading used to store the whole day's counter, and the
    backend SUMs energy_kwh, so a 3 kWh day looked like dozens of kWh."""
    _connect(db)
    for wh in (0, 400, 900, 1700, 3000):
        _energy(monkeypatch, wh)
        solaredge_sync.sync_tenant(db, TENANT)
    stored = [r.energy_kwh for r in db.query(models.DeviceReading).order_by(models.DeviceReading.id)]
    assert sum(stored) == pytest.approx(3.0)            # the day's real total
    assert stored[0] == 0.0                              # the counter was 0 at the first reading
    last = db.query(models.DeviceReading).order_by(models.DeviceReading.id.desc()).first()
    assert last.raw[solaredge_sync.DAY_TOTAL_KEY] == pytest.approx(3.0)  # counter kept in raw


def test_midnight_reset_does_not_subtract_or_double_count(db, monkeypatch):
    _connect(db)
    for wh in (8000, 9000, 100):  # day ends at 9 kWh, new day starts at 0.1
        _energy(monkeypatch, wh)
        solaredge_sync.sync_tenant(db, TENANT)
    stored = [r.energy_kwh for r in db.query(models.DeviceReading).order_by(models.DeviceReading.id)]
    assert stored == [pytest.approx(8.0), pytest.approx(1.0), pytest.approx(0.1)]  # 8 so far, +1, new day 0.1


def test_legacy_reading_without_marker_is_read_as_the_counter(db, monkeypatch):
    _connect(db)
    _energy(monkeypatch, 1000)
    out = solaredge_sync.sync_tenant(db, TENANT)
    legacy = db.query(models.DeviceReading).first()
    legacy.raw = {k: v for k, v in legacy.raw.items() if k != solaredge_sync.DAY_TOTAL_KEY}
    legacy.energy_kwh = 1.0  # old convention: the counter itself
    db.commit()
    _energy(monkeypatch, 1600)
    again = solaredge_sync.sync_tenant(db, TENANT)
    assert again["device_id"] == out["device_id"] and again["interval_kwh"] == pytest.approx(0.6)


def test_migration_converts_legacy_counter_rows_in_order(db, monkeypatch):
    from backend.migrations import fix_solaredge_oauth_energy as mig

    dev = models.Device(tenant_id=TENANT, name="se", protocol="solaredge_oauth", device_type="inverter",
                        external_id="solaredge-site-1", config={})
    other = models.Device(tenant_id=TENANT, name="manual", protocol="solaredge", device_type="inverter", config={})
    db.add_all([dev, other])
    db.flush()
    t0 = datetime.utcnow() - timedelta(hours=3)
    for i, counter in enumerate((1.0, 1.4, 2.0, 0.1)):  # last one: new day
        db.add(models.DeviceReading(device_id=dev.id, tenant_id=TENANT, timestamp=t0 + timedelta(minutes=5 * i),
                                    energy_kwh=counter, raw={"production": {"total": counter * 1000}}))
    db.add(models.DeviceReading(device_id=other.id, tenant_id=TENANT, timestamp=t0, energy_kwh=7.7, raw={}))
    db.commit()

    dev_id, other_id = dev.id, other.id  # migrate() closes the session, detaching dev/other
    monkeypatch.setattr(mig, "SessionLocal", lambda: db)
    mig.migrate()
    mig.migrate()  # idempotent

    rows = db.query(models.DeviceReading).filter(models.DeviceReading.device_id == dev_id) \
        .order_by(models.DeviceReading.timestamp).all()
    assert [r.energy_kwh for r in rows] == [pytest.approx(1.0), pytest.approx(0.4), pytest.approx(0.6), pytest.approx(0.1)]
    assert [r.raw[mig.DAY_TOTAL_KEY] for r in rows] == [1.0, 1.4, 2.0, 0.1]
    assert rows[0].raw["production"]["total"] == 1000.0  # original payload preserved
    untouched = db.query(models.DeviceReading).filter(models.DeviceReading.device_id == other_id).one()
    assert untouched.energy_kwh == 7.7 and mig.DAY_TOTAL_KEY not in untouched.raw


# ── first reading counts what the counter already held ───────────────────────
def test_first_reading_counts_the_energy_already_produced_today(db, monkeypatch):
    """Regression: the first reading was stored as 0, dropping everything produced
    before we connected and understating that day's totals."""
    _connect(db)
    for wh in (2433, 2900, 3500):  # the day counter when we start watching, then growth
        _energy(monkeypatch, wh)
        solaredge_sync.sync_tenant(db, TENANT)
    stored = [r.energy_kwh for r in db.query(models.DeviceReading).order_by(models.DeviceReading.id)]
    assert stored == [pytest.approx(2.433), pytest.approx(0.467), pytest.approx(0.6)]
    assert sum(stored) == pytest.approx(3.5)  # equals SolarEdge's own total for the day


def test_migration_gives_the_first_reading_its_counter(db, monkeypatch):
    from backend.migrations import fix_solaredge_first_reading as mig

    def reading(dev_id, minutes_ago, energy, counter=None):
        raw = {} if counter is None else {mig.DAY_TOTAL_KEY: counter}
        return models.DeviceReading(device_id=dev_id, tenant_id=TENANT, energy_kwh=energy, raw=raw,
                                    timestamp=datetime.utcnow() - timedelta(minutes=minutes_ago))

    se = models.Device(tenant_id=TENANT, name="se", protocol="solaredge_oauth", device_type="inverter", config={})
    already_ok = models.Device(tenant_id=TENANT, name="ok", protocol="solaredge_oauth", device_type="inverter", config={})
    night = models.Device(tenant_id=TENANT, name="night", protocol="solaredge_oauth", device_type="inverter", config={})
    other = models.Device(tenant_id=TENANT, name="manual", protocol="solaredge", device_type="inverter", config={})
    db.add_all([se, already_ok, night, other])
    db.flush()
    db.add_all([
        reading(se.id, 60, 0.0, counter=2.433), reading(se.id, 55, 0.467, counter=2.9),   # to be fixed
        reading(already_ok.id, 60, 1.2, counter=1.2),                                      # already counts it
        reading(night.id, 60, 0.0, counter=0.0),                                           # counter really was 0
        reading(other.id, 60, 0.0, counter=5.0),                                           # not a solaredge_oauth device
    ])
    db.commit()
    ids = (se.id, already_ok.id, night.id, other.id)

    monkeypatch.setattr(mig, "SessionLocal", lambda: db)
    mig.migrate()
    mig.migrate()  # idempotent

    def energies(dev_id):
        return [r.energy_kwh for r in db.query(models.DeviceReading).filter(
            models.DeviceReading.device_id == dev_id).order_by(models.DeviceReading.timestamp)]

    assert energies(ids[0]) == [pytest.approx(2.433), pytest.approx(0.467)]  # only the first changed
    assert energies(ids[1]) == [pytest.approx(1.2)]
    assert energies(ids[2]) == [0.0]
    assert energies(ids[3]) == [0.0]


# ─── Historical backfill (comparison record) ─────────────────────────────────

def _fake_energy(start, end):
    """Three quarter-hour buckets in the day: 100 Wh, nothing reported, 200 Wh, plus one that
    belongs to the next day (must be ignored)."""
    return [
        {"timestamp": (start + timedelta(hours=10)).isoformat(), "value": 100.0},
        {"timestamp": (start + timedelta(hours=10, minutes=15)).isoformat(), "value": None},
        {"timestamp": (start + timedelta(hours=10, minutes=30)).isoformat(), "value": 200.0},
        {"timestamp": (end + timedelta(hours=1)).isoformat(), "value": 999.0},
    ]


def _live_reading(db, when):
    _connect(db)
    dev = solaredge_sync._get_or_create_device(db, TENANT, "2951500")
    db.add(models.DeviceReading(device_id=dev.id, tenant_id=TENANT, timestamp=when, power_kw=1.0,
                                energy_kwh=0.5, raw={"live": True}))
    db.commit()
    return dev


def _backfill(db, days=3, fetch=_fake_energy, chunk_days=1):
    from datetime import timezone
    return solaredge_sync.backfill_history(db, TENANT, days, fetch=fetch, chunk_days=chunk_days,
                                           sleep=lambda s: None,
                                           now=datetime(2026, 10, 6, 10, 0, tzinfo=timezone.utc))


def test_backfill_stores_only_complete_days_before_the_first_live_reading(db):
    dev = _live_reading(db, datetime(2026, 10, 5, 4, 0))  # 06:00 local on 5 Oct
    out = _backfill(db, days=3)

    assert (out["from"], out["until"]) == ("2026-10-02", "2026-10-05")
    assert out["stored"] == 6 and out["empty_buckets"] == 3  # 3 days x (2 values + 1 null)
    rows = db.query(models.DeviceReading).filter(models.DeviceReading.device_id == dev.id).order_by(
        models.DeviceReading.timestamp).all()
    backfilled = [r for r in rows if (r.raw or {}).get(solaredge_sync.BACKFILL_KEY)]
    assert len(backfilled) == 6
    assert all(r.timestamp < datetime(2026, 10, 4, 22, 0) for r in backfilled)  # before 5 Oct local midnight
    assert sum(r.energy_kwh for r in backfilled) == pytest.approx(3 * 0.3)  # per-interval kWh, 0.1 + 0.2 a day
    assert backfilled[0].power_kw == pytest.approx(0.4)  # 0.1 kWh in a quarter hour = 0.4 kW
    assert [r for r in rows if (r.raw or {}) == {"live": True}][0].energy_kwh == 0.5  # live row untouched


def test_backfill_is_repeatable_without_duplicates(db):
    _live_reading(db, datetime(2026, 10, 5, 4, 0))
    first = _backfill(db)
    count = db.query(models.DeviceReading).count()
    second = _backfill(db)
    assert first["stored"] == 6
    assert second["stored"] == 0 and second["days_already_done"] == 3
    assert db.query(models.DeviceReading).count() == count


def test_backfill_never_writes_the_first_live_day_or_later(db):
    _live_reading(db, datetime(2026, 10, 5, 4, 0))

    def greedy(start, end):  # even if SolarEdge returned later data it would be refused
        return _fake_energy(start, end) + [{"timestamp": "2026-10-05T12:00:00+02:00", "value": 50.0}]

    out = _backfill(db, fetch=greedy)
    assert db.query(models.DeviceReading).filter(
        models.DeviceReading.timestamp >= datetime(2026, 10, 4, 22, 0),
        models.DeviceReading.timestamp != datetime(2026, 10, 5, 4, 0)).count() == 0
    assert out["stored"] == 6


def test_backfill_records_a_failed_day_and_keeps_the_rest(db):
    _live_reading(db, datetime(2026, 10, 5, 4, 0))
    calls = {"n": 0}

    def flaky(start, end):
        calls["n"] += 1
        if calls["n"] == 2:
            raise httpx.ConnectError("down")
        return _fake_energy(start, end)

    out = _backfill(db, fetch=flaky)
    assert out["days_failed"] == ["2026-10-03"] and out["stored"] == 4


def test_backfill_days_are_clamped(db):
    _live_reading(db, datetime(2026, 10, 5, 4, 0))
    out = _backfill(db, days=10_000, fetch=lambda s, e: [])
    assert out["from"] == "2026-08-06"  # 60 days before 5 Oct


def _status_error(code):
    return httpx.HTTPStatusError("x", request=None, response=FakeResponse({}, status_code=code))


def test_backfill_asks_for_several_days_per_request(db):
    _live_reading(db, datetime(2026, 10, 5, 4, 0))
    ranges = []

    def whole_range(start, end):
        ranges.append((start.date(), end.date()))
        out, day = [], start
        while day < end:
            out.append({"timestamp": (day + timedelta(hours=10)).isoformat(), "value": 100.0})
            day += timedelta(days=1)
        return out

    out = _backfill(db, days=10, fetch=whole_range, chunk_days=7)
    assert len(ranges) == 2  # 7 + 3 days, not 10 requests
    assert out["stored"] == 10 and out["days_failed"] == []


def test_backfill_stops_when_rate_limited_and_a_repeat_finishes_the_job(db):
    _live_reading(db, datetime(2026, 10, 5, 4, 0))
    calls = {"n": 0}

    def throttled_after_one(start, end):
        calls["n"] += 1
        if calls["n"] == 2:
            raise _status_error(429)
        return _fake_energy(start, end)

    first = _backfill(db, days=3, fetch=throttled_after_one)  # one day per request
    assert first["rate_limited"] is True and first["stored"] == 2
    assert first["days_failed"] == ["2026-10-03", "2026-10-04"] and calls["n"] == 2  # it stopped asking

    fetched = []
    second = _backfill(db, days=3, fetch=lambda s, e: fetched.append(s.date()) or _fake_energy(s, e))
    assert second["days_already_done"] == 1 and len(fetched) == 2  # only the missing days are requested
    assert second["stored"] == 4 and second["rate_limited"] is False
