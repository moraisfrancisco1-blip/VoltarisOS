"""REST coverage for GET /api/audit-log: role gating, tenant isolation, filters."""
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
from backend.routers.audit_log import get_db as audit_log_get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "1") -> str:
    return jwt.encode(
        {"sub": sub, "tenant_id": tenant_id, "role": role},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _auth(tenant_id: int, role: str = "TENANT_ADMIN") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, role=role)}"}


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
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[audit_log_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_entry(db_session, tenant_id: int, action: str = "trade.create", user_email: str = "a@x.com") -> int:
    entry = models.AuditLog(tenant_id=tenant_id, user_email=user_email, action=action)
    db_session.add(entry)
    db_session.commit()
    return entry.id


class TestAuditLogRoleGating:
    def test_tenant_member_is_forbidden(self, client, db_session):
        _seed_entry(db_session, TENANT_A)
        resp = client.get("/api/audit-log", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 403

    def test_tenant_admin_allowed(self, client, db_session):
        _seed_entry(db_session, TENANT_A)
        resp = client.get("/api/audit-log", headers=_auth(TENANT_A, role="TENANT_ADMIN"))
        assert resp.status_code == 200


class TestAuditLogTenantIsolation:
    def test_tenant_admin_sees_only_own_tenant(self, client, db_session):
        _seed_entry(db_session, TENANT_A, action="trade.create")
        _seed_entry(db_session, TENANT_B, action="trade.cancel")

        resp = client.get("/api/audit-log", headers=_auth(TENANT_A, role="TENANT_ADMIN"))
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert all(e["tenant_id"] == TENANT_A for e in body["entries"])

    def test_super_admin_sees_all_tenants(self, client, db_session):
        _seed_entry(db_session, TENANT_A)
        _seed_entry(db_session, TENANT_B)

        resp = client.get("/api/audit-log", headers=_auth(TENANT_A, role="SUPER_ADMIN"))
        assert resp.status_code == 200
        assert resp.json()["total"] == 2


class TestAuditLogFilters:
    def test_filter_by_action_substring(self, client, db_session):
        _seed_entry(db_session, TENANT_A, action="2fa.enabled")
        _seed_entry(db_session, TENANT_A, action="trade.create")

        resp = client.get("/api/audit-log", headers=_auth(TENANT_A), params={"action": "2fa"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["entries"][0]["action"] == "2fa.enabled"

    def test_newest_first_and_pagination(self, client, db_session):
        for i in range(3):
            _seed_entry(db_session, TENANT_A, action=f"action.{i}")

        resp = client.get("/api/audit-log", headers=_auth(TENANT_A), params={"limit": 2})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert len(body["entries"]) == 2
        assert body["entries"][0]["id"] > body["entries"][1]["id"]
