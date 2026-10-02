"""Regression tests for the logic audit fixes.

Covers: site creation/patch validation, /ready status code, self-registration
(tenant isolation + unpaid plans), and masked-secret handling on device update.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_module
from backend.routers import devices as devices_module
from backend.routers import sites as sites_module
from backend.security import get_current_user, limiter

TENANT_A = 1
USER_A = {"sub": "1", "tenant_id": TENANT_A, "role": "TENANT_ADMIN", "email": "a@test.com"}


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
def client(db_session, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)

    def _get_db():
        yield db_session

    app.dependency_overrides[sites_module.get_db] = _get_db
    app.dependency_overrides[devices_module.get_db] = _get_db
    app.dependency_overrides[auth_module.get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: USER_A
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_tenant(db, tenant_id=TENANT_A, plan="pro"):
    db.add(models.Tenant(id=tenant_id, name=f"T{tenant_id}", slug=f"t{tenant_id}", plan=plan, max_sites=20))
    db.commit()


# ── Sites: create ────────────────────────────────────────────────────────────
class TestSiteCreate:
    def test_create_with_only_the_name_and_nulls_from_the_form(self, client, db_session):
        """The create form sends null for blank location/lat/lng/owner."""
        _seed_tenant(db_session)
        resp = client.post("/api/sites", json={
            "name": "Casa", "location": None, "lat": None, "lng": None,
            "solar_kw": 0, "battery_kwh": 0, "ev_chargers": 0, "owner": None,
            "status": "active", "tilt_deg": None, "azimuth_deg": None,
        })
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["name"] == "Casa"
        assert body["lat"] is None and body["owner"] is None
        assert body["tenant_id"] == TENANT_A

    def test_create_with_only_name(self, client, db_session):
        _seed_tenant(db_session)
        resp = client.post("/api/sites", json={"name": "Minimal"})
        assert resp.status_code == 201, resp.text
        assert resp.json()["solar_kw"] == 0

    @pytest.mark.parametrize("payload", [
        {"name": "   "},
        {"name": "x", "lat": 91},
        {"name": "x", "lng": -181},
        {"name": "x", "solar_kw": -1},
        {"name": "x", "battery_kwh": -5},
        {"name": "x", "ev_chargers": -1},
    ])
    def test_invalid_values_are_rejected(self, client, db_session, payload):
        _seed_tenant(db_session)
        assert client.post("/api/sites", json=payload).status_code == 422

    def test_user_without_tenant_gets_400_not_500(self, client, db_session):
        app.dependency_overrides[get_current_user] = lambda: {"sub": "9", "tenant_id": None, "role": "SUPER_ADMIN"}
        assert client.post("/api/sites", json={"name": "x"}).status_code == 400

    def test_plan_site_limit_still_enforced(self, client, db_session):
        _seed_tenant(db_session, plan="home")  # home = 1 site
        assert client.post("/api/sites", json={"name": "one"}).status_code == 201
        resp = client.post("/api/sites", json={"name": "two"})
        assert resp.status_code == 403
        assert "Limite" in resp.json()["detail"]

    def test_listing_survives_legacy_rows_with_null_numbers(self, client, db_session):
        _seed_tenant(db_session)
        db_session.add(models.Site(tenant_id=TENANT_A, name="legacy"))
        db_session.commit()
        # Older rows may hold NULLs (the ORM default only applies on insert).
        db_session.execute(text("UPDATE sites SET solar_kw=NULL, battery_kwh=NULL, ev_chargers=NULL"))
        db_session.commit()
        resp = client.get("/api/sites")
        assert resp.status_code == 200
        assert resp.json()[0]["solar_kw"] is None


# ── Sites: patch ─────────────────────────────────────────────────────────────
class TestSitePatch:
    def _site(self, client, db_session):
        _seed_tenant(db_session)
        return client.post("/api/sites", json={"name": "S", "location": "Lisboa", "lat": 38.7, "lng": -9.1}).json()["id"]

    @pytest.mark.parametrize("field", ["name", "solar_kw", "battery_kwh", "ev_chargers", "status"])
    def test_null_on_required_column_is_422_not_500(self, client, db_session, field):
        sid = self._site(client, db_session)
        assert client.patch(f"/api/sites/{sid}", json={field: None}).status_code == 422

    def test_nullable_field_can_be_cleared(self, client, db_session):
        sid = self._site(client, db_session)
        resp = client.patch(f"/api/sites/{sid}", json={"location": None, "lat": None})
        assert resp.status_code == 200
        assert resp.json()["location"] is None and resp.json()["lat"] is None

    def test_partial_update_changes_only_sent_fields(self, client, db_session):
        sid = self._site(client, db_session)
        resp = client.patch(f"/api/sites/{sid}", json={"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"
        assert resp.json()["location"] == "Lisboa"

    def test_invalid_patch_values_rejected(self, client, db_session):
        sid = self._site(client, db_session)
        assert client.patch(f"/api/sites/{sid}", json={"lat": 120}).status_code == 422
        assert client.patch(f"/api/sites/{sid}", json={"name": " "}).status_code == 422


# ── /ready ───────────────────────────────────────────────────────────────────
class TestReady:
    def test_ready_ok(self, client):
        resp = client.get("/ready")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"

    def test_ready_returns_real_503_when_database_is_down(self, client, monkeypatch):
        class BrokenEngine:
            def connect(self):
                raise RuntimeError("postgres://user:secret@db.internal/voltaris unreachable")

        import backend.database as database
        monkeypatch.setattr(database, "engine", BrokenEngine())
        resp = client.get("/ready")
        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "not_ready"
        # The public endpoint must not leak the connection string / host.
        assert "secret" not in resp.text and "db.internal" not in resp.text
        assert body["error"] == "RuntimeError"

    def test_health_detailed_does_not_leak_database_error(self, client, monkeypatch):
        class BrokenEngine:
            dialect = None

            def connect(self):
                raise RuntimeError("postgres://user:secret@db.internal/voltaris unreachable")

        import backend.database as database
        monkeypatch.setattr(database, "engine", BrokenEngine())
        resp = client.get("/health/detailed")
        assert resp.status_code == 200
        assert "secret" not in resp.text and "db.internal" not in resp.text
        assert resp.json()["status"] == "degraded"


# ── Registration ─────────────────────────────────────────────────────────────
def _register(client, **overrides):
    payload = {
        "email": "new@user.com", "password": "a-strong-password-1", "company": "Acme",
        "terms_accepted": True, "plan": "home", "role": "TENANT_MEMBER",
    }
    payload.update(overrides)
    return client.post("/api/auth/register", json=payload)


def _tenants(db):
    db.expire_all()
    return db.query(models.Tenant).order_by(models.Tenant.id).all()


class TestRegistration:
    def test_same_company_name_never_joins_an_existing_tenant(self, client, db_session):
        assert _register(client, email="first@acme.com", company="Acme Energy").status_code == 200
        first_tenant = _tenants(db_session)[0]
        # Give the first tenant some data a stranger must not be able to reach.
        db_session.add(models.Site(tenant_id=first_tenant.id, name="Private site"))
        db_session.commit()

        assert _register(client, email="stranger@evil.com", company="Acme Energy", plan="enterprise").status_code == 200

        tenants = _tenants(db_session)
        assert len(tenants) == 2
        assert tenants[0].id != tenants[1].id
        assert tenants[0].slug != tenants[1].slug
        users = {u.email: u for u in db_session.query(models.User).all()}
        assert users["first@acme.com"].tenant_id == first_tenant.id
        assert users["stranger@evil.com"].tenant_id != first_tenant.id
        # The first tenant is untouched by the second registration.
        assert first_tenant.plan == "home"
        assert first_tenant.max_sites == 1

    def test_many_same_name_registrations_get_unique_slugs(self, client, db_session):
        for i in range(4):
            assert _register(client, email=f"u{i}@x.com", company="Same Name").status_code == 200
        slugs = [t.slug for t in _tenants(db_session)]
        assert len(slugs) == len(set(slugs)) == 4

    def test_company_matching_the_admin_tenant_does_not_reach_it(self, client, db_session):
        db_session.add(models.Tenant(name="VoltarisOS Admin", slug="voltarisos-admin", plan="enterprise", max_sites=999))
        db_session.commit()
        assert _register(client, company="VoltarisOS Admin").status_code == 200
        user = db_session.query(models.User).filter(models.User.email == "new@user.com").first()
        admin_tenant = db_session.query(models.Tenant).filter(models.Tenant.slug == "voltarisos-admin").first()
        assert user.tenant_id != admin_tenant.id

    @pytest.mark.parametrize("company", ["", "   "])
    def test_blank_company_rejected(self, client, company):
        assert _register(client, company=company).status_code == 400

    @pytest.mark.parametrize("chosen", ["home", "smart", "starter", "pro", "enterprise"])
    def test_chosen_paid_plan_is_not_granted_without_payment(self, client, db_session, chosen):
        resp = _register(client, plan=chosen)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["plan"] == "home"
        assert body["payment_required"] is True
        assert body["requested_plan"] == chosen
        tenant = _tenants(db_session)[0]
        assert tenant.plan == "home"
        assert tenant.max_sites == 1
        assert tenant.subscription_status == "pending_payment"

    def test_invite_code_still_assigns_its_plan_without_pending_payment(self, client, db_session, monkeypatch):
        monkeypatch.setitem(auth_module.INVITE_CODES, "PROMO1", {
            "tier": "pro", "label": "Pro promo", "roles": ["TENANT_MEMBER"], "max_sites": 20,
        })
        resp = _register(client, beta_code="promo1", plan="")
        assert resp.status_code == 200, resp.text
        assert resp.json()["plan"] == "pro"
        assert resp.json()["payment_required"] is False
        tenant = _tenants(db_session)[0]
        assert tenant.plan == "pro"
        assert tenant.max_sites == 20
        assert tenant.subscription_status is None

    def test_invalid_code_and_missing_plan_still_rejected(self, client):
        assert _register(client, beta_code="nope").status_code == 400
        assert _register(client, plan="").status_code == 400
        assert _register(client, plan="beta").status_code == 400  # not purchasable
        assert _register(client, terms_accepted=False).status_code == 400

    def test_duplicate_email_rejected_and_creates_no_orphan_tenant(self, client, db_session):
        assert _register(client, email="dup@x.com", company="One").status_code == 200
        assert _register(client, email="dup@x.com", company="Two").status_code == 400
        assert len(_tenants(db_session)) == 1

    def test_unpaid_signup_can_only_create_one_site(self, client, db_session):
        """End to end: the pending plan really limits what the account can do."""
        assert _register(client, plan="enterprise").status_code == 200
        tenant = _tenants(db_session)[0]
        app.dependency_overrides[get_current_user] = lambda: {
            "sub": "new@user.com", "tenant_id": tenant.id, "role": "TENANT_MEMBER", "email": "new@user.com",
        }
        assert client.post("/api/sites", json={"name": "one"}).status_code == 201
        assert client.post("/api/sites", json={"name": "two"}).status_code == 403


# ── Devices: masked secrets ──────────────────────────────────────────────────
class TestDeviceMaskedSecrets:
    def _create(self, client, db_session, config):
        _seed_tenant(db_session)
        resp = client.post("/api/devices", json={"name": "Inv", "protocol": "solaredge", "config": config})
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    def _stored(self, db_session, device_id):
        db_session.expire_all()
        return db_session.query(models.Device).filter(models.Device.id == device_id).first().config

    def test_sending_back_the_masked_config_keeps_the_real_secret(self, client, db_session):
        did = self._create(client, db_session, {"host": "10.0.0.1", "api_key": "REAL-KEY", "password": "hunter2"})
        read_back = client.get(f"/api/devices/{did}").json()["config"]
        assert read_back["api_key"] == "***"

        read_back["host"] = "10.0.0.2"  # the user edits a normal field only
        assert client.put(f"/api/devices/{did}", json={"config": read_back}).status_code == 200

        stored = self._stored(db_session, did)
        assert stored == {"host": "10.0.0.2", "api_key": "REAL-KEY", "password": "hunter2"}

    def test_a_new_real_secret_replaces_the_old_one(self, client, db_session):
        did = self._create(client, db_session, {"api_key": "OLD"})
        assert client.put(f"/api/devices/{did}", json={"config": {"api_key": "NEW"}}).status_code == 200
        assert self._stored(db_session, did)["api_key"] == "NEW"

    def test_mask_without_a_stored_value_is_never_persisted(self, client, db_session):
        did = self._create(client, db_session, {"host": "h"})
        assert client.put(f"/api/devices/{did}", json={"config": {"host": "h", "token": "***"}}).status_code == 200
        assert "token" not in self._stored(db_session, did)

    def test_nested_masked_secrets_are_restored(self, client, db_session):
        did = self._create(client, db_session, {"auth": {"client_secret": "S3CRET", "id": "abc"}})
        body = client.get(f"/api/devices/{did}").json()["config"]
        assert body["auth"]["client_secret"] == "***"
        assert client.put(f"/api/devices/{did}", json={"config": body}).status_code == 200
        assert self._stored(db_session, did)["auth"] == {"client_secret": "S3CRET", "id": "abc"}

    def test_restore_helper_does_not_mutate_its_inputs(self):
        new = {"password": "***", "x": 1}
        old = {"password": "real"}
        out = devices_module._restore_masked_secrets(new, old)
        assert out == {"password": "real", "x": 1}
        assert new == {"password": "***", "x": 1} and old == {"password": "real"}

    def test_duplicate_external_id_is_409(self, client, db_session):
        _seed_tenant(db_session)
        body = {"name": "A", "protocol": "solaredge", "external_id": "SN-1"}
        assert client.post("/api/devices", json=body).status_code == 201
        assert client.post("/api/devices", json={**body, "name": "B"}).status_code == 409
