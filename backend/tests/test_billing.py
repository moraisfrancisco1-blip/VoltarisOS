"""Tests for Stripe billing: checkout tenant binding, webhook persistence, idempotency.

Stripe is mocked — no real Stripe calls are made.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.main import app
from backend.routers import payments
from backend.routers.payments import get_db
from backend.security import get_current_user
from backend.permissions import PLAN_MAX_SITES

TENANT_A = 1
TENANT_B = 2

USER_A = {"sub": "1", "tenant_id": TENANT_A, "role": "TENANT_MEMBER", "email": "a@test.com"}
USER_B = {"sub": "2", "tenant_id": TENANT_B, "role": "TENANT_MEMBER", "email": "b@test.com"}


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
    app.dependency_overrides[get_current_user] = lambda: USER_A
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_tenant(db, tenant_id, plan="beta"):
    db.add(models.Tenant(id=tenant_id, name=f"T{tenant_id}", slug=f"tenant-{tenant_id}",
                         plan=plan, max_sites=PLAN_MAX_SITES.get(plan, 1)))
    db.commit()


def _mock_stripe_checkout(monkeypatch, captured):
    class FakeCustomerList:
        data = []

    class FakeCustomer:
        id = "cus_test_123"

    class FakeSession:
        id = "cs_test_123"
        url = "https://checkout.stripe.com/c/pay/cs_test_123"

    def fake_session_create(**kwargs):
        captured["session"] = kwargs
        return FakeSession()

    monkeypatch.setattr(payments.stripe.Customer, "list", lambda email=None, limit=1: FakeCustomerList())
    monkeypatch.setattr(payments.stripe.Customer, "create", lambda **kwargs: FakeCustomer())
    monkeypatch.setattr(payments.stripe.checkout.Session, "create", fake_session_create)


def _mock_event(monkeypatch, event):
    monkeypatch.setattr(payments.stripe.Webhook, "construct_event", lambda payload, sig, secret: event)


def _post_webhook(client):
    return client.post("/api/payments/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=ok"})


# ── A. Checkout ──────────────────────────────────────────────────────────────
class TestCheckout:
    def test_checkout_requires_auth(self, client):
        app.dependency_overrides.pop(get_current_user, None)
        resp = client.post("/api/payments/create-checkout-session", json={"plan_id": "home", "billing_cycle": "monthly"})
        assert resp.status_code == 401

    def test_checkout_invalid_plan_rejected(self, client, db_session):
        _seed_tenant(db_session, TENANT_A)
        resp = client.post("/api/payments/create-checkout-session", json={"plan_id": "nope", "billing_cycle": "monthly"})
        assert resp.status_code == 400

    def test_checkout_authenticated_binds_tenant(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A)
        captured = {}
        _mock_stripe_checkout(monkeypatch, captured)

        resp = client.post("/api/payments/create-checkout-session", json={"plan_id": "home", "billing_cycle": "monthly"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["url"]

        session = captured["session"]
        assert session["client_reference_id"] == str(TENANT_A)
        assert session["metadata"]["tenant_id"] == str(TENANT_A)
        assert session["metadata"]["plan_id"] == "home"
        assert session["subscription_data"]["metadata"]["tenant_id"] == str(TENANT_A)
        assert session["subscription_data"]["metadata"]["plan_id"] == "home"

        tenant = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_A).first()
        assert tenant.stripe_customer_id == "cus_test_123"

    def test_checkout_tenant_not_selectable_by_frontend(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A)
        captured = {}
        _mock_stripe_checkout(monkeypatch, captured)

        # Frontend tries to force another tenant — ignored; tenant comes from the JWT.
        resp = client.post(
            "/api/payments/create-checkout-session",
            json={"plan_id": "home", "billing_cycle": "monthly", "tenant_id": TENANT_B},
        )
        assert resp.status_code == 200, resp.text
        session = captured["session"]
        assert session["client_reference_id"] == str(TENANT_A)
        assert session["metadata"]["tenant_id"] == str(TENANT_A)


# ── B. Webhook ───────────────────────────────────────────────────────────────
class TestWebhook:
    def test_invalid_signature_rejected(self, client, monkeypatch):
        def raise_sig(payload, sig, secret):
            raise payments.stripe.error.SignatureVerificationError("Invalid signature", payload, sig)
        monkeypatch.setattr(payments.stripe.Webhook, "construct_event", raise_sig)
        resp = _post_webhook(client)
        assert resp.status_code == 400

    def test_checkout_completed_updates_tenant(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A, plan="beta")
        _mock_event(monkeypatch, {
            "id": "evt_checkout_1",
            "type": "checkout.session.completed",
            "data": {"object": {
                "client_reference_id": str(TENANT_A),
                "customer": "cus_A1",
                "subscription": "sub_A1",
                "payment_status": "paid",
                "metadata": {"tenant_id": str(TENANT_A), "plan_id": "home"},
            }},
        })
        resp = _post_webhook(client)
        assert resp.status_code == 200

        tenant = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_A).first()
        assert tenant.stripe_customer_id == "cus_A1"
        assert tenant.stripe_subscription_id == "sub_A1"
        assert tenant.plan == "home"
        assert tenant.max_sites == PLAN_MAX_SITES["home"]

    def test_subscription_created_persists_status_and_end(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A, plan="beta")
        _mock_event(monkeypatch, {
            "id": "evt_sub_created",
            "type": "customer.subscription.created",
            "data": {"object": {
                "id": "sub_A2",
                "customer": "cus_A2",
                "status": "active",
                "current_period_end": 1750000000,
                "metadata": {"tenant_id": str(TENANT_A), "plan_id": "pro"},
            }},
        })
        resp = _post_webhook(client)
        assert resp.status_code == 200

        tenant = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_A).first()
        assert tenant.stripe_subscription_id == "sub_A2"
        assert tenant.subscription_status == "active"
        assert tenant.subscription_end is not None
        assert tenant.plan == "pro"
        assert tenant.max_sites == PLAN_MAX_SITES["pro"]

    def test_subscription_deleted_reverts_plan(self, client, db_session, monkeypatch):
        db_session.add(models.Tenant(
            id=TENANT_A, name="A", slug="tenant-a", plan="pro", max_sites=PLAN_MAX_SITES["pro"],
            stripe_customer_id="cus_R", stripe_subscription_id="sub_R", subscription_status="active",
        ))
        db_session.commit()
        _mock_event(monkeypatch, {
            "id": "evt_deleted",
            "type": "customer.subscription.deleted",
            "data": {"object": {"id": "sub_R", "customer": "cus_R", "status": "canceled", "metadata": {}}},
        })
        resp = _post_webhook(client)
        assert resp.status_code == 200

        tenant = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_A).first()
        assert tenant.plan == "beta"
        assert tenant.max_sites == PLAN_MAX_SITES["beta"]
        assert tenant.subscription_status == "canceled"
        assert tenant.subscription_end is None

    def test_duplicate_event_not_processed_twice(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A, plan="beta")
        _mock_event(monkeypatch, {
            "id": "evt_dup",
            "type": "checkout.session.completed",
            "data": {"object": {
                "client_reference_id": str(TENANT_A),
                "customer": "cus_d",
                "subscription": "sub_d",
                "payment_status": "paid",
                "metadata": {"tenant_id": str(TENANT_A), "plan_id": "starter"},
            }},
        })
        r1 = _post_webhook(client)
        assert r1.status_code == 200
        r2 = _post_webhook(client)
        assert r2.status_code == 200
        assert r2.json().get("duplicate") is True

        assert db_session.query(models.StripeEvent).filter(models.StripeEvent.event_id == "evt_dup").count() == 1
        tenant = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_A).first()
        assert tenant.plan == "starter"


# ── C. Security / tenant isolation ──────────────────────────────────────────
class TestWebhookSecurity:
    def test_tenant_a_event_does_not_affect_tenant_b(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A, plan="beta")
        _seed_tenant(db_session, TENANT_B, plan="beta")
        _mock_event(monkeypatch, {
            "id": "evt_iso",
            "type": "checkout.session.completed",
            "data": {"object": {
                "client_reference_id": str(TENANT_A),
                "customer": "cus_A",
                "subscription": "sub_A",
                "payment_status": "paid",
                "metadata": {"tenant_id": str(TENANT_A), "plan_id": "home"},
            }},
        })
        _post_webhook(client)

        tenant_b = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_B).first()
        assert tenant_b.plan == "beta"
        assert tenant_b.stripe_customer_id is None
        assert tenant_b.stripe_subscription_id is None

    def test_unbound_event_does_not_assign_payment(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_B, plan="beta")
        _mock_event(monkeypatch, {
            "id": "evt_unbound",
            "type": "checkout.session.completed",
            "data": {"object": {
                "customer": "cus_unknown",
                "subscription": "sub_x",
                "payment_status": "paid",
                "metadata": {"plan_id": "home"},
            }},
        })
        resp = _post_webhook(client)
        assert resp.status_code == 200

        tenant_b = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_B).first()
        assert tenant_b.plan == "beta"
        assert tenant_b.stripe_subscription_id is None

    def test_unpaid_checkout_does_not_grant_plan(self, client, db_session, monkeypatch):
        _seed_tenant(db_session, TENANT_A, plan="beta")
        _mock_event(monkeypatch, {
            "id": "evt_unpaid",
            "type": "checkout.session.completed",
            "data": {"object": {
                "client_reference_id": str(TENANT_A),
                "customer": "cus_u",
                "subscription": "sub_u",
                "payment_status": "unpaid",
                "metadata": {"tenant_id": str(TENANT_A), "plan_id": "pro"},
            }},
        })
        _post_webhook(client)

        tenant = db_session.query(models.Tenant).filter(models.Tenant.id == TENANT_A).first()
        assert tenant.plan == "beta"


