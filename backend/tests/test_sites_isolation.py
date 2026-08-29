"""Tests for Site DB persistence + tenant isolation + migration seed preservation."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.main import app
from backend.routers.sites import get_db
from backend.security import get_current_user

TENANT_A = 1
TENANT_B = 2

USER_A = {"sub": "1", "tenant_id": TENANT_A, "role": "TENANT_MEMBER", "email": "a@test.com"}
USER_B = {"sub": "2", "tenant_id": TENANT_B, "role": "TENANT_MEMBER", "email": "b@test.com"}
SUPER_ADMIN = {"sub": "99", "tenant_id": 99, "role": "SUPER_ADMIN", "email": "admin@test.com"}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _seed_tenants(db):
    db.add(models.Tenant(id=TENANT_A, name="Tenant A", slug="tenant-a", plan="beta"))
    db.add(models.Tenant(id=TENANT_B, name="Tenant B", slug="tenant-b", plan="beta"))
    db.commit()


def _create_site(client, user, name="Site A"):
    _as(user)
    return client.post("/api/sites", json={
        "name": name,
        "location": "Loc",
        "lat": 1.0,
        "lng": 2.0,
        "solar_kw": 10.0,
        "battery_kwh": 5.0,
        "ev_chargers": 1,
        "owner": "Owner",
        "status": "active",
    })


def test_tenant_b_cannot_see_access_or_delete_tenant_a_site(client, db_session):
    _seed_tenants(db_session)

    resp = _create_site(client, USER_A, name="Secret Site A")
    assert resp.status_code == 201
    site_id = resp.json()["id"]

    # Tenant B lists its own sites and must not see tenant A's site.
    _as(USER_B)
    listed = client.get("/api/sites").json()
    assert site_id not in {s["id"] for s in listed}
    assert "Secret Site A" not in client.get("/api/sites").text

    # Tenant B cannot delete tenant A's site (404, no-leak).
    del_resp = client.delete(f"/api/sites/{site_id}")
    assert del_resp.status_code == 404
    assert "Secret Site A" not in del_resp.text

    # Tenant A still owns the site.
    _as(USER_A)
    assert client.get("/api/sites").json()[0]["id"] == site_id


def test_own_tenant_crud_works(client, db_session):
    _seed_tenants(db_session)

    resp = _create_site(client, USER_A, name="My Site")
    assert resp.status_code == 201
    body = resp.json()
    assert body["tenant_id"] == TENANT_A
    site_id = body["id"]

    _as(USER_A)
    assert [s["id"] for s in client.get("/api/sites").json()] == [site_id]

    assert client.delete(f"/api/sites/{site_id}").status_code == 200
    assert client.get("/api/sites").json() == []


def test_super_admin_sees_all_sites(client, db_session):
    _seed_tenants(db_session)
    _create_site(client, USER_A, name="A Site")
    _create_site(client, USER_B, name="B Site")

    _as(SUPER_ADMIN)
    listed = client.get("/api/sites").json()
    names = {s["name"] for s in listed}
    assert {"A Site", "B Site"}.issubset(names)


def test_max_sites_limit_enforced(client, db_session):
    _seed_tenants(db_session)  # plan "beta" → max_sites = 1

    assert _create_site(client, USER_A, name="First").status_code == 201
    second = _create_site(client, USER_A, name="Second")
    assert second.status_code == 403


def test_migration_preserves_seed_site_ids(monkeypatch):
    """The migration creates sites 1 and 2 (idempotent) under the admin tenant."""
    import backend.migrations.add_sites_table as migration

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    monkeypatch.setattr(migration, "engine", engine)
    monkeypatch.setattr(migration, "SessionLocal", Session)

    migration.migrate()
    db = Session()
    try:
        sites = {s.id: s for s in db.query(models.Site).all()}
        assert set(sites) == {1, 2}
        assert sites[1].name == "Rotterdam Noord "
        assert sites[1].solar_kw == 12.5
        assert sites[1].battery_kwh == 20.0
        assert sites[2].name == "Rebordelo"
        assert sites[2].solar_kw == 150.0

        # Idempotent: a second run must not duplicate.
        migration.migrate()
        db.expire_all()
        assert db.query(models.Site).count() == 2

        # Seeds are attached to the admin tenant.
        tenant = db.query(models.Tenant).filter(models.Tenant.slug == "voltarisos-admin").first()
        assert tenant is not None
        assert all(s.tenant_id == tenant.id for s in db.query(models.Site).all())
    finally:
        db.close()
