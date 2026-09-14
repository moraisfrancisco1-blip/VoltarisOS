"""REST coverage for /api/white-label: role+plan gating, validation, tenant
isolation, and both the no-Railway-configured and Railway-configured paths
(the latter with railway_client mocked -- no real network calls)."""
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
from backend.routers.white_label import get_db as wl_get_db
from backend.security import SECRET_KEY, ALGORITHM
import backend.railway_client as railway_client

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> str:
    return jwt.encode({"sub": sub, "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)


def _auth(tenant_id: int, role: str = "TENANT_ADMIN", sub: str = "admin-a@x.com") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, role=role, sub=sub)}"}


@pytest.fixture()
def db_session(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    # check_module_access (backend/security.py) opens its own session via
    # `from backend.database import SessionLocal` (not a FastAPI dependency,
    # so dependency_overrides can't reach it) -- point that at the same
    # in-memory engine so plan gating sees the tenant this test seeded.
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

    app.dependency_overrides[wl_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_tenant(db_session, tenant_id: int, plan: str = "enterprise") -> models.Tenant:
    tenant = models.Tenant(id=tenant_id, name=f"Tenant {tenant_id}", slug=f"tenant-{tenant_id}", plan=plan)
    db_session.add(tenant)
    db_session.commit()
    return tenant


class TestRoleAndPlanGating:
    def test_tenant_member_is_forbidden(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.post(
            "/api/white-label/domain", json={"domain": "app.example.com"},
            headers=_auth(TENANT_A, role="TENANT_MEMBER"),
        )
        assert resp.status_code == 403

    def test_non_enterprise_plan_is_forbidden(self, client, db_session):
        # "beta" is deliberately all-access ({"*"}) during the beta program
        # (see permissions.py) -- "pro" is the highest tier that still
        # excludes admin_* modules, so it actually exercises the gate.
        _seed_tenant(db_session, TENANT_A, plan="pro")
        resp = client.post(
            "/api/white-label/domain", json={"domain": "app.example.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 403

    def test_enterprise_admin_allowed(self, client, db_session):
        _seed_tenant(db_session, TENANT_A, plan="enterprise")
        resp = client.post(
            "/api/white-label/domain", json={"domain": "app.example.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200, resp.text


class TestDomainValidation:
    def test_rejects_url_with_scheme(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.post(
            "/api/white-label/domain", json={"domain": "https://app.example.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 422

    def test_rejects_platform_reserved_domain(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.post(
            "/api/white-label/domain", json={"domain": "evil.voltarisos.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 422

    def test_rejects_domain_taken_by_another_tenant(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        other = _seed_tenant(db_session, TENANT_B)
        other.custom_domain = "app.example.com"
        db_session.commit()

        resp = client.post(
            "/api/white-label/domain", json={"domain": "app.example.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 409


class TestNoRailwayConfigured:
    def test_request_stores_pending_manual_setup(self, client, db_session, monkeypatch):
        monkeypatch.setattr(railway_client, "is_configured", lambda: False)
        _seed_tenant(db_session, TENANT_A)

        resp = client.post(
            "/api/white-label/domain", json={"domain": "app.example.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending_manual_setup"
        assert body["cname_target"] is None
        assert body["railway_configured"] is False


class TestRailwayConfigured:
    def test_request_stores_real_dns_instructions(self, client, db_session, monkeypatch):
        monkeypatch.setattr(railway_client, "is_configured", lambda: True)
        monkeypatch.setattr(railway_client, "create_custom_domain", lambda domain: {
            "id": "rw-domain-1",
            "domain": domain,
            "status": {
                "verificationToken": "verify-token-xyz",
                "dnsRecords": [{"hostlabel": "@", "requiredValue": "abc123.up.railway.app", "status": "PENDING"}],
            },
        })
        _seed_tenant(db_session, TENANT_A)

        resp = client.post(
            "/api/white-label/domain", json={"domain": "app.example.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending_dns"
        assert body["cname_target"] == "abc123.up.railway.app"
        assert body["verification_value"] == "verify-token-xyz"

    def test_get_refreshes_live_status_to_active(self, client, db_session, monkeypatch):
        monkeypatch.setattr(railway_client, "is_configured", lambda: True)
        monkeypatch.setattr(railway_client, "create_custom_domain", lambda domain: {
            "id": "rw-domain-1", "domain": domain,
            "status": {"verificationToken": "t", "dnsRecords": [{"hostlabel": "@", "requiredValue": "x", "status": "PENDING"}]},
        })
        _seed_tenant(db_session, TENANT_A)
        client.post("/api/white-label/domain", json={"domain": "app.example.com"}, headers=_auth(TENANT_A))

        monkeypatch.setattr(railway_client, "get_custom_domain_status", lambda rid: {
            "id": rid, "domain": "app.example.com",
            "status": {"certificateStatus": "ISSUED", "dnsRecords": [{"status": "VALID"}]},
        })
        resp = client.get("/api/white-label/domain", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_get_lazily_provisions_when_railway_becomes_configured(self, client, db_session, monkeypatch):
        monkeypatch.setattr(railway_client, "is_configured", lambda: False)
        _seed_tenant(db_session, TENANT_A)
        client.post("/api/white-label/domain", json={"domain": "app.example.com"}, headers=_auth(TENANT_A))

        monkeypatch.setattr(railway_client, "is_configured", lambda: True)
        monkeypatch.setattr(railway_client, "create_custom_domain", lambda domain: {
            "id": "rw-domain-2", "domain": domain,
            "status": {"verificationToken": "t2", "dnsRecords": [{"hostlabel": "@", "requiredValue": "y", "status": "PENDING"}]},
        })
        resp = client.get("/api/white-label/domain", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "pending_dns"
        assert body["cname_target"] == "y"

    def test_delete_calls_railway_and_clears_fields(self, client, db_session, monkeypatch):
        monkeypatch.setattr(railway_client, "is_configured", lambda: True)
        monkeypatch.setattr(railway_client, "create_custom_domain", lambda domain: {
            "id": "rw-domain-3", "domain": domain,
            "status": {"verificationToken": "t", "dnsRecords": [{"hostlabel": "@", "requiredValue": "x", "status": "PENDING"}]},
        })
        deleted_ids = []
        monkeypatch.setattr(railway_client, "delete_custom_domain", lambda rid: deleted_ids.append(rid))

        _seed_tenant(db_session, TENANT_A)
        client.post("/api/white-label/domain", json={"domain": "app.example.com"}, headers=_auth(TENANT_A))

        resp = client.delete("/api/white-label/domain", headers=_auth(TENANT_A))
        assert resp.status_code == 204
        assert deleted_ids == ["rw-domain-3"]

        status_resp = client.get("/api/white-label/domain", headers=_auth(TENANT_A))
        assert status_resp.json()["domain"] is None


class TestPublicBranding:
    def test_returns_branding_for_active_domain(self, client, db_session):
        tenant = _seed_tenant(db_session, TENANT_A)
        tenant.name = "Acme Energy"
        tenant.logo_url = "https://cdn.example.com/logo.png"
        tenant.primary_color = "#123456"
        tenant.custom_domain = "app.acme.com"
        tenant.custom_domain_status = "active"
        db_session.commit()

        resp = client.get("/api/white-label/branding", params={"host": "app.acme.com"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["company_name"] == "Acme Energy"
        assert body["primary_color"] == "#123456"

    def test_404_for_unknown_host(self, client, db_session):
        resp = client.get("/api/white-label/branding", params={"host": "nobody.example.com"})
        assert resp.status_code == 404

    def test_404_for_pending_domain_not_yet_active(self, client, db_session):
        tenant = _seed_tenant(db_session, TENANT_A)
        tenant.custom_domain = "app.acme.com"
        tenant.custom_domain_status = "pending_dns"
        db_session.commit()

        resp = client.get("/api/white-label/branding", params={"host": "app.acme.com"})
        assert resp.status_code == 404
