"""POST /api/admin/tenants — SUPER_ADMIN-only tenant creation.

Covers:
- happy path (201, persisted, defaults derived from the plan);
- slug auto-derived from the name when omitted;
- duplicate slug / duplicate name (case-insensitive) -> 409;
- required-field and field-validation errors -> 422;
- auth: no token -> 401, non-SUPER_ADMIN -> 403;
- the existing GET listing still works.
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
from backend.security import SECRET_KEY, ALGORITHM


def _token(role: str) -> str:
    return jwt.encode(
        {"sub": "admin@test.com", "role": role, "tenant_id": 1},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _headers(role: str = "SUPER_ADMIN") -> dict:
    return {"Authorization": f"Bearer {_token(role)}"}


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

    app.dependency_overrides[auth_router_module.get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


# ─── happy path ──────────────────────────────────────────────────────────────
def test_create_tenant_super_admin(client, db_session):
    resp = client.post(
        "/api/admin/tenants",
        json={"name": "Acme Energy", "plan": "starter", "max_devices": 120},
        headers=_headers(),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Acme Energy"
    assert body["slug"] == "acme-energy"          # derived from the name
    assert body["plan"] == "starter"
    assert body["max_sites"] == 5                 # PLAN_MAX_SITES["starter"]
    assert body["max_devices"] == 120
    assert body["active"] is True
    assert body["id"] is not None

    row = db_session.query(models.Tenant).filter_by(slug="acme-energy").first()
    assert row is not None and row.name == "Acme Energy"


def test_create_tenant_explicit_slug_and_color(client):
    resp = client.post(
        "/api/admin/tenants",
        json={"name": "Beta Co", "slug": "beta-co-2026", "primary_color": "#123abc"},
        headers=_headers(),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["slug"] == "beta-co-2026"
    assert body["primary_color"] == "#123abc"
    assert body["plan"] == "beta"


# ─── duplicates ──────────────────────────────────────────────────────────────
def test_create_tenant_duplicate_slug_conflict(client):
    assert client.post("/api/admin/tenants", json={"name": "A", "slug": "dup"}, headers=_headers()).status_code == 201
    resp = client.post("/api/admin/tenants", json={"name": "B", "slug": "dup"}, headers=_headers())
    assert resp.status_code == 409
    assert "identificador" in resp.json()["detail"].lower()


def test_create_tenant_duplicate_name_case_insensitive_conflict(client):
    assert client.post(
        "/api/admin/tenants", json={"name": "Same Name", "slug": "first-slug"}, headers=_headers()
    ).status_code == 201
    # Different (explicit) slug, same name case-insensitively -> name rule must fire.
    resp = client.post(
        "/api/admin/tenants", json={"name": "same name", "slug": "second-slug"}, headers=_headers()
    )
    assert resp.status_code == 409, resp.text
    assert "nome" in resp.json()["detail"].lower()


# ─── validation ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "payload",
    [
        {"name": "   "},                       # required name
        {"name": "X", "plan": "nope"},         # invalid plan
        {"name": "X", "primary_color": "red"}, # invalid colour
        {"name": "X", "max_sites": 0},         # below minimum
        {"name": "X", "max_devices": 0},       # below minimum
        {"name": "X", "slug": "no spaces!"},   # invalid slug
    ],
)
def test_create_tenant_validation_errors(client, payload):
    resp = client.post("/api/admin/tenants", json=payload, headers=_headers())
    assert resp.status_code == 422, f"{payload} -> {resp.status_code}: {resp.text}"


# ─── auth ────────────────────────────────────────────────────────────────────
def test_create_tenant_requires_auth(client):
    resp = client.post("/api/admin/tenants", json={"name": "NoAuth"})
    assert resp.status_code == 401


def test_create_tenant_forbidden_for_non_super_admin(client):
    resp = client.post("/api/admin/tenants", json={"name": "Nope"}, headers=_headers("TENANT_ADMIN"))
    assert resp.status_code == 403


# ─── existing listing still works ────────────────────────────────────────────
def test_list_tenants_still_works_for_super_admin(client):
    assert client.post("/api/admin/tenants", json={"name": "Listed"}, headers=_headers()).status_code == 201
    resp = client.get("/api/admin/tenants", headers=_headers())
    assert resp.status_code == 200
    assert any(t["slug"] == "listed" for t in resp.json())
