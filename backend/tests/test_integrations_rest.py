"""REST coverage for GET /api/integrations/status: real configured/
not-configured state for ENTSOE_API_KEY/EEX_API_KEY, replacing
Settings.jsx's old hardcoded, fabricated "API Keys" list."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.main import app
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1


def _auth(tenant_id: int, role: str = "TENANT_ADMIN") -> dict:
    token = jwt.encode({"sub": "admin-a@x.com", "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


class TestIntegrationsStatus:
    def test_requires_auth(self, client):
        resp = client.get("/api/integrations/status")
        assert resp.status_code == 401

    def test_requires_admin_role(self, client):
        resp = client.get("/api/integrations/status", headers=_auth(TENANT_A, role="TENANT_MEMBER"))
        assert resp.status_code == 403

    def test_reports_configured_state_without_leaking_value(self, client, monkeypatch):
        monkeypatch.setattr("backend.routers.integrations.settings.ENTSOE_API_KEY", "super-secret-value")
        monkeypatch.setattr("backend.routers.integrations.settings.EEX_API_KEY", "")

        resp = client.get("/api/integrations/status", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = {item["key"]: item for item in resp.json()}

        assert body["entsoe"]["configured"] is True
        assert body["eex"]["configured"] is False
        # The actual secret value must never appear in the response.
        assert "super-secret-value" not in resp.text
