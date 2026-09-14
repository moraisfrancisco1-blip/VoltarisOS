"""REST coverage for /api/api-keys: role gating, tenant isolation, and that a
generated key actually authenticates against a real protected endpoint."""
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
from backend.routers.api_keys import get_db as api_keys_get_db
from backend.routers.sites import get_db as sites_get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> str:
    return jwt.encode(
        {"sub": sub, "tenant_id": tenant_id, "role": role},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _auth(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, role=role, sub=sub)}"}


@pytest.fixture()
def db_session(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    # security.py's _resolve_api_key opens its own session via
    # `from backend.database import SessionLocal` (not a FastAPI dependency,
    # so dependency_overrides can't reach it) -- point that at the same
    # in-memory engine so a key created in the test is actually verifiable.
    monkeypatch.setattr("backend.database.SessionLocal", TestSession)
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

    app.dependency_overrides[api_keys_get_db] = _override
    app.dependency_overrides[sites_get_db] = _override
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


class TestApiKeyRoleGating:
    def test_tenant_member_cannot_create(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        resp = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 403

    def test_tenant_admin_can_create(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        resp = client.post("/api/api-keys", json={"name": "CI script"}, headers=_auth(TENANT_A))
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["key"].startswith("vos_")
        assert body["key_prefix"] == body["key"][:12]
        assert "key_hash" not in body


class TestApiKeyPlaintextOnlyOnCreate:
    def test_list_never_returns_plaintext(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A))
        resp = client.get("/api/api-keys", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert "key" not in body[0]
        assert "key_hash" not in body[0]
        assert body[0]["key_prefix"].startswith("vos_")


class TestApiKeyActuallyAuthenticates:
    def test_created_key_authenticates_as_tenant_member(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A)).json()
        plaintext = created["key"]

        resp = client.get("/api/sites", headers={"Authorization": f"Bearer {plaintext}"})
        assert resp.status_code == 200, resp.text

    def test_created_key_is_tenant_scoped(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        site_a = models.Site(tenant_id=TENANT_A, name="A", location="X", lat=0, lng=0, solar_kw=1, battery_kwh=1, ev_chargers=0, owner="o")
        site_b = models.Site(tenant_id=TENANT_B, name="B", location="X", lat=0, lng=0, solar_kw=1, battery_kwh=1, ev_chargers=0, owner="o")
        db_session.add_all([site_a, site_b])
        db_session.commit()

        created = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A)).json()
        resp = client.get("/api/sites", headers={"Authorization": f"Bearer {created['key']}"})
        assert resp.status_code == 200
        names = {s["name"] for s in resp.json()}
        assert names == {"A"}

    def test_revoked_key_stops_authenticating(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A)).json()
        plaintext = created["key"]

        del_resp = client.delete(f"/api/api-keys/{created['id']}", headers=_auth(TENANT_A))
        assert del_resp.status_code == 204

        resp = client.get("/api/sites", headers={"Authorization": f"Bearer {plaintext}"})
        assert resp.status_code == 401

    def test_revoked_key_disappears_from_list(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A)).json()
        client.delete(f"/api/api-keys/{created['id']}", headers=_auth(TENANT_A))

        resp = client.get("/api/api-keys", headers=_auth(TENANT_A))
        assert resp.json() == []

    def test_rotate_invalidates_old_secret_and_returns_new_one(self, client, db_session):
        _seed_admin(db_session, TENANT_A)
        created = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A)).json()
        old_key = created["key"]

        rotated = client.post(f"/api/api-keys/{created['id']}/rotate", headers=_auth(TENANT_A))
        assert rotated.status_code == 200
        new_key = rotated.json()["key"]
        assert new_key != old_key
        assert rotated.json()["id"] == created["id"]

        assert client.get("/api/sites", headers={"Authorization": f"Bearer {old_key}"}).status_code == 401
        assert client.get("/api/sites", headers={"Authorization": f"Bearer {new_key}"}).status_code == 200


class TestApiKeyCrossTenantDenial:
    def test_tenant_b_admin_cannot_revoke_tenant_a_key(self, client, db_session):
        _seed_admin(db_session, TENANT_A, email="admin-a@x.com")
        _seed_admin(db_session, TENANT_B, email="admin-b@x.com")
        created = client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A)).json()

        resp = client.delete(
            f"/api/api-keys/{created['id']}",
            headers=_auth(TENANT_B, sub="admin-b@x.com"),
        )
        assert resp.status_code == 404

    def test_tenant_b_admin_does_not_see_tenant_a_keys(self, client, db_session):
        _seed_admin(db_session, TENANT_A, email="admin-a@x.com")
        _seed_admin(db_session, TENANT_B, email="admin-b@x.com")
        client.post("/api/api-keys", json={"name": "x"}, headers=_auth(TENANT_A))

        resp = client.get("/api/api-keys", headers=_auth(TENANT_B, sub="admin-b@x.com"))
        assert resp.json() == []
