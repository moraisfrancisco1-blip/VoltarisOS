"""Integration tests for automatic alert rules after ingest + offline detection,
reconnect and tenant isolation.

Automatic alert rules: after a valid reading is persisted, evaluate_rules_sync
fires deduplicated alerts. Offline detection: backend.tasks.detect_offline_devices
marks stale devices offline with a single communication alert; reconnection on the
next reading auto-resolves only that communication alert.
"""
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main
import backend.database as dbmod
from backend.database import Base
from backend import models
from backend.security import get_current_user, require_ingest_identity
from backend.routers import devices as devices_mod
from backend.routers import alerts_ws as alerts_mod
from backend.routers import maintenance as maint_mod

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine)
Base.metadata.create_all(_engine)


@pytest.fixture()
def client():
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    def _override_db():
        db = _Session()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[devices_mod.get_db] = _override_db
    main.app.dependency_overrides[alerts_mod.get_db] = _override_db
    main.app.dependency_overrides[maint_mod.get_db] = _override_db
    main.app.dependency_overrides[get_current_user] = lambda: {"id": 1, "tenant_id": 1, "role": "TENANT_ADMIN"}
    main.app.dependency_overrides[require_ingest_identity] = lambda: {"sub": "gateway-1", "role": "GATEWAY", "tenant_id": 1}

    db = _Session()
    db.add(models.Tenant(id=1, name="T1", slug="t1", plan="enterprise"))
    db.add(models.Tenant(id=2, name="T2", slug="t2", plan="enterprise"))
    db.commit()
    db.close()

    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _seed_device(tenant_id, device_id, site_id=101, status="online", last_seen=None, enabled=True):
    db = _Session()
    if not db.query(models.Site).filter(models.Site.id == site_id).first():
        db.add(models.Site(id=site_id, tenant_id=tenant_id, name=f"Site-{site_id}", solar_kw=0.0))
    db.add(models.Device(id=device_id, tenant_id=tenant_id, site_id=site_id, name=f"Dev-{device_id}",
                         protocol="test", device_type="inverter", enabled=enabled,
                         status=status, last_seen=last_seen))
    db.commit()
    db.close()


def _seed_rule(metric="temp_c", operator="gt", threshold=40.0, severity="warning", tenant_id=1):
    db = _Session()
    db.add(models.AlertRule(tenant_id=tenant_id, name="Rule", metric=metric, operator=operator,
                            threshold=threshold, severity=severity, enabled=True))
    db.commit()
    db.close()


def _payload(device_id, **fields):
    ts = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    item = {"device_id": device_id, "timestamp": ts}
    item.update(fields)
    return {"readings": [item]}


def _count_alerts(device_id=None, metric=None, acknowledged=None):
    db = _Session()
    q = db.query(models.Alert)
    if device_id is not None:
        q = q.filter(models.Alert.device_id == device_id)
    if metric is not None:
        q = q.filter(models.Alert.metric == metric)
    if acknowledged is not None:
        q = q.filter(models.Alert.acknowledged.is_(acknowledged))
    c = q.count()
    db.close()
    return c


def test_ingest_fires_rule_alert(client):
    _seed_device(1, 1001)
    _seed_rule(metric="temp_c", operator="gt", threshold=40.0)
    r = client.post("/api/devices/ingest/batch", json=_payload(1001, temp_c=50.0))
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 1
    assert _count_alerts(device_id=1001, metric="temp_c") == 1


def test_persistent_condition_no_duplicate(client):
    _seed_device(1, 1001)
    _seed_rule(metric="temp_c", operator="gt", threshold=40.0)
    client.post("/api/devices/ingest/batch", json=_payload(1001, temp_c=50.0))
    client.post("/api/devices/ingest/batch", json=_payload(1001, temp_c=55.0))
    assert _count_alerts(device_id=1001, metric="temp_c", acknowledged=False) == 1


def test_batch_ingest_evaluates(client):
    _seed_device(1, 1001)
    _seed_device(1, 1002)
    _seed_rule(metric="power_kw", operator="gt", threshold=100.0)
    r = client.post("/api/devices/ingest/batch", json={
        "readings": [
            {"device_id": 1001, "timestamp": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(), "power_kw": 150.0},
            {"device_id": 1002, "timestamp": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(), "power_kw": 200.0},
        ]
    })
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 2
    assert _count_alerts(device_id=1001, metric="power_kw") == 1
    assert _count_alerts(device_id=1002, metric="power_kw") == 1


def test_offline_detection_and_reconnect(monkeypatch):
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)
    now = datetime.utcnow()
    _seed_device(1, 1001, status="online", last_seen=now - timedelta(minutes=60))
    db = _Session()
    db.add(models.Tenant(id=1, name="T1", slug="t1", plan="enterprise"))
    db.add(models.Alert(tenant_id=1, device_id=1001, severity="critical", title="Temp",
                        metric="temp_c", acknowledged=False))
    db.commit()
    db.close()

    # point the task's SessionLocal at our test DB
    monkeypatch.setattr(dbmod, "SessionLocal", lambda: _Session())

    from backend.tasks import detect_offline_devices
    res = detect_offline_devices.run()
    assert res["flipped_offline"] == 1
    assert _count_alerts(device_id=1001, metric="communication", acknowledged=False) == 1
    assert _count_alerts(device_id=1001, metric="temp_c", acknowledged=False) == 1  # untouched

    # idempotent: running again does not duplicate
    res2 = detect_offline_devices.run()
    assert res2["flipped_offline"] == 0
    assert _count_alerts(device_id=1001, metric="communication", acknowledged=False) == 1

    # reconnection via a fresh reading
    def _override_db():
        db = _Session()
        try:
            yield db
        finally:
            db.close()
    main.app.dependency_overrides[devices_mod.get_db] = _override_db
    main.app.dependency_overrides[get_current_user] = lambda: {"id": 1, "tenant_id": 1, "role": "TENANT_ADMIN"}
    main.app.dependency_overrides[require_ingest_identity] = lambda: {"sub": "gateway-1", "role": "GATEWAY", "tenant_id": 1}
    c = TestClient(main.app)
    r = c.post("/api/devices/ingest/batch", json=_payload(1001, power_kw=10.0))
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 1

    db = _Session()
    dev = db.query(models.Device).filter_by(id=1001).first()
    assert dev.status == "online"
    assert dev.last_seen is not None
    db.close()
    # communication alert resolved, temp alert still open
    assert _count_alerts(device_id=1001, metric="communication", acknowledged=False) == 0
    assert _count_alerts(device_id=1001, metric="temp_c", acknowledged=False) == 1
    main.app.dependency_overrides.clear()


def test_last_seen_null_device_untouched(monkeypatch):
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)
    _seed_device(1, 1001, status="unknown", last_seen=None)
    monkeypatch.setattr(dbmod, "SessionLocal", lambda: _Session())
    from backend.tasks import detect_offline_devices
    res = detect_offline_devices.run()
    assert res["checked"] == 0  # never-reported devices are not candidates
    db = _Session()
    dev = db.query(models.Device).filter_by(id=1001).first()
    assert dev.status == "unknown"
    db.close()
    assert _count_alerts(device_id=1001, metric="communication") == 0


def test_tenant_isolation_alerts(client):
    _seed_device(1, 1001, site_id=101)
    _seed_device(2, 2001, site_id=201)
    db = _Session()
    db.query(models.Device).filter_by(id=2001).update({"last_seen": datetime.utcnow() - timedelta(minutes=60)})
    db.commit()
    db.close()

    # client is tenant 1; tenant 2's device/alert must not be visible
    ar = client.get("/api/maintenance/assets")
    assert ar.status_code == 200
    ids = [a["id"] for a in ar.json()["assets"]]
    assert "2001" not in ids



def test_duplicate_reading_does_not_fire_alert_twice(client):
    _seed_device(1, 1001, site_id=101)
    _seed_rule(metric="temp_c", operator="gt", threshold=40.0)
    ts = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    payload = {"readings": [{"device_id": 1001, "timestamp": ts, "temp_c": 50.0}]}
    r1 = client.post("/api/devices/ingest/batch", json=payload)
    assert r1.status_code == 202, r1.text
    assert r1.json()["accepted"] == 1
    # retry the exact same reading (same device_id + timestamp)
    r2 = client.post("/api/devices/ingest/batch", json=payload)
    assert r2.status_code == 202, r2.text
    assert r2.json()["duplicated"] == 1
    # only one alert fired for the single persisted reading
    assert _count_alerts(device_id=1001, metric="temp_c", acknowledged=False) == 1
