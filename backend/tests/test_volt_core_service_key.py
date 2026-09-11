"""Volt Core service key: read-only, machine-to-machine, closed allowlist.

Covers:
- The key works (200) on exactly the 5 allowlisted GET endpoints.
- A wrong key is rejected (403) even on those same 5 endpoints.
- The key is rejected (403) on ordinary write endpoints (sites, alert-rules).
- The key is rejected (403) specifically on VPP dispatch and bid, and on
  trading-agent toggle / trade — the endpoints this key must never reach.
- The key is rejected (403) on a ordinary GET that just isn't allowlisted,
  proving this is an allowlist ("only these 5"), not "any GET is fine".
- With no header at all, human auth behaves exactly as before (401).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_router_module
from backend.routers import operations as operations_router_module
from backend.routers import alerts_ws as alerts_ws_router_module
from backend.security import check_volt_core_service_key

TEST_KEY = "test-volt-core-key-do-not-use-in-prod"

ALLOWLISTED_GET_ENDPOINTS = [
    "/api/admin/tenants",
    "/api/admin/system-health",
    "/api/admin/production-readiness",
    "/api/alerts",
    "/api/alert-rules",
]


# ─── Fixtures ──────────────────────────────────────────────────────────────
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
    # Read lazily by check_volt_core_service_key -> safe to set per-test.
    monkeypatch.setenv("VOLT_CORE_SERVICE_KEY", TEST_KEY)

    def _override():
        yield db_session

    # Only the 3 routers whose *successful* (allowlisted) path is exercised
    # here need a working DB. Every rejection case in this file is stopped by
    # VoltCoreServiceKeyMiddleware before FastAPI resolves any route
    # dependency, so those routers never touch the database at all.
    app.dependency_overrides[auth_router_module.get_db] = _override
    app.dependency_overrides[operations_router_module.get_db] = _override
    app.dependency_overrides[alerts_ws_router_module.get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _headers(key: str = TEST_KEY) -> dict:
    return {"X-Volt-Core-Key": key}


# ─── (a) the key works, exactly on the allowlist ────────────────────────────
@pytest.mark.parametrize("path", ALLOWLISTED_GET_ENDPOINTS)
def test_service_key_works_on_allowlisted_endpoint(client, path):
    resp = client.get(path, headers=_headers())
    assert resp.status_code == 200, resp.text


@pytest.mark.parametrize("path", ALLOWLISTED_GET_ENDPOINTS)
def test_wrong_service_key_rejected_even_on_allowlist(client, path):
    resp = client.get(path, headers=_headers("this-is-not-the-configured-key"))
    assert resp.status_code == 403


# ─── (b) rejected on ordinary write endpoints ───────────────────────────────
WRITE_ENDPOINTS = [
    ("POST", "/api/sites"),
    ("PATCH", "/api/sites/1"),
    ("DELETE", "/api/sites/1"),
    ("POST", "/api/alert-rules"),
    ("POST", "/api/alerts/1/ack"),
    ("POST", "/api/devices"),
    ("PUT", "/api/devices/1"),
    ("DELETE", "/api/devices/1"),
]


@pytest.mark.parametrize("method,path", WRITE_ENDPOINTS)
def test_service_key_rejected_on_write_endpoints(client, method, path):
    resp = client.request(method, path, headers=_headers(), json={})
    assert resp.status_code == 403, f"{method} {path} -> {resp.status_code}: {resp.text}"


# ─── (c) the critical case: VPP dispatch, bid, and trading ──────────────────
CRITICAL_ENDPOINTS = [
    ("POST", "/api/vpp/1/dispatch/dry-run"),  # dispatch (write)
    ("GET", "/api/vpp/1/dispatch"),           # dispatch history — still not allowlisted
    ("POST", "/api/vpp/1/bid"),               # bid (write)
    ("GET", "/api/vpp/1/bids"),               # bid list — still not allowlisted
    ("POST", "/api/trading-agent/toggle"),
    ("POST", "/api/trade"),
]


@pytest.mark.parametrize("method,path", CRITICAL_ENDPOINTS)
def test_service_key_rejected_on_vpp_and_trading_endpoints(client, method, path):
    resp = client.request(method, path, headers=_headers(), json={})
    assert resp.status_code == 403, f"{method} {path} -> {resp.status_code}: {resp.text}"


# ─── a GET that simply isn't on the allowlist ───────────────────────────────
@pytest.mark.parametrize("path", ["/api/sites", "/api/devices", "/api/vpp", "/health/detailed"])
def test_service_key_rejected_on_unlisted_get(client, path):
    resp = client.get(path, headers=_headers())
    assert resp.status_code == 403, f"GET {path} -> {resp.status_code}: {resp.text}"


# ─── no header at all: zero behavior change for real users ─────────────────
def test_no_header_behaves_as_before(client):
    resp = client.get("/api/alerts")  # no Authorization, no X-Volt-Core-Key
    assert resp.status_code == 401


def test_no_header_write_endpoint_still_401_not_403(client):
    """Confirms the middleware never manufactures a 403 for ordinary traffic —
    only requests that actually carry the service-key header are touched."""
    resp = client.post("/api/sites", json={"name": "x"})
    assert resp.status_code == 401


# ─── Unit coverage of the pure allowlist check ──────────────────────────────
def test_check_service_key_no_header_returns_false(monkeypatch):
    monkeypatch.setenv("VOLT_CORE_SERVICE_KEY", TEST_KEY)
    assert check_volt_core_service_key("GET", "/api/alerts", None) is False


def test_check_service_key_valid_and_allowlisted(monkeypatch):
    monkeypatch.setenv("VOLT_CORE_SERVICE_KEY", TEST_KEY)
    assert check_volt_core_service_key("GET", "/api/alerts", TEST_KEY) is True


def test_check_service_key_valid_but_not_allowlisted_raises_403(monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv("VOLT_CORE_SERVICE_KEY", TEST_KEY)
    with pytest.raises(HTTPException) as exc:
        check_volt_core_service_key("POST", "/api/vpp/1/dispatch/dry-run", TEST_KEY)
    assert exc.value.status_code == 403


def test_check_service_key_wrong_key_raises_403(monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv("VOLT_CORE_SERVICE_KEY", TEST_KEY)
    with pytest.raises(HTTPException) as exc:
        check_volt_core_service_key("GET", "/api/alerts", "wrong")
    assert exc.value.status_code == 403


def test_check_service_key_not_configured_raises_403():
    """VOLT_CORE_SERVICE_KEY unset (empty string) -> any supplied key is a
    non-match, never a silent bypass."""
    import os
    os.environ.pop("VOLT_CORE_SERVICE_KEY", None)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        check_volt_core_service_key("GET", "/api/alerts", "anything")
    assert exc.value.status_code == 403
