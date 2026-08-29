"""E2E for the first physical park operational chain.

tenant -> site -> device -> authenticated ingest -> persistence -> query ->
monitoring -> carbon/maintenance -> cross-tenant rejection.

Uses controlled synthetic data (no random). The ingested timestamp is
timezone-aware to also lock in the naive/aware normalization fix in ingest.
"""
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main
from backend.database import Base
from backend import models
from backend.security import get_current_user, require_ingest_identity
from backend.routers import devices as devices_mod
from backend.routers import carbon as carbon_mod
from backend.routers import maintenance as maint_mod

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine)
Base.metadata.create_all(_engine)


@pytest.fixture()
def ctx():
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    def _override_db():
        db = _Session()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[devices_mod.get_db] = _override_db
    main.app.dependency_overrides[carbon_mod.get_db] = _override_db
    main.app.dependency_overrides[maint_mod.get_db] = _override_db

    # Authenticated operator (reads) and gateway identity (ingest).
    main.app.dependency_overrides[get_current_user] = lambda: {"id": 1, "tenant_id": 1, "role": "TENANT_ADMIN"}
    main.app.dependency_overrides[require_ingest_identity] = lambda: {"sub": "gateway-1", "role": "GATEWAY", "tenant_id": 1}

    db = _Session()
    db.add(models.Tenant(id=1, name="Parque Solar Lisboa", slug="parque-lisboa", plan="enterprise"))
    db.add(models.Site(id=101, tenant_id=1, name="PV Lisboa Norte", solar_kw=500.0, battery_kwh=0.0,
                       lat=38.7, lng=-9.1))
    db.add(models.Device(id=1001, tenant_id=1, site_id=101, name="Inverter PV-01", protocol="solaredge",
                         device_type="inverter", enabled=True, status="unknown",
                         config={"serial": "SN-ABC-123", "api_key": "***"}))
    db.commit()
    db.close()

    client = TestClient(main.app)
    yield client
    main.app.dependency_overrides.clear()


def _payload():
    ts = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()  # tz-aware, not in the future
    return {"readings": [
        {"device_id": 1001, "timestamp": ts, "power_kw": 120.0, "energy_kwh": 0.5, "temp_c": 42.0},
    ]}


def test_physical_park_chain(ctx):
    # 1. Authenticated gateway ingests real telemetry (tz-aware timestamp).
    r = ctx.post("/api/devices/ingest/batch", json=_payload())
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 1
    assert r.json()["rejected"] == 0

    # 2. Reading persisted, normalized to naive UTC, and queryable.
    rr = ctx.get("/api/devices/1001/readings")
    assert rr.status_code == 200
    readings = rr.json()
    assert len(readings) == 1
    assert readings[0]["power_kw"] == 120.0
    assert readings[0]["energy_kwh"] == 0.5
    assert readings[0]["timestamp"].endswith("+00:00") is False  # naive UTC stored

    # 3. Device marked online (monitoring baseline).
    ar = ctx.get("/api/maintenance/assets")
    assert ar.status_code == 200
    assets = ar.json()["assets"]
    assert len(assets) == 1
    assert assets[0]["status"] == "online"
    assert assets[0]["last_seen"] is not None

    # 4. Carbon reflects the real energy (inverter is solar-capable).
    cr = ctx.get("/api/carbon/overview")
    assert cr.status_code == 200
    assert cr.json()["solar_today_kwh"] > 0

    # 5. Cross-tenant gateway is rejected (no cross-tenant writes).
    main.app.dependency_overrides[require_ingest_identity] = lambda: {"sub": "gateway-2", "role": "GATEWAY", "tenant_id": 2}
    r2 = ctx.post("/api/devices/ingest/batch", json=_payload())
    assert r2.status_code == 202
    assert r2.json()["accepted"] == 0
    assert r2.json()["rejected"] == 1


def test_tz_aware_timestamp_does_not_crash(ctx):
    # Regression: aware timestamps must not crash validation (mixed naive/aware).
    r = ctx.post("/api/devices/ingest/batch", json=_payload())
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 1


def test_energy_mode_cumulative_total_rejected(ctx):
    # A cumulative energy value must never be silently treated as interval delta.
    payload = _payload()
    payload["readings"][0]["energy_mode"] = "cumulative_total"
    payload["readings"][0]["energy_kwh"] = 12345.0  # cumulative-looking value
    r = ctx.post("/api/devices/ingest/batch", json=payload)
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 0
    assert r.json()["rejected"] == 1


def test_energy_mode_interval_delta_accepted(ctx):
    payload = _payload()
    payload["readings"][0]["energy_mode"] = "interval_delta"
    r = ctx.post("/api/devices/ingest/batch", json=payload)
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 1


def _same_ts():
    return (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()


def test_individual_ingest_repeated_is_idempotent(ctx):
    ts = _same_ts()
    payload = {"timestamp": ts, "power_kw": 10.0, "energy_kwh": 0.5}
    r1 = ctx.post("/api/devices/1001/ingest", json=payload)
    assert r1.status_code == 201, r1.text
    assert r1.json()["duplicated"] is False
    r2 = ctx.post("/api/devices/1001/ingest", json=payload)
    assert r2.status_code == 201, r2.text
    assert r2.json()["duplicated"] is True
    db = _Session()
    count = db.query(models.DeviceReading).filter_by(device_id=1001).count()
    db.close()
    assert count == 1


def test_batch_partial_duplicate(ctx):
    ts_first = (datetime.now(timezone.utc) - timedelta(seconds=3)).isoformat()
    ctx.post("/api/devices/1001/ingest", json={"timestamp": ts_first, "power_kw": 5.0, "energy_kwh": 0.2})
    ts2 = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()
    ts3 = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    r = ctx.post("/api/devices/ingest/batch", json={"readings": [
        {"device_id": 1001, "timestamp": ts_first, "power_kw": 5.0, "energy_kwh": 0.2},  # duplicate
        {"device_id": 1001, "timestamp": ts2, "power_kw": 10.0, "energy_kwh": 0.5},
        {"device_id": 1001, "timestamp": ts3, "power_kw": 11.0, "energy_kwh": 0.6},
    ]})
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["accepted"] == 2
    assert body["duplicated"] == 1
    assert body["rejected"] == 0


def test_retry_does_not_double_energy(ctx):
    ts = _same_ts()
    payload = {"timestamp": ts, "power_kw": 10.0, "energy_kwh": 0.5}
    ctx.post("/api/devices/1001/ingest", json=payload)
    ctx.post("/api/devices/1001/ingest", json=payload)  # duplicate
    body = ctx.get("/api/carbon/overview").json()
    assert body["solar_today_kwh"] == 0.5  # not summed twice


def test_different_timestamps_both_accepted(ctx):
    ts1 = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()
    ts2 = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    r = ctx.post("/api/devices/ingest/batch", json={"readings": [
        {"device_id": 1001, "timestamp": ts1, "power_kw": 10.0, "energy_kwh": 0.5},
        {"device_id": 1001, "timestamp": ts2, "power_kw": 11.0, "energy_kwh": 0.6},
    ]})
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 2
    assert r.json()["duplicated"] == 0


def test_unique_constraint_backstop(ctx):
    from sqlalchemy.exc import IntegrityError
    ts = _same_ts()
    ctx.post("/api/devices/1001/ingest", json={"timestamp": ts, "power_kw": 10.0, "energy_kwh": 0.5})
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    # bypass the API pre-check to prove the DB-level unique index is the race backstop
    db = _Session()
    db.add(models.DeviceReading(device_id=1001, tenant_id=1, timestamp=dt, power_kw=99.0))
    try:
        db.commit()
        raise AssertionError("expected IntegrityError on duplicate (device_id, timestamp)")
    except IntegrityError:
        db.rollback()
    finally:
        db.close()
