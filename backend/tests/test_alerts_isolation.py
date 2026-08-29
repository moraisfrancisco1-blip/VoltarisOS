"""Tenant isolation tests for alert rules and alerts (FASE 7.2B)."""
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
from backend.routers.alerts_ws import get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_MEMBER", sub: str = "1") -> str:
    return jwt.encode(
        {"sub": sub, "tenant_id": tenant_id, "role": role},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _auth(tenant_id: int, role: str = "TENANT_MEMBER") -> dict:
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

    app.dependency_overrides[get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


class TestAlertRuleTenantIsolation:
    def test_create_rule_derives_tenant_from_jwt(self, client, db_session):
        resp = client.post(
            "/api/alert-rules",
            json={"name": "Rule A", "metric": "power_kw", "operator": "gt", "threshold": 10},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["tenant_id"] == TENANT_A

    def test_query_param_tenant_id_cannot_override_ownership(self, client, db_session):
        # Even if the client passes ?tenant_id=B, the rule is created under the JWT tenant.
        resp = client.post(
            "/api/alert-rules?tenant_id={}".format(TENANT_B),
            json={"name": "Spoof", "metric": "power_kw", "operator": "gt", "threshold": 10},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["tenant_id"] == TENANT_A

    def test_list_rules_tenant_scoped(self, client, db_session):
        # Seed rules for both tenants directly.
        db_session.add(models.AlertRule(tenant_id=TENANT_A, name="A", metric="x", operator="gt"))
        db_session.add(models.AlertRule(tenant_id=TENANT_B, name="B", metric="x", operator="gt"))
        db_session.commit()

        resp = client.get("/api/alert-rules", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        names = {r["name"] for r in resp.json()}
        assert "A" in names
        assert "B" not in names

    def test_delete_rule_cross_tenant_404(self, client, db_session):
        rule = models.AlertRule(tenant_id=TENANT_A, name="A", metric="x", operator="gt")
        db_session.add(rule)
        db_session.commit()

        resp = client.delete(f"/api/alert-rules/{rule.id}", headers=_auth(TENANT_B))
        assert resp.status_code == 404
        # Rule must still exist.
        assert db_session.query(models.AlertRule).filter_by(id=rule.id).count() == 1

    def test_delete_rule_same_tenant(self, client, db_session):
        rule = models.AlertRule(tenant_id=TENANT_A, name="A", metric="x", operator="gt")
        db_session.add(rule)
        db_session.commit()

        resp = client.delete(f"/api/alert-rules/{rule.id}", headers=_auth(TENANT_A))
        assert resp.status_code == 204
        assert db_session.query(models.AlertRule).filter_by(id=rule.id).count() == 0

    def test_super_admin_sees_all_rules(self, client, db_session):
        db_session.add(models.AlertRule(tenant_id=TENANT_A, name="A", metric="x", operator="gt"))
        db_session.add(models.AlertRule(tenant_id=TENANT_B, name="B", metric="x", operator="gt"))
        db_session.commit()

        resp = client.get("/api/alert-rules", headers=_auth(99, role="SUPER_ADMIN"))
        assert resp.status_code == 200
        names = {r["name"] for r in resp.json()}
        assert {"A", "B"}.issubset(names)


class TestAlertTenantIsolation:
    def test_list_alerts_tenant_scoped(self, client, db_session):
        db_session.add(models.Alert(tenant_id=TENANT_A, severity="warning", title="A"))
        db_session.add(models.Alert(tenant_id=TENANT_B, severity="warning", title="B"))
        db_session.commit()

        resp = client.get("/api/alerts", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        titles = {a["title"] for a in resp.json()}
        assert "A" in titles
        assert "B" not in titles

    def test_ack_cross_tenant_404(self, client, db_session):
        alert = models.Alert(tenant_id=TENANT_A, severity="warning", title="A")
        db_session.add(alert)
        db_session.commit()

        resp = client.post(f"/api/alerts/{alert.id}/ack", headers=_auth(TENANT_B))
        assert resp.status_code == 404
        # Alert must still be unacknowledged.
        assert db_session.query(models.Alert).filter_by(id=alert.id).one().acknowledged is False