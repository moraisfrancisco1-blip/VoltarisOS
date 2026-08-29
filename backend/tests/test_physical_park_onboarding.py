"""E2E for the first physical park production onboarding.

tenant -> site (IANA timezone) -> device (external_id) -> gateway ingest via
external_id -> persistence/online -> carbon -> maintenance -> idempotent retry
-> cross-tenant isolation -> production readiness check (no secrets).

Uses controlled synthetic data (no random).
"""
from datetime import datetime, timezone, timedelta
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main
import backend.cache as backend_cache
from backend.database import Base
from backend import models
from backend.security import get_current_user, require_ingest_identity
from backend.routers import devices as devices_mod
from backend.routers import carbon as carbon_mod
from backend.routers import maintenance as maint_mod
from backend.routers import alerts_ws as alerts_mod
from backend.routers import sites as sites_mod
from backend.routers import operations as ops_mod

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
    main.app.dependency_overrides[alerts_mod.get_db] = _override_db
    main.app.dependency_overrides[sites_mod.get_db] = _override_db
    main.app.dependency_overrides[ops_mod.get_db] = _override_db

    holder = {
        "user": {"id": 1, "tenant_id": 1, "role": "TENANT_ADMIN"},
        "gateway": {"sub": "gateway-1", "role": "GATEWAY", "tenant_id": 1},
    }
    main.app.dependency_overrides[get_current_user] = lambda: holder["user"]
    main.app.dependency_overrides[require_ingest_identity] = lambda: holder["gateway"]

    db = _Session()
    db.add(models.Tenant(id=1, name="T1", slug="t1", plan="enterprise"))
    db.add(models.Tenant(id=2, name="T2", slug="t2", plan="enterprise"))
    db.commit()
    db.close()

    client = TestClient(main.app)
    yield client, holder
    main.app.dependency_overrides.clear()


def _seed_migrations():
    db = _Session()
    db.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR PRIMARY KEY, applied_at TIMESTAMP NOT NULL)"))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for m in ops_mod.REQUIRED_MIGRATIONS:
        db.execute(text("INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (:n, :t)"), {"n": m, "t": now})
    db.commit()
    db.close()


def _site_payload(timezone=None):
    payload = {"name": "PV Lisboa", "location": "Lisboa", "lat": 38.7, "lng": -9.1,
               "solar_kw": 500.0, "battery_kwh": 0.0, "ev_chargers": 0,
               "owner": "ParkCo", "status": "active"}
    if timezone is not None:
        payload["timezone"] = timezone
    return payload


def test_site_timezone_valid_and_invalid(ctx):
    client, _ = ctx
    ok = client.post("/api/sites", json=_site_payload(timezone="Europe/Lisbon"))
    assert ok.status_code == 201, ok.text
    assert ok.json()["timezone"] == "Europe/Lisbon"

    bad = client.post("/api/sites", json=_site_payload(timezone="Mars/Olympus"))
    assert bad.status_code == 422, bad.text


def test_external_id_unique_within_tenant(ctx):
    client, _ = ctx
    assert client.post("/api/devices", json={"name": "D1", "protocol": "solaredge", "external_id": "EXT-1"}).status_code == 201
    dup = client.post("/api/devices", json={"name": "D2", "protocol": "solaredge", "external_id": "EXT-1"})
    assert dup.status_code == 409, dup.text


def test_external_id_allowed_across_tenants(ctx):
    client, holder = ctx
    assert client.post("/api/devices", json={"name": "T1-D", "protocol": "solaredge", "external_id": "EXT-9"}).status_code == 201
    holder["user"] = {"id": 2, "tenant_id": 2, "role": "TENANT_ADMIN"}
    r = client.post("/api/devices", json={"name": "T2-D", "protocol": "solaredge", "external_id": "EXT-9"})
    assert r.status_code == 201, r.text


def test_tenant_a_cannot_ingest_tenant_b_device_via_external_id(ctx):
    client, holder = ctx
    holder["user"] = {"id": 2, "tenant_id": 2, "role": "TENANT_ADMIN"}
    assert client.post("/api/devices", json={"name": "T2-D", "protocol": "solaredge", "external_id": "EXT-B"}).status_code == 201
    holder["user"] = {"id": 1, "tenant_id": 1, "role": "TENANT_ADMIN"}
    holder["gateway"] = {"sub": "gateway-1", "role": "GATEWAY", "tenant_id": 1}
    ts = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    r = client.post("/api/devices/ingest/batch", json={"readings": [
        {"external_id": "EXT-B", "timestamp": ts, "power_kw": 10.0, "energy_kwh": 0.5}]})
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 0
    assert r.json()["rejected"] == 1


def test_ingest_via_external_id_and_idempotent_retry(ctx):
    client, _ = ctx
    assert client.post("/api/devices", json={"name": "INV-01", "protocol": "solaredge", "external_id": "SN-1001"}).status_code == 201
    ts = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    payload = {"readings": [{"external_id": "SN-1001", "timestamp": ts, "power_kw": 120.0, "energy_kwh": 0.5}]}
    r1 = client.post("/api/devices/ingest/batch", json=payload)
    assert r1.status_code == 202, r1.text
    assert r1.json()["accepted"] == 1
    r2 = client.post("/api/devices/ingest/batch", json=payload)  # idempotent retry
    assert r2.status_code == 202, r2.text
    assert r2.json()["duplicated"] == 1
    db = _Session()
    count = db.query(models.DeviceReading).join(models.Device, models.DeviceReading.device_id == models.Device.id).filter(
        models.Device.external_id == "SN-1001").count()
    db.close()
    assert count == 1


def test_onboarding_flow_end_to_end(ctx):
    client, _ = ctx
    # 1. create site (timezone)
    r = client.post("/api/sites", json=_site_payload(timezone="Europe/Lisbon"))
    assert r.status_code == 201, r.text
    site_id = r.json()["id"]
    # 2. create device (external_id)
    r = client.post("/api/devices", json={"name": "INV-01", "site_id": site_id, "protocol": "solaredge",
                                          "device_type": "inverter", "external_id": "SN-ABC-1001", "enabled": True})
    assert r.status_code == 201, r.text
    dev_id = r.json()["id"]
    assert r.json()["external_id"] == "SN-ABC-1001"
    # 3. gateway ingest via external_id
    ts = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    r = client.post("/api/devices/ingest/batch", json={"readings": [
        {"external_id": "SN-ABC-1001", "timestamp": ts, "power_kw": 120.0, "energy_kwh": 0.5}]})
    assert r.status_code == 202, r.text
    assert r.json()["accepted"] == 1
    # 4. device online + reading persisted
    db = _Session()
    dev = db.query(models.Device).filter_by(id=dev_id).first()
    assert dev.status == "online"
    assert db.query(models.DeviceReading).filter_by(device_id=dev_id).count() == 1
    db.close()
    # 5. carbon sees energy
    body = client.get("/api/carbon/overview").json()
    assert body["solar_today_kwh"] == 0.5
    # 6. maintenance sees the device
    m = client.get("/api/maintenance/assets").json()
    assert str(dev_id) in [str(a["id"]) for a in m["assets"]]


def test_readiness_not_configured_when_not_set_up(monkeypatch, ctx):
    client, holder = ctx
    holder["user"] = {"id": 1, "tenant_id": 1, "role": "SUPER_ADMIN"}
    monkeypatch.setenv("RUN_CELERY", "0")
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("GATEWAY_API_KEYS", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    _seed_migrations()
    r = client.get("/api/admin/production-readiness")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "not_configured"
    assert body["components"]["redis"]["status"] == "not_configured"
    assert body["components"]["ingest_auth"]["status"] == "not_configured"
    assert body["run_celery"] is False


def test_readiness_degraded_when_redis_unreachable(monkeypatch, ctx):
    client, holder = ctx
    holder["user"] = {"id": 1, "tenant_id": 1, "role": "SUPER_ADMIN"}
    monkeypatch.setenv("RUN_CELERY", "1")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:9999/0")
    monkeypatch.setenv("GATEWAY_API_KEYS", "{\"k1\": 1}")
    class _FakeRedis:
        is_connected = False
    monkeypatch.setattr(backend_cache, "cache", _FakeRedis())
    monkeypatch.setattr(ops_mod, "_celery_state", lambda: {
        "status": "no_workers", "required": True, "workers": [], "offline_detection_beat": "configured"})
    _seed_migrations()
    r = client.get("/api/admin/production-readiness")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "degraded"
    assert body["components"]["redis"]["status"] == "unavailable"


def test_readiness_healthy_when_deps_exist(monkeypatch, ctx):
    client, holder = ctx
    holder["user"] = {"id": 1, "tenant_id": 1, "role": "SUPER_ADMIN"}
    monkeypatch.setenv("RUN_CELERY", "1")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("GATEWAY_API_KEYS", "{\"k1\": 1}")
    monkeypatch.setenv("ENVIRONMENT", "production")
    class _FakeRedis:
        is_connected = True
    monkeypatch.setattr(backend_cache, "cache", _FakeRedis())
    monkeypatch.setattr(ops_mod, "_celery_state", lambda: {
        "status": "healthy", "required": True, "workers": ["w1"], "offline_detection_beat": "configured"})
    _seed_migrations()
    r = client.get("/api/admin/production-readiness")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "healthy"
    assert body["components"]["database"]["status"] == "healthy"
    assert body["components"]["redis"]["status"] == "healthy"


def test_readiness_no_secret_exposure(monkeypatch, ctx):
    client, holder = ctx
    holder["user"] = {"id": 1, "tenant_id": 1, "role": "SUPER_ADMIN"}
    secret = "super-secret-gateway-key-value"
    monkeypatch.setenv("GATEWAY_API_KEYS", json.dumps({secret: 1}))
    monkeypatch.setenv("RUN_CELERY", "0")
    _seed_migrations()
    r = client.get("/api/admin/production-readiness")
    assert r.status_code == 200, r.text
    assert secret not in r.text
    assert "GATEWAY_API_KEYS" not in r.text


