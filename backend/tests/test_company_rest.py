"""REST coverage for GET/PATCH /api/company: real persistence of the
Settings > Company tab, which previously had hardcoded input values and no
onChange handler at all."""
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
from backend.routers.company import get_db as company_get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1
TENANT_B = 2


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

    app.dependency_overrides[company_get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_tenant(db_session, tenant_id: int, name: str = "Voltaris Energy B.V.") -> models.Tenant:
    tenant = models.Tenant(id=tenant_id, name=name, slug=f"t{tenant_id}", plan="enterprise")
    db_session.add(tenant)
    db_session.commit()
    return tenant


class TestCompany:
    def test_requires_auth(self, client, db_session):
        resp = client.get("/api/company")
        assert resp.status_code == 401

    def test_requires_admin_role(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.get("/api/company", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 403

    def test_get_returns_tenant_profile(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.get("/api/company", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Voltaris Energy B.V."
        assert body["vat_number"] is None

    def test_updates_fields_and_persists(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.patch(
            "/api/company",
            json={"vat_number": "PT123456789", "country": "Portugal", "website": "https://voltarisos.com"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200
        assert resp.json()["vat_number"] == "PT123456789"

        again = client.get("/api/company", headers=_auth(TENANT_A))
        assert again.json()["vat_number"] == "PT123456789"
        assert again.json()["country"] == "Portugal"

    def test_rejects_empty_name(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.patch("/api/company", json={"name": "   "}, headers=_auth(TENANT_A))
        assert resp.status_code == 400

    def test_tenant_isolation(self, client, db_session):
        _seed_tenant(db_session, TENANT_A, name="Tenant A")
        _seed_tenant(db_session, TENANT_B, name="Tenant B")
        client.patch("/api/company", json={"vat_number": "AAA"}, headers=_auth(TENANT_A))

        b = client.get("/api/company", headers=_auth(TENANT_B, sub="admin-b@x.com"))
        assert b.json()["vat_number"] is None
        assert b.json()["name"] == "Tenant B"
