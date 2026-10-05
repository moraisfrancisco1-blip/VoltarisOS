"""REST coverage for /api/compliance: tenant isolation, role gating, validation,
the completed_at rule and audit events."""
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
from backend.routers import compliance
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1
TENANT_B = 2


def _auth(tenant_id, role="TENANT_ADMIN", sub="admin@x.com"):
    token = jwt.encode({"sub": sub, "tenant_id": tenant_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[compliance.get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _new(client, tenant=TENANT_A, **overrides):
    payload = {"title": "Inverter safety certificate", "body": "Grid operator", "due_date": "2026-12-31",
               "category": "Safety", "risk": "high", **overrides}
    return client.post("/api/compliance", json=payload, headers=_auth(tenant))


def test_requires_login(client):
    assert client.get("/api/compliance").status_code == 401


def test_member_can_read_but_not_write(client):
    member = _auth(TENANT_A, role="TENANT_MEMBER", sub="m@x.com")
    assert client.get("/api/compliance", headers=member).status_code == 200
    assert client.post("/api/compliance", headers=member, json={"title": "x", "due_date": "2026-01-01"}).status_code == 403


def test_admin_creates_item_in_own_tenant_ignoring_a_tenant_in_the_body(client):
    resp = _new(client, tenant_id=999)  # a client-supplied tenant_id must be ignored
    assert resp.status_code == 201
    body = resp.json()
    assert body["tenant_id"] == TENANT_A and body["created_by"] == "admin@x.com"
    assert body["status"] == "pending" and body["completed_at"] is None
    assert body["due_date"] == "2026-12-31" and body["category"] == "Safety" and body["risk"] == "high"


def test_tenants_cannot_see_or_change_each_others_items(client):
    item_id = _new(client).json()["id"]
    assert client.get("/api/compliance", headers=_auth(TENANT_B)).json() == []
    assert client.put(f"/api/compliance/{item_id}", json={"status": "done"}, headers=_auth(TENANT_B)).status_code == 404
    assert client.delete(f"/api/compliance/{item_id}", headers=_auth(TENANT_B)).status_code == 404
    mine = client.get("/api/compliance", headers=_auth(TENANT_A)).json()
    assert len(mine) == 1 and mine[0]["status"] == "pending"  # untouched


@pytest.mark.parametrize("override", [
    {"risk": "extreme"}, {"category": "Foo"}, {"status": "finished"},
    {"title": "   "}, {"title": ""}, {"title": "x" * 201},
    {"due_date": "2025-13-45"}, {"due_date": "tomorrow"}, {"notes": "n" * 2001},
])
def test_invalid_input_is_rejected(client, override):
    assert _new(client, **override).status_code == 422


def test_due_date_is_required(client):
    resp = client.post("/api/compliance", json={"title": "x"}, headers=_auth(TENANT_A))
    assert resp.status_code == 422


def test_done_sets_completed_at_and_reopening_clears_it(client):
    item_id = _new(client).json()["id"]
    done = client.put(f"/api/compliance/{item_id}", json={"status": "done"}, headers=_auth(TENANT_A)).json()
    assert done["status"] == "done" and done["completed_at"] is not None
    first_completed = done["completed_at"]
    again = client.put(f"/api/compliance/{item_id}", json={"status": "done", "notes": "filed"}, headers=_auth(TENANT_A)).json()
    assert again["completed_at"] == first_completed  # not reset by an unrelated edit
    reopened = client.put(f"/api/compliance/{item_id}", json={"status": "inprogress"}, headers=_auth(TENANT_A)).json()
    assert reopened["completed_at"] is None


def test_created_as_done_has_completed_at(client):
    assert _new(client, status="done").json()["completed_at"] is not None


def test_partial_update_keeps_other_fields_and_can_clear_optional_ones(client):
    item_id = _new(client, notes="remember").json()["id"]
    out = client.put(f"/api/compliance/{item_id}", json={"risk": "low"}, headers=_auth(TENANT_A)).json()
    assert out["risk"] == "low" and out["title"] == "Inverter safety certificate" and out["notes"] == "remember"
    cleared = client.put(f"/api/compliance/{item_id}", json={"body": None, "notes": None}, headers=_auth(TENANT_A)).json()
    assert cleared["body"] is None and cleared["notes"] is None


@pytest.mark.parametrize("field", ["title", "due_date", "category", "risk", "status"])
def test_required_fields_cannot_be_nulled(client, field):
    item_id = _new(client).json()["id"]
    assert client.put(f"/api/compliance/{item_id}", json={field: None}, headers=_auth(TENANT_A)).status_code == 422


def test_list_is_ordered_by_due_date(client):
    _new(client, title="late", due_date="2027-01-01")
    _new(client, title="soon", due_date="2026-02-01")
    _new(client, title="middle", due_date="2026-06-01")
    titles = [i["title"] for i in client.get("/api/compliance", headers=_auth(TENANT_A)).json()]
    assert titles == ["soon", "middle", "late"]


def test_delete_removes_the_item(client):
    item_id = _new(client).json()["id"]
    assert client.delete(f"/api/compliance/{item_id}", headers=_auth(TENANT_A)).status_code == 204
    assert client.get("/api/compliance", headers=_auth(TENANT_A)).json() == []
    assert client.delete(f"/api/compliance/{item_id}", headers=_auth(TENANT_A)).status_code == 404


def test_every_change_is_audited(client, db_session):
    item_id = _new(client).json()["id"]
    client.put(f"/api/compliance/{item_id}", json={"status": "done"}, headers=_auth(TENANT_A))
    client.delete(f"/api/compliance/{item_id}", headers=_auth(TENANT_A))
    events = db_session.query(models.AuditLog).filter(models.AuditLog.target_resource == "compliance_item") \
        .order_by(models.AuditLog.id).all()
    assert [e.action for e in events] == ["compliance.created", "compliance.updated", "compliance.deleted"]
    assert all(e.tenant_id == TENANT_A and e.target_id == item_id for e in events)


def test_super_admin_reads_all_tenants_but_must_have_a_tenant_to_write(client):
    _new(client, tenant=TENANT_A, title="a")
    _new(client, tenant=TENANT_B, title="b")
    root = _auth(None, role="SUPER_ADMIN", sub="root@x.com")
    assert sorted(i["title"] for i in client.get("/api/compliance", headers=root).json()) == ["a", "b"]
    resp = client.post("/api/compliance", json={"title": "x", "due_date": "2026-01-01"}, headers=root)
    assert resp.status_code == 400
