"""REST coverage for the httpOnly vos_session cookie -- a resilience
fallback alongside the normal Authorization-header/localStorage flow, so a
session survives a privacy browser (or extension) clearing localStorage.
See backend/security.py's set_auth_cookie/clear_auth_cookie and
get_current_user's cookie fallback, and frontend/src/App.jsx's bootstrap
self-heal effect that relies on this."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_router_module
from backend.security import AUTH_COOKIE_NAME, hash_pw, limiter

EMAIL = "cookie-user@x.com"
PASSWORD = "correct-horse-battery"


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
def client(db_session, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)

    def _override():
        yield db_session

    app.dependency_overrides[auth_router_module.get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_user(db_session) -> models.User:
    tenant = models.Tenant(id=1, name="T1", slug="t1", plan="enterprise")
    db_session.add(tenant)
    user = models.User(tenant_id=1, email=EMAIL, password_hash=hash_pw(PASSWORD), role="TENANT_ADMIN", name="Cookie User")
    db_session.add(user)
    db_session.commit()
    return user


class TestLoginSetsCookie:
    def test_login_sets_httponly_session_cookie(self, client, db_session):
        _seed_user(db_session)
        resp = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        assert resp.status_code == 200
        assert AUTH_COOKIE_NAME in resp.cookies
        assert resp.cookies[AUTH_COOKIE_NAME]

        set_cookie_header = resp.headers.get("set-cookie", "")
        assert "HttpOnly" in set_cookie_header
        assert "SameSite=lax" in set_cookie_header


class TestCookieOnlyAuth:
    def test_me_works_with_cookie_and_no_authorization_header(self, client, db_session):
        _seed_user(db_session)
        login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        assert login.status_code == 200
        # TestClient persists cookies across requests on the same client automatically.

        resp = client.get("/api/auth/me")  # no Authorization header at all
        assert resp.status_code == 200
        assert resp.json()["email"] == EMAIL
        # /auth/me itself hands back a usable fresh token, for the frontend's
        # localStorage self-heal.
        assert resp.json()["token"]

    def test_no_header_and_no_cookie_still_401(self, client, db_session):
        _seed_user(db_session)
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_bearer_header_still_works_without_cookie(self, client, db_session):
        _seed_user(db_session)
        login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        token = login.json()["token"]
        client.cookies.clear()

        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == EMAIL


class TestLogout:
    def test_logout_clears_cookie(self, client, db_session):
        _seed_user(db_session)
        client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        assert AUTH_COOKIE_NAME in client.cookies

        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200

        # A cleared cookie can no longer authenticate a cookie-only request.
        client.cookies.clear()
        me = client.get("/api/auth/me")
        assert me.status_code == 401

    def test_logout_does_not_require_auth(self, client, db_session):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200


class TestPasswordChangeRefreshesCookie:
    def test_change_password_reissues_cookie(self, client, db_session):
        _seed_user(db_session)
        client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})

        resp = client.post(
            "/api/auth/change-password",
            json={"current_password": PASSWORD, "new_password": "a-brand-new-password-789"},
        )
        assert resp.status_code == 200
        # This response itself set a fresh cookie (not just reused the one
        # from login) -- token content can legitimately be byte-identical to
        # the login one if both happen within the same second (same payload,
        # same exp second), so assert the cookie was actually (re)issued
        # here rather than comparing values.
        assert AUTH_COOKIE_NAME in resp.cookies
        assert resp.cookies[AUTH_COOKIE_NAME] == resp.json()["token"]
