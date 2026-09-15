"""REST coverage for POST/DELETE /api/auth/me/avatar: content-type/size
validation, real persistence (round-trips through /api/auth/me), and that
it requires auth."""
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
from backend.routers.auth import get_db as auth_get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1

# Smallest possible valid PNG (1x1 transparent pixel), well under the 300KB cap.
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
    "00000049454e44ae426082"
)


def _make_jwt(tenant_id: int, sub: str = "user-a@x.com") -> str:
    return jwt.encode({"sub": sub, "tenant_id": tenant_id, "role": "TENANT_MEMBER"}, SECRET_KEY, algorithm=ALGORITHM)


def _auth(tenant_id: int, sub: str = "user-a@x.com") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, sub=sub)}"}


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

    app.dependency_overrides[auth_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_user(db_session, tenant_id: int, email: str = "user-a@x.com") -> models.User:
    db_session.add(models.Tenant(id=tenant_id, name=f"T{tenant_id}", slug=f"t{tenant_id}", plan="beta"))
    user = models.User(tenant_id=tenant_id, email=email, password_hash="x", role="TENANT_MEMBER", name="User A")
    db_session.add(user)
    db_session.commit()
    return user


class TestAvatarUpload:
    def test_requires_auth(self, client, db_session):
        resp = client.post("/api/auth/me/avatar", files={"file": ("a.png", TINY_PNG, "image/png")})
        assert resp.status_code == 401

    def test_valid_png_stored_and_returned(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.post(
            "/api/auth/me/avatar", files={"file": ("a.png", TINY_PNG, "image/png")}, headers=_auth(TENANT_A)
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["avatar_url"].startswith("data:image/png;base64,")

    def test_rejects_wrong_content_type(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.post(
            "/api/auth/me/avatar", files={"file": ("a.txt", b"not an image", "text/plain")}, headers=_auth(TENANT_A)
        )
        assert resp.status_code == 400

    def test_rejects_oversized_file(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        oversized = b"\x00" * (300 * 1024 + 1)
        resp = client.post(
            "/api/auth/me/avatar", files={"file": ("a.png", oversized, "image/png")}, headers=_auth(TENANT_A)
        )
        assert resp.status_code == 400

    def test_rejects_empty_file(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.post(
            "/api/auth/me/avatar", files={"file": ("a.png", b"", "image/png")}, headers=_auth(TENANT_A)
        )
        assert resp.status_code == 400

    def test_persists_and_shows_in_me_endpoint(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        client.post("/api/auth/me/avatar", files={"file": ("a.png", TINY_PNG, "image/png")}, headers=_auth(TENANT_A))

        me = client.get("/api/auth/me", headers=_auth(TENANT_A))
        assert me.status_code == 200
        assert me.json()["avatar_url"].startswith("data:image/png;base64,")

    def test_reupload_replaces_previous(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        client.post("/api/auth/me/avatar", files={"file": ("a.png", TINY_PNG, "image/png")}, headers=_auth(TENANT_A))
        resp = client.post(
            "/api/auth/me/avatar", files={"file": ("b.gif", b"GIF89a" + b"\x00" * 20, "image/gif")},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200
        assert resp.json()["avatar_url"].startswith("data:image/gif;base64,")


class TestAvatarRemove:
    def test_requires_auth(self, client, db_session):
        resp = client.delete("/api/auth/me/avatar")
        assert resp.status_code == 401

    def test_removes_avatar(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        client.post("/api/auth/me/avatar", files={"file": ("a.png", TINY_PNG, "image/png")}, headers=_auth(TENANT_A))

        resp = client.delete("/api/auth/me/avatar", headers=_auth(TENANT_A))
        assert resp.status_code == 200

        me = client.get("/api/auth/me", headers=_auth(TENANT_A))
        assert me.json()["avatar_url"] is None
