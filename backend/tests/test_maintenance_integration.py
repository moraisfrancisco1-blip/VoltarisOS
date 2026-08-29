"""Integration tests for the real Maintenance endpoints (real devices/alerts,
deterministic health, schedule severity/aging, degradation not-computable,
cross-tenant no-leak).
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main
from backend.database import Base
from backend import models
from backend.security import get_current_user
from backend.routers import maintenance as maint_mod

# StaticPool keeps a single in-memory connection so all sessions share the DB.
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

    def _auth(tenant_id, role="TENANT_ADMIN"):
        return lambda: {"id": 1, "tenant_id": tenant_id, "role": role}

    main.app.dependency_overrides[get_current_user] = _auth(1)
    main.app.dependency_overrides[maint_mod.get_db] = _override_db
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _seed_device(db, tenant_id, device_id, site_id=101, status="online", enabled=True,
                 last_seen=None, name="Dev"):
    if not db.query(models.Site).filter(models.Site.id == site_id).first():
        db.add(models.Site(id=site_id, tenant_id=tenant_id, name=f"Site-{site_id}", solar_kw=0.0))
    db.add(models.Device(id=device_id, tenant_id=tenant_id, site_id=site_id, name=name,
                         protocol="test", device_type="battery", enabled=enabled,
                         status=status, last_seen=last_seen))
    db.commit()


def test_assets_reflect_real_devices_and_alerts(client):
    db = _Session()
    _seed_device(db, 1, 1001, last_seen=datetime.utcnow() - timedelta(minutes=5))
    db.add(models.Alert(tenant_id=1, device_id=1001, severity="critical", title="X",
                        acknowledged=False, fired_at=datetime.utcnow() - timedelta(hours=2)))
    db.commit()
    db.close()

    body = client.get("/api/maintenance/assets").json()
    assets = body["assets"]
    assert len(assets) == 1
    a = assets[0]
    assert a["id"] == "1001"
    assert a["critical_alerts"] == 1
    assert a["health"] < 100  # penalised by the unacked critical alert


def test_health_score_is_deterministic(client):
    db = _Session()
    _seed_device(db, 1, 1001, status="online")
    _seed_device(db, 1, 1002, status="offline")
    db.close()

    body = client.get("/api/maintenance/assets").json()
    by_id = {a["id"]: a["health"] for a in body["assets"]}
    r2 = client.get("/api/maintenance/assets").json()
    by_id2 = {a["id"]: a["health"] for a in r2["assets"]}
    assert by_id == by_id2
    assert by_id["1002"] < by_id["1001"]  # offline is penalised


def test_schedule_uses_severity_and_aging(client):
    db = _Session()
    _seed_device(db, 1, 1001)
    db.add(models.Alert(tenant_id=1, device_id=1001, severity="warning", title="W",
                        acknowledged=False, fired_at=datetime.utcnow() - timedelta(hours=1)))
    db.add(models.Alert(tenant_id=1, device_id=1001, severity="critical", title="C",
                        acknowledged=False, fired_at=datetime.utcnow() - timedelta(days=3)))
    db.commit()
    db.close()

    body = client.get("/api/maintenance/schedule").json()
    sched = body["schedule"]
    assert len(sched) == 2
    # Critical alert must rank above the warning one.
    crit = next(s for s in sched if s["source"].startswith("alert:") and s["severity"] == "critical")
    warn = next(s for s in sched if s["source"].startswith("alert:") and s["severity"] == "warning")
    assert crit["priority"] > warn["priority"]
    assert all(s["estimated_cost"] is None for s in sched)


def test_degradation_is_not_computable_and_no_random(client):
    db = _Session()
    _seed_device(db, 1, 1001)
    db.close()

    r1 = client.get("/api/maintenance/degradation/1001").json()
    r2 = client.get("/api/maintenance/degradation/1001").json()
    assert r1["computable"] is False
    assert r1["degradation"] is None
    assert r1 == r2  # no random values


def test_cross_tenant_degradation_is_no_leak(client):
    db = _Session()
    _seed_device(db, 2, 2001, site_id=201)
    db.close()

    # Tenant 1 (the authed client) must not see tenant 2's device.
    r = client.get("/api/maintenance/degradation/2001")
    assert r.status_code == 404
    # Assets must not include tenant 2's device.
    body = client.get("/api/maintenance/assets").json()
    assert body["assets"] == []
