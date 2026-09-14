"""REST coverage for /api/oauth: role gating, provider config gating, state
signing, and a full callback round-trip with httpx's token/userinfo calls
mocked (no real network calls, no real provider needed)."""
from __future__ import annotations

from datetime import datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.main import app
from backend.routers.oauth_connections import get_db as oauth_get_db
from backend.security import SECRET_KEY, ALGORITHM
import backend.config as config_module

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> str:
    return jwt.encode({"sub": sub, "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)


def _auth(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, role=role, sub=sub)}"}


def _make_state(tenant_id: int, email: str, provider: str, purpose: str = "oauth_connect", exp_minutes: int = 10) -> str:
    return jwt.encode(
        {"purpose": purpose, "tenant_id": tenant_id, "email": email, "provider": provider,
         "exp": datetime.utcnow() + timedelta(minutes=exp_minutes)},
        SECRET_KEY, algorithm=ALGORITHM,
    )


class FakeResponse:
    def __init__(self, json_data: dict, status_code: int = 200):
        self._json = json_data
        self.status_code = status_code
        self.is_success = 200 <= status_code < 300

    def json(self):
        return self._json


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

    app.dependency_overrides[oauth_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def configured_google(monkeypatch):
    monkeypatch.setattr(config_module.settings, "GOOGLE_OAUTH_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(config_module.settings, "GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret")


def _seed_user(db_session, tenant_id: int, email: str = "admin-a@x.com") -> models.User:
    tenant = db_session.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        db_session.add(models.Tenant(id=tenant_id, name=f"T{tenant_id}", slug=f"t{tenant_id}", plan="enterprise"))
        db_session.commit()
    user = models.User(tenant_id=tenant_id, email=email, password_hash="x", role="TENANT_ADMIN")
    db_session.add(user)
    db_session.commit()
    return user


class TestStatusAndRoleGating:
    def test_tenant_member_forbidden(self, client, db_session):
        resp = client.get("/api/oauth/status", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 403

    def test_lists_all_providers_unconfigured_by_default(self, client, db_session):
        resp = client.get("/api/oauth/status", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = resp.json()
        providers = {p["provider"] for p in body}
        assert providers == {"google", "microsoft", "slack"}
        assert all(p["configured"] is False for p in body)
        assert all(p["connected"] is False for p in body)

    def test_shows_configured_when_credentials_set(self, client, db_session, configured_google):
        resp = client.get("/api/oauth/status", headers=_auth(TENANT_A))
        google = next(p for p in resp.json() if p["provider"] == "google")
        assert google["configured"] is True


class TestStart:
    def test_unknown_provider_404(self, client, db_session):
        resp = client.post("/api/oauth/dropbox/start", headers=_auth(TENANT_A))
        assert resp.status_code == 404

    def test_unconfigured_provider_503(self, client, db_session):
        resp = client.post("/api/oauth/google/start", headers=_auth(TENANT_A))
        assert resp.status_code == 503

    def test_configured_provider_returns_authorize_url(self, client, db_session, configured_google):
        resp = client.post("/api/oauth/google/start", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        url = resp.json()["authorize_url"]
        assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
        assert "client_id=test-client-id" in url
        assert "state=" in url

    def test_tenant_member_cannot_start(self, client, db_session, configured_google):
        resp = client.post("/api/oauth/google/start", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 403


class TestCallback:
    def test_missing_code_redirects_error(self, client, db_session):
        resp = client.get("/api/oauth/google/callback", follow_redirects=False)
        assert resp.status_code in (302, 307)
        assert "oauth=error" in resp.headers["location"]

    def test_provider_denied_redirects_error(self, client, db_session):
        resp = client.get("/api/oauth/google/callback?error=access_denied", follow_redirects=False)
        assert "oauth=error" in resp.headers["location"]

    def test_tampered_state_rejected(self, client, db_session):
        bad_state = _make_state(TENANT_A, "admin-a@x.com", "microsoft")  # wrong provider
        resp = client.get(f"/api/oauth/google/callback?code=abc&state={bad_state}")
        assert resp.status_code == 400

    def test_full_round_trip_creates_connection(self, client, db_session, monkeypatch, configured_google):
        _seed_user(db_session, TENANT_A)
        state = _make_state(TENANT_A, "admin-a@x.com", "google")

        def fake_post(url, **kwargs):
            assert url == "https://oauth2.googleapis.com/token"
            return FakeResponse({"access_token": "tok-123", "refresh_token": "rtok-456", "expires_in": 3600, "scope": "openid email"})

        def fake_get(url, **kwargs):
            assert url == "https://openidconnect.googleapis.com/v1/userinfo"
            return FakeResponse({"email": "connected-workspace@acme.com"})

        monkeypatch.setattr(httpx, "post", fake_post)
        monkeypatch.setattr(httpx, "get", fake_get)

        resp = client.get(f"/api/oauth/google/callback?code=abc&state={state}", follow_redirects=False)
        assert resp.status_code in (302, 307)
        assert "oauth=success" in resp.headers["location"]

        conn = db_session.query(models.OAuthConnection).filter(
            models.OAuthConnection.tenant_id == TENANT_A, models.OAuthConnection.provider == "google"
        ).first()
        assert conn is not None
        assert conn.access_token == "tok-123"
        assert conn.account_label == "connected-workspace@acme.com"

    def test_slack_label_comes_from_team_name_not_userinfo_call(self, client, db_session, monkeypatch):
        monkeypatch.setattr(config_module.settings, "SLACK_OAUTH_CLIENT_ID", "slack-id")
        monkeypatch.setattr(config_module.settings, "SLACK_OAUTH_CLIENT_SECRET", "slack-secret")
        _seed_user(db_session, TENANT_A)
        state = _make_state(TENANT_A, "admin-a@x.com", "slack")

        def fake_post(url, **kwargs):
            return FakeResponse({"access_token": "xoxb-slack-token", "team": {"name": "Acme Workspace"}})

        monkeypatch.setattr(httpx, "post", fake_post)

        resp = client.get(f"/api/oauth/slack/callback?code=abc&state={state}", follow_redirects=False)
        assert "oauth=success" in resp.headers["location"]

        conn = db_session.query(models.OAuthConnection).filter(
            models.OAuthConnection.tenant_id == TENANT_A, models.OAuthConnection.provider == "slack"
        ).first()
        assert conn.account_label == "Acme Workspace"

    def test_reconnect_replaces_old_connection(self, client, db_session, monkeypatch, configured_google):
        _seed_user(db_session, TENANT_A)

        def fake_post(url, **kwargs):
            return FakeResponse({"access_token": "tok-first", "expires_in": 3600})

        monkeypatch.setattr(httpx, "post", fake_post)
        monkeypatch.setattr(httpx, "get", lambda *a, **kw: FakeResponse({"email": "a@x.com"}))

        state1 = _make_state(TENANT_A, "admin-a@x.com", "google")
        client.get(f"/api/oauth/google/callback?code=abc&state={state1}", follow_redirects=False)

        def fake_post2(url, **kwargs):
            return FakeResponse({"access_token": "tok-second", "expires_in": 3600})

        monkeypatch.setattr(httpx, "post", fake_post2)
        state2 = _make_state(TENANT_A, "admin-a@x.com", "google")
        client.get(f"/api/oauth/google/callback?code=abc&state={state2}", follow_redirects=False)

        conns = db_session.query(models.OAuthConnection).filter(
            models.OAuthConnection.tenant_id == TENANT_A, models.OAuthConnection.provider == "google"
        ).all()
        assert len(conns) == 1
        assert conns[0].access_token == "tok-second"


class TestDisconnect:
    def test_deletes_own_tenant_connection(self, client, db_session, monkeypatch, configured_google):
        _seed_user(db_session, TENANT_A)
        monkeypatch.setattr(httpx, "post", lambda *a, **kw: FakeResponse({"access_token": "tok", "expires_in": 3600}))
        monkeypatch.setattr(httpx, "get", lambda *a, **kw: FakeResponse({"email": "a@x.com"}))
        state = _make_state(TENANT_A, "admin-a@x.com", "google")
        client.get(f"/api/oauth/google/callback?code=abc&state={state}", follow_redirects=False)

        resp = client.delete("/api/oauth/google", headers=_auth(TENANT_A))
        assert resp.status_code == 204
        assert db_session.query(models.OAuthConnection).filter(
            models.OAuthConnection.tenant_id == TENANT_A
        ).count() == 0

    def test_cannot_delete_another_tenants_connection(self, client, db_session, monkeypatch, configured_google):
        _seed_user(db_session, TENANT_A, email="admin-a@x.com")
        _seed_user(db_session, TENANT_B, email="admin-b@x.com")
        monkeypatch.setattr(httpx, "post", lambda *a, **kw: FakeResponse({"access_token": "tok", "expires_in": 3600}))
        monkeypatch.setattr(httpx, "get", lambda *a, **kw: FakeResponse({"email": "a@x.com"}))
        state = _make_state(TENANT_A, "admin-a@x.com", "google")
        client.get(f"/api/oauth/google/callback?code=abc&state={state}", follow_redirects=False)

        resp = client.delete("/api/oauth/google", headers=_auth(TENANT_B, sub="admin-b@x.com"))
        assert resp.status_code == 204  # no-op, nothing to delete for tenant B
        assert db_session.query(models.OAuthConnection).filter(
            models.OAuthConnection.tenant_id == TENANT_A
        ).count() == 1
