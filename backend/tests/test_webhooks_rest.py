"""REST coverage for /api/webhooks: role gating, tenant isolation, validation,
and that a real audited action actually enqueues delivery (without a live
Celery worker/Redis -- deliver_webhook.delay is monkeypatched)."""
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
from backend.routers.webhooks import get_db as webhooks_get_db
from backend.routers.api_keys import get_db as api_keys_get_db
from backend.security import SECRET_KEY, ALGORITHM
import backend.tasks as tasks_module

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> str:
    return jwt.encode({"sub": sub, "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)


def _auth(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, role=role, sub=sub)}"}


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


@pytest.fixture(autouse=True)
def captured_deliveries(monkeypatch):
    """Autouse: NO test in this file may ever call the real Celery .delay(),
    which would try to reach a live Redis broker and hang/retry for a long
    time when none is running locally. Every test gets this for free; tests
    that care about dispatch inspect the returned list."""
    calls = []
    monkeypatch.setattr(tasks_module.deliver_webhook, "delay", lambda *a, **kw: calls.append((a, kw)))
    return calls


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[webhooks_get_db] = _override
    app.dependency_overrides[api_keys_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_admin(db_session, tenant_id: int, email: str = "admin-a@x.com") -> models.User:
    user = models.User(tenant_id=tenant_id, email=email, password_hash="x", role="TENANT_ADMIN")
    db_session.add(user)
    db_session.commit()
    return user


class TestWebhookRoleGating:
    def test_tenant_member_cannot_create(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        resp = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A, role="TENANT_MEMBER"),
        )
        assert resp.status_code == 403


class TestWebhookValidation:
    def test_rejects_non_http_url(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        resp = client.post(
            "/api/webhooks",
            json={"url": "ftp://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 422

    def test_rejects_unknown_event_type(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        resp = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["totally.made.up"]},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 422

    def test_rejects_empty_event_types(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        resp = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": []},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 422


class TestWebhookCrud:
    def test_create_returns_secret_and_list_shows_it(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["api_key.created"]},
            headers=_auth(TENANT_A),
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["secret"].startswith("whsec_")

        listed = client.get("/api/webhooks", headers=_auth(TENANT_A))
        assert listed.status_code == 200
        assert listed.json()[0]["secret"] == body["secret"]

    def test_update_event_types_and_active(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A),
        ).json()

        resp = client.patch(
            f"/api/webhooks/{created['id']}",
            json={"active": False, "event_types": ["vpp.bid.submitted"]},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200
        assert resp.json()["active"] is False
        assert resp.json()["event_types"] == ["vpp.bid.submitted"]

    def test_delete(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A),
        ).json()

        resp = client.delete(f"/api/webhooks/{created['id']}", headers=_auth(TENANT_A))
        assert resp.status_code == 204
        assert client.get("/api/webhooks", headers=_auth(TENANT_A)).json() == []


class TestWebhookCrossTenantDenial:
    def test_tenant_b_cannot_see_or_modify_tenant_a_webhook(self, client, db_session):
        _seed_admin(db_session, TENANT_A, email="admin-a@x.com")
        _seed_admin(db_session, TENANT_B, email="admin-b@x.com")
        created = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A),
        ).json()

        assert client.get("/api/webhooks", headers=_auth(TENANT_B, sub="admin-b@x.com")).json() == []
        resp = client.delete(
            f"/api/webhooks/{created['id']}", headers=_auth(TENANT_B, sub="admin-b@x.com")
        )
        assert resp.status_code == 404


class TestWebhookRealDispatch:
    def test_matching_real_action_enqueues_delivery(self, client, db_session, captured_deliveries):
        """The whole point of this feature: creating an API key is a REAL,
        already-firing log_audit_event("api_key.created", ...) call site
        (backend/routers/api_keys.py) -- a webhook subscribed to it must
        actually get enqueued for delivery when that happens for real."""
        _seed_admin(db_session, TENANT_A)
        client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["api_key.created"]},
            headers=_auth(TENANT_A),
        )

        client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A))

        assert len(captured_deliveries) == 1
        args, _ = captured_deliveries[0]
        assert args[1] == "api_key.created"

    def test_non_matching_action_does_not_enqueue(self, client, db_session, captured_deliveries):
        _seed_admin(db_session, TENANT_A)
        client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["vpp.bid.submitted"]},
            headers=_auth(TENANT_A),
        )

        client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A))

        assert captured_deliveries == []

    def test_wildcard_matches_everything(self, client, db_session, captured_deliveries):
        _seed_admin(db_session, TENANT_A)
        client.post(
            "/api/webhooks", json={"url": "https://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A),
        )
        captured_deliveries.clear()  # discard the webhook.created dispatch itself

        client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A))

        assert len(captured_deliveries) == 1

    def test_inactive_webhook_does_not_receive_events(self, client, db_session, captured_deliveries):
        _seed_admin(db_session, TENANT_A)
        created = client.post(
            "/api/webhooks",
            json={"url": "https://example.com/hook", "event_types": ["api_key.created"]},
            headers=_auth(TENANT_A),
        ).json()
        client.patch(f"/api/webhooks/{created['id']}", json={"active": False}, headers=_auth(TENANT_A))
        captured_deliveries.clear()

        client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A))

        assert captured_deliveries == []

    def test_manual_test_endpoint_enqueues(self, client, db_session, captured_deliveries):
        _seed_admin(db_session, TENANT_A)
        created = client.post(
            "/api/webhooks", json={"url": "https://example.com/hook", "event_types": ["*"]},
            headers=_auth(TENANT_A),
        ).json()
        captured_deliveries.clear()

        resp = client.post(f"/api/webhooks/{created['id']}/test", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert len(captured_deliveries) == 1
        args, _ = captured_deliveries[0]
        assert args[1] == "webhook.test"
