"""Tenant onboarding: creating the tenant's first user with a temporary password.

Covers the full first-login flow:
- POST /api/admin/tenants creates the tenant AND its first user (TENANT_ADMIN)
  with a temporary password (given, or generated and echoed once);
- that account can log in but is blocked on platform routes until it changes
  the password (403 from the shared guard);
- POST /api/auth/change-password clears the flag and returns a fresh, usable
  token;
- SUPER_ADMIN is exempt from the whole flow;
- existing behaviour is untouched for accounts/tokens without the flag.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_router_module
from backend.security import SECRET_KEY, ALGORITHM, limiter, verify_pw

TEMP_PASSWORD = "temp-password-123"
NEW_PASSWORD = "brand-new-password-456"


def _token(role: str, **extra) -> str:
    payload = {"sub": "admin@test.com", "role": role, "tenant_id": 1}
    payload.update(extra)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _sa_headers() -> dict:
    return {"Authorization": f"Bearer {_token('SUPER_ADMIN')}"}


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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
    # Login is rate-limited (10/minute) in production; disable it here so the
    # number of logins these tests make cannot make the suite flaky.
    monkeypatch.setattr(limiter, "enabled", False)

    def _override():
        yield db_session

    app.dependency_overrides[auth_router_module.get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _create_tenant(client, **overrides):
    payload = {"name": "Acme Energy", "plan": "starter"}
    payload.update(overrides)
    return client.post("/api/admin/tenants", json=payload, headers=_sa_headers())


def _login(client, email: str, password: str):
    return client.post("/api/auth/login", json={"email": email, "password": password})


# ─── Creation ────────────────────────────────────────────────────────────────
def test_create_tenant_with_first_user(client, db_session):
    resp = _create_tenant(client, admin_name="Ana Silva", admin_email="Ana@Acme.com", admin_password=TEMP_PASSWORD)
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["name"] == "Acme Energy"
    first = body["first_user"]
    assert first is not None
    assert first["email"] == "ana@acme.com"          # normalized
    assert first["name"] == "Ana Silva"
    assert first["role"] == "TENANT_ADMIN"           # never SUPER_ADMIN
    assert first["must_change_password"] is True
    assert first["generated"] is False
    assert first["temporary_password"] is None       # typed by the admin

    user = db_session.query(models.User).filter_by(email="ana@acme.com").first()
    assert user is not None
    assert user.tenant_id == body["id"]              # bound to the new tenant
    assert user.role == "TENANT_ADMIN"
    assert user.active is True
    assert user.must_change_password is True
    assert verify_pw(TEMP_PASSWORD, user.password_hash)


def test_create_tenant_without_first_user_still_works(client, db_session):
    resp = _create_tenant(client)
    assert resp.status_code == 201, resp.text
    assert resp.json()["first_user"] is None
    assert db_session.query(models.User).count() == 0


def test_generated_temporary_password_is_returned_once(client):
    resp = _create_tenant(client, admin_email="owner@acme.com")
    assert resp.status_code == 201, resp.text
    first = resp.json()["first_user"]
    assert first["generated"] is True
    assert isinstance(first["temporary_password"], str)
    assert len(first["temporary_password"]) >= 8

    # …and it actually authenticates the new account.
    login = _login(client, "owner@acme.com", first["temporary_password"])
    assert login.status_code == 200, login.text
    assert login.json()["must_change_password"] is True


# ─── Validation ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "case",
    [
        {"admin_email": "not-an-email"},
        {"admin_email": "user@acme.com", "admin_password": "short"},
    ],
)
def test_first_user_validation_errors(client, db_session, case):
    resp = _create_tenant(client, **case)
    assert resp.status_code == 422, resp.text
    # Nothing is written when the payload is rejected.
    assert db_session.query(models.Tenant).count() == 0


def test_duplicate_email_is_rejected_and_no_tenant_is_created(client, db_session):
    assert _create_tenant(client, admin_email="dup@acme.com", admin_password=TEMP_PASSWORD).status_code == 201
    resp = _create_tenant(client, name="Other Co", slug="other-co", admin_email="dup@acme.com", admin_password=TEMP_PASSWORD)
    assert resp.status_code == 409, resp.text
    assert "email" in resp.json()["detail"].lower()
    assert db_session.query(models.Tenant).filter_by(slug="other-co").first() is None


# ─── First login: forced password change ─────────────────────────────────────
def test_temporary_password_account_is_gated_until_password_changed(client):
    _create_tenant(client, admin_email="gated@acme.com", admin_password=TEMP_PASSWORD)

    login = _login(client, "gated@acme.com", TEMP_PASSWORD)
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["must_change_password"] is True

    # The claim travels in the token so every guarded route can enforce it.
    claims = jwt.decode(body["token"], SECRET_KEY, algorithms=[ALGORITHM])
    assert claims["must_change_password"] is True

    token = body["token"]
    blocked = client.get("/api/auth/users", headers=_headers(token))
    assert blocked.status_code == 403
    assert "password temporária" in blocked.json()["detail"].lower()

    # /auth/me stays reachable (the UI needs it to render the gate).
    assert client.get("/api/auth/me", headers=_headers(token)).status_code == 200

    change = client.post(
        "/api/auth/change-password",
        json={"current_password": TEMP_PASSWORD, "new_password": NEW_PASSWORD},
        headers=_headers(token),
    )
    assert change.status_code == 200, change.text
    assert change.json()["must_change_password"] is False
    new_token = change.json()["token"]
    assert jwt.decode(new_token, SECRET_KEY, algorithms=[ALGORITHM])["must_change_password"] is False

    # Same account, fresh token: platform access is restored.
    assert client.get("/api/auth/users", headers=_headers(new_token)).status_code == 200
    # The login password is now the new one.
    assert _login(client, "gated@acme.com", NEW_PASSWORD).status_code == 200
    assert _login(client, "gated@acme.com", TEMP_PASSWORD).status_code == 401


def test_change_password_requires_the_current_password(client):
    _create_tenant(client, admin_email="wrong@acme.com", admin_password=TEMP_PASSWORD)
    token = _login(client, "wrong@acme.com", TEMP_PASSWORD).json()["token"]

    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "not-the-temp-password", "new_password": NEW_PASSWORD},
        headers=_headers(token),
    )
    assert resp.status_code == 401


# ─── SUPER_ADMIN is outside this flow ────────────────────────────────────────
def test_super_admin_is_exempt_from_the_password_gate(client, db_session):
    """Even if the flag somehow ends up set, SUPER_ADMIN keeps full access —
    the platform owner account is never part of tenant onboarding."""
    db_session.add(models.Tenant(id=1, name="Platform", slug="platform"))
    db_session.add(models.User(
        tenant_id=1, email="root@voltaris.com", password_hash="x",
        name="Root", role="SUPER_ADMIN", active=True, must_change_password=True,
    ))
    db_session.commit()

    token = _token("SUPER_ADMIN", must_change_password=True, sub="root@voltaris.com")
    assert client.get("/api/auth/users", headers=_headers(token)).status_code == 200


# ─── No regression for pre-existing accounts/tokens ──────────────────────────
def test_token_without_the_flag_is_unaffected(client):
    token = _token("TENANT_ADMIN")  # legacy-shaped token, no must_change_password
    assert client.get("/api/auth/users", headers=_headers(token)).status_code == 200
