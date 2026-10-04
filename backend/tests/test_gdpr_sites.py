"""RGPD for sites: a site can be a home, so its telemetry is personal data. Export
omits credentials; erasure removes the site, its devices and every reading, summary,
alert and rule, and touches nothing of another site or tenant."""
from __future__ import annotations

import json
import secrets
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models, retention
from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_module
from backend.routers import privacy as privacy_module
from backend.routers import webhooks as webhooks_module
from backend.security import ALGORITHM, SECRET_KEY, limiter
import backend.tasks as tasks_module

DEVICE_SECRET = "t-" + secrets.token_hex(8)
OWNER = "Ana Silva"
NOW = models.utcnow_naive()


def H(email="boss@x.com", role="TENANT_ADMIN", tenant_id=1):
    tok = jwt.encode({"sub": email, "role": role, "tenant_id": tenant_id}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    s.add_all([models.Tenant(id=1, name="A", slug="a", plan="pro", max_sites=9),
               models.Tenant(id=2, name="B", slug="b", plan="pro", max_sites=9)])
    s.add_all([models.User(id=1, tenant_id=1, email="boss@x.com", password_hash="x", role="TENANT_ADMIN", active=True),
               models.User(id=2, tenant_id=1, email="member@x.com", password_hash="x", role="TENANT_MEMBER", active=True),
               models.User(id=3, tenant_id=2, email="other@x.com", password_hash="x", role="TENANT_ADMIN", active=True)])
    s.add_all([models.Site(id=10, tenant_id=1, name="Casa da Ana", owner=OWNER, location="Rua X, Porto", lat=41.1, lng=-8.6),
               models.Site(id=11, tenant_id=1, name="Outra casa"),
               models.Site(id=20, tenant_id=2, name="Casa B")])
    s.commit()
    s.add_all([models.Device(id=100, tenant_id=1, site_id=10, name="Inversor", protocol="modbus", config={"token": DEVICE_SECRET}),
               models.Device(id=101, tenant_id=1, site_id=10, name="Bateria", protocol="modbus", config={}),
               models.Device(id=110, tenant_id=1, site_id=11, name="Inversor 2", protocol="modbus", config={}),
               models.Device(id=200, tenant_id=2, site_id=20, name="Inversor B", protocol="modbus", config={})])
    s.commit()
    for dev, tid in ((100, 1), (101, 1), (110, 1), (200, 2)):
        for i in range(3):
            s.add(models.DeviceReading(tenant_id=tid, device_id=dev, timestamp=NOW - timedelta(hours=i), power_kw=1.5))
        s.add(models.DeviceReadingHourly(tenant_id=tid, device_id=dev, hour_start=NOW.replace(minute=0, second=0, microsecond=0),
                                         sample_count=3, power_kw_avg=1.5))
        s.add(models.Alert(tenant_id=tid, device_id=dev, title="t", severity="warning"))
        s.add(models.AlertRule(tenant_id=tid, device_id=dev, name="r", metric="power_kw", operator=">", threshold=1))
    s.add(models.VPPGroup(id=1, tenant_id=1, name="g"))
    s.commit()
    s.add(models.VPPSiteMembership(vpp_id=1, site_id=10))
    s.commit()
    try:
        yield s
    finally:
        s.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(tasks_module.deliver_webhook, "delay", lambda *a, **kw: None)

    def _get_db():
        yield db

    for module in (privacy_module, auth_module, webhooks_module):
        app.dependency_overrides[module.get_db] = _get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def count(db, model, **kw):
    db.expire_all()
    return db.query(model).filter_by(**kw).count()


class TestExport:
    def test_contains_the_household_data_and_never_the_device_credentials(self, client):
        r = client.get("/api/privacy/sites/10/export", headers=H())
        assert r.status_code == 200
        body = r.json()
        assert body["site"]["owner"] == OWNER and body["site"]["lat"] == 41.1
        assert sorted(d["name"] for d in body["devices"]) == ["Bateria", "Inversor"]
        assert len(body["hourly_summaries"]) == 2 and len(body["alerts"]) == 2
        assert body["raw_readings"] == {"stored_count": 6, "included_days": 0, "rows": []}
        assert DEVICE_SECRET not in json.dumps(body) and "config" not in json.dumps(body)

    def test_raw_readings_are_included_on_request_and_bounded(self, client):
        body = client.get("/api/privacy/sites/10/export?raw_days=7", headers=H()).json()
        assert len(body["raw_readings"]["rows"]) == 6 and body["raw_readings"]["included_days"] == 7
        assert client.get("/api/privacy/sites/10/export?raw_days=91", headers=H()).status_code == 400
        assert client.get("/api/privacy/sites/10/export?raw_days=-1", headers=H()).status_code == 400

    def test_another_sites_data_is_not_in_the_export(self, client):
        body = client.get("/api/privacy/sites/10/export", headers=H()).json()
        assert all(d["id"] in (100, 101) for d in body["devices"])

    def test_cross_tenant_is_a_404_and_members_are_refused(self, client):
        assert client.get("/api/privacy/sites/20/export", headers=H()).status_code == 404
        assert client.get("/api/privacy/sites/10/export", headers=H("member@x.com", "TENANT_MEMBER")).status_code == 403

    def test_a_super_admin_may_export_any_site(self, client):
        assert client.get("/api/privacy/sites/20/export", headers=H("root@x.com", "SUPER_ADMIN", 99)).status_code == 200


class TestErasure:
    def test_needs_the_confirmation_word(self, client, db):
        assert client.post("/api/privacy/sites/10/erase", headers=H(), json={"confirm": "yes"}).status_code == 400
        assert count(db, models.Site, id=10) == 1

    def test_removes_the_site_its_devices_and_every_trace_of_telemetry(self, client, db):
        r = client.post("/api/privacy/sites/10/erase", headers=H(), json={"confirm": "ERASE"})
        assert r.status_code == 200, r.text
        assert r.json()["raw_readings"] == 6 and r.json()["hourly_summaries"] == 2 and r.json()["devices"] == 2
        assert count(db, models.Site, id=10) == 0
        for dev in (100, 101):
            assert count(db, models.Device, id=dev) == 0
            assert count(db, models.DeviceReading, device_id=dev) == 0
            assert count(db, models.DeviceReadingHourly, device_id=dev) == 0
            assert count(db, models.Alert, device_id=dev) == 0
            assert count(db, models.AlertRule, device_id=dev) == 0
        assert count(db, models.VPPSiteMembership, site_id=10) == 0

    def test_touches_nothing_of_other_sites_or_tenants(self, client, db):
        client.post("/api/privacy/sites/10/erase", headers=H(), json={"confirm": "ERASE"})
        for site, dev in ((11, 110), (20, 200)):
            assert count(db, models.Site, id=site) == 1 and count(db, models.Device, id=dev) == 1
            assert count(db, models.DeviceReading, device_id=dev) == 3
            assert count(db, models.DeviceReadingHourly, device_id=dev) == 1
            assert count(db, models.Alert, device_id=dev) == 1 and count(db, models.AlertRule, device_id=dev) == 1

    def test_the_audit_event_has_counts_and_no_personal_data(self, client, db):
        client.post("/api/privacy/sites/10/erase", headers=H(), json={"confirm": "ERASE"})
        event = db.query(models.AuditLog).filter_by(action="privacy.site_erased").one()
        assert event.target_id == 10
        blob = json.dumps([event.details, event.target_resource])
        assert OWNER not in blob and "Casa da Ana" not in blob and "Porto" not in blob
        assert event.details["raw_readings"] == 6

    def test_cross_tenant_and_members_cannot_erase(self, client, db):
        assert client.post("/api/privacy/sites/20/erase", headers=H(), json={"confirm": "ERASE"}).status_code == 404
        assert client.post("/api/privacy/sites/10/erase", headers=H("member@x.com", "TENANT_MEMBER"), json={"confirm": "ERASE"}).status_code == 403
        assert count(db, models.Site, id=20) == 1 and count(db, models.Site, id=10) == 1

    def test_erasing_a_site_without_devices_works(self, client, db):
        db.query(models.Device).filter_by(site_id=11).delete()
        db.commit()
        r = client.post("/api/privacy/sites/11/erase", headers=H(), json={"confirm": "ERASE"})
        assert r.status_code == 200 and r.json()["devices"] == 0 and count(db, models.Site, id=11) == 0


class TestHourlyRetention:
    def test_default_is_unchanged_keep_forever(self):
        assert retention.retention_days(retention.POLICIES["DEVICE_READINGS_HOURLY"]) == 0

    def test_a_configured_limit_deletes_old_summaries_only(self, db, monkeypatch):
        monkeypatch.setenv("RETENTION_DEVICE_READINGS_HOURLY_DAYS", "400")
        db.add(models.DeviceReadingHourly(tenant_id=1, device_id=100, hour_start=NOW - timedelta(days=500), sample_count=1))
        db.commit()
        retention.run_retention(db, NOW, dry_run=False, only=["DEVICE_READINGS_HOURLY"])
        db.expire_all()
        remaining = db.query(models.DeviceReadingHourly).filter_by(device_id=100).all()
        assert len(remaining) == 1 and remaining[0].hour_start > NOW - timedelta(days=2)

    def test_the_floor_protects_the_raw_to_hourly_summarisation(self, monkeypatch):
        monkeypatch.setenv("RETENTION_DEVICE_READINGS_HOURLY_DAYS", "30")
        assert retention.retention_days(retention.POLICIES["DEVICE_READINGS_HOURLY"]) == 365
