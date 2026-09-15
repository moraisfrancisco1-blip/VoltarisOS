"""REST coverage for /api/tenant-settings: real, tenant-wide persistence of
the Settings > Energy/Trading/Notifications tabs, previously localStorage-only
(invisible to the backend, lost on another device). Also covers the real
Slack test-message send, previously a plain alert() with no request sent."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.main import app
from backend.routers.tenant_settings import get_db as ts_get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1


def _auth(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> dict:
    token = jwt.encode({"sub": sub, "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[ts_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_tenant(db_session, tenant_id: int) -> models.Tenant:
    tenant = models.Tenant(id=tenant_id, name=f"T{tenant_id}", slug=f"t{tenant_id}", plan="enterprise")
    db_session.add(tenant)
    db_session.commit()
    return tenant


class TestTenantSettings:
    def test_requires_auth(self, client, db_session):
        resp = client.get("/api/tenant-settings")
        assert resp.status_code == 401

    def test_get_creates_empty_row_for_new_tenant(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.get("/api/tenant-settings", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 200
        assert resp.json() == {"energy": None, "trading": None, "notifications": None}

    def test_member_cannot_patch(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.patch(
            "/api/tenant-settings", json={"energy": {"currency": "USD"}},
            headers=_auth(TENANT_A, role="TENANT_MEMBER"),
        )
        assert resp.status_code == 403

    def test_admin_updates_energy_block(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.patch(
            "/api/tenant-settings",
            json={"energy": {"currency": "USD", "socMin": 20}},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200
        assert resp.json()["energy"] == {"currency": "USD", "socMin": 20}
        assert resp.json()["trading"] is None

    def test_updates_merge_not_replace(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        client.patch("/api/tenant-settings", json={"energy": {"currency": "USD", "socMin": 20}}, headers=_auth(TENANT_A))
        resp = client.patch("/api/tenant-settings", json={"energy": {"socMin": 30}}, headers=_auth(TENANT_A))
        assert resp.json()["energy"] == {"currency": "USD", "socMin": 30}

    def test_persists_across_requests(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        client.patch("/api/tenant-settings", json={"trading": {"autoTradingEnabled": True}}, headers=_auth(TENANT_A))
        again = client.get("/api/tenant-settings", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert again.json()["trading"] == {"autoTradingEnabled": True}

    def test_test_notification_requires_saved_webhook(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.post("/api/tenant-settings/notifications/test", headers=_auth(TENANT_A))
        assert resp.status_code == 400

    def test_test_notification_sends_real_request(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A)
        client.patch(
            "/api/tenant-settings",
            json={"notifications": {"slackWebhook": "https://hooks.slack.com/services/T00/B00/xxx"}},
            headers=_auth(TENANT_A),
        )

        calls = []

        class _FakeResponse:
            status_code = 200
            text = "ok"

        def _fake_post(url, json=None, timeout=None):
            calls.append((url, json))
            return _FakeResponse()

        monkeypatch.setattr("backend.routers.tenant_settings.httpx.post", _fake_post)

        resp = client.post("/api/tenant-settings/notifications/test", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert len(calls) == 1
        assert calls[0][0] == "https://hooks.slack.com/services/T00/B00/xxx"
        assert "text" in calls[0][1]
