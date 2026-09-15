"""REST coverage for PATCH /api/auth/me: real persistence of name/email/
phone/job_title, email-uniqueness validation, and a fresh token on email
change (old token's `sub` would otherwise point at the wrong address)."""
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
    if not db_session.query(models.Tenant).filter_by(id=tenant_id).first():
        db_session.add(models.Tenant(id=tenant_id, name=f"T{tenant_id}", slug=f"t{tenant_id}", plan="beta"))
    user = models.User(tenant_id=tenant_id, email=email, password_hash="x", role="TENANT_MEMBER", name="Old Name")
    db_session.add(user)
    db_session.commit()
    return user


class TestUpdateProfile:
    def test_requires_auth(self, client, db_session):
        resp = client.patch("/api/auth/me", json={"name": "New Name"})
        assert resp.status_code == 401

    def test_updates_name(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.patch("/api/auth/me", json={"name": "New Name"}, headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

        me = client.get("/api/auth/me", headers=_auth(TENANT_A))
        assert me.json()["name"] == "New Name"

    def test_updates_phone_and_job_title(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.patch(
            "/api/auth/me", json={"phone": "+351 912 000 000", "job_title": "CTO"}, headers=_auth(TENANT_A)
        )
        assert resp.status_code == 200
        assert resp.json()["phone"] == "+351 912 000 000"
        assert resp.json()["job_title"] == "CTO"

        me = client.get("/api/auth/me", headers=_auth(TENANT_A)).json()
        assert me["phone"] == "+351 912 000 000"
        assert me["job_title"] == "CTO"

    def test_rejects_empty_name(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.patch("/api/auth/me", json={"name": "   "}, headers=_auth(TENANT_A))
        assert resp.status_code == 400

    def test_rejects_invalid_email(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.patch("/api/auth/me", json={"email": "not-an-email"}, headers=_auth(TENANT_A))
        assert resp.status_code == 400

    def test_rejects_email_already_taken(self, client, db_session):
        _seed_user(db_session, TENANT_A, email="user-a@x.com")
        _seed_user(db_session, TENANT_A, email="user-b@x.com")
        resp = client.patch("/api/auth/me", json={"email": "user-b@x.com"}, headers=_auth(TENANT_A, sub="user-a@x.com"))
        assert resp.status_code == 409

    def test_email_change_issues_fresh_token_and_works_immediately(self, client, db_session):
        _seed_user(db_session, TENANT_A, email="old@x.com")
        resp = client.patch("/api/auth/me", json={"email": "new@x.com"}, headers=_auth(TENANT_A, sub="old@x.com"))
        assert resp.status_code == 200
        new_token = resp.json()["token"]
        assert new_token

        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "new@x.com"

    def test_no_op_when_value_unchanged_does_not_fail(self, client, db_session):
        _seed_user(db_session, TENANT_A)
        resp = client.patch("/api/auth/me", json={"name": "Old Name"}, headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert "token" not in resp.json()
