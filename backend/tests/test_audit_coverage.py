"""Audit trail coverage: every state-changing endpoint that matters records who did
what, the helper never breaks the action it audits, secrets stay out of the log,
and the fail-open tenant checks / SSRF hole found while adding it are closed."""
from __future__ import annotations

import ast
import glob
import os
import secrets
import types

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import audit as audit_module
from backend import models
from backend.database import Base
from backend.main import app
from backend.routers import alerts_ws as alerts_module
from backend.routers import auth as auth_module
from backend.routers import devices as devices_module
from backend.routers import payments as payments_module
from backend.routers import reports as reports_module
from backend.routers import sites as sites_module
from backend.routers import tenant_settings as tenant_settings_module
from backend.routers import vpp as vpp_module
from backend.routers import webhooks as webhooks_module
from backend.security import ALGORITHM, SECRET_KEY, limiter
import backend.tasks as tasks_module

TENANT_A, TENANT_B = 1, 2

# Throwaway credentials generated per run, so the "nothing leaked into the audit
# log" assertions check the values actually used (and no password-looking literal
# sits in the source for secret scanners to flag).
OLD_PW = "t-" + secrets.token_hex(8)
NEW_PW = "t-" + secrets.token_hex(8)
REGISTER_PW = "t-" + secrets.token_hex(8)
INVITE_PW = "t-" + secrets.token_hex(8)


def _token(email, role="TENANT_ADMIN", tenant_id=TENANT_A):
    return jwt.encode({"sub": email, "role": role, "tenant_id": tenant_id}, SECRET_KEY, algorithm=ALGORITHM)


def H(email="admin-a@x.com", role="TENANT_ADMIN", tenant_id=TENANT_A):
    return {"Authorization": f"Bearer {_token(email, role, tenant_id)}"}


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    session.add(models.Tenant(id=TENANT_A, name="A", slug="a", plan="pro", max_sites=20))
    session.add(models.Tenant(id=TENANT_B, name="B", slug="b", plan="pro", max_sites=20))
    session.add(models.User(tenant_id=TENANT_A, email="admin-a@x.com", password_hash=auth_module.hash_pw(OLD_PW),
                            role="TENANT_ADMIN", active=True))
    session.add(models.User(tenant_id=TENANT_A, email="member-a@x.com", password_hash="x", role="TENANT_MEMBER", active=True))
    session.add(models.User(tenant_id=TENANT_B, email="member-b@x.com", password_hash="x", role="TENANT_MEMBER", active=True))
    session.add(models.User(tenant_id=TENANT_A, email="root@x.com", password_hash="x", role="SUPER_ADMIN", active=True))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(tasks_module.deliver_webhook, "delay", lambda *a, **kw: None)

    def _get_db():
        yield db

    for module in (sites_module, devices_module, vpp_module, alerts_module, reports_module, payments_module,
                   auth_module, tenant_settings_module, webhooks_module):
        app.dependency_overrides[module.get_db] = _get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def rows(db, action=None):
    db.expire_all()
    q = db.query(models.AuditLog)
    if action:
        q = q.filter(models.AuditLog.action == action)
    return q.order_by(models.AuditLog.id).all()


def one(db, action):
    found = rows(db, action)
    assert len(found) == 1, f"expected exactly one {action!r}, got {[r.action for r in rows(db)]}"
    return found[0]


# ── the helper ───────────────────────────────────────────────────────────────
class TestAuditRequestHelper:
    def _request(self, ip="203.0.113.7", ua="pytest-agent"):
        return types.SimpleNamespace(client=types.SimpleNamespace(host=ip), headers={"user-agent": ua})

    def test_records_actor_tenant_ip_and_user_agent(self, db):
        audit_module.audit_request(db, self._request(), {"sub": "u@x.com", "tenant_id": 7}, "x.did",
                                   target_resource="thing", target_id=3, details={"a": 1})
        row = one(db, "x.did")
        assert (row.user_email, row.tenant_id, row.ip_address, row.user_agent) == ("u@x.com", 7, "203.0.113.7", "pytest-agent")
        assert (row.target_resource, row.target_id, row.details) == ("thing", 3, {"a": 1})

    def test_explicit_tenant_and_system_actor_override_the_caller(self, db):
        audit_module.audit_request(db, None, {"sub": "root@x.com", "tenant_id": 99}, "x.did", tenant_id=5, user_email="stripe")
        row = one(db, "x.did")
        assert (row.tenant_id, row.user_email, row.ip_address) == (5, "stripe", None)

    def test_works_without_a_request_or_user(self, db):
        assert audit_module.audit_request(db, None, None, "x.did") is not None

    def test_a_failure_is_swallowed_and_never_breaks_the_caller(self, db, monkeypatch):
        def boom(**kw):
            raise RuntimeError("db exploded")
        monkeypatch.setattr(audit_module, "log_audit_event", boom)
        assert audit_module.audit_request(db, None, {"sub": "u"}, "x.did") is None  # no exception

    def test_webhook_dispatch_can_be_suppressed(self, db, monkeypatch):
        calls = []
        monkeypatch.setattr(audit_module, "_dispatch_webhooks", lambda *a, **kw: calls.append(a))
        audit_module.audit_request(db, None, {"sub": "u", "tenant_id": 1}, "a.b")
        audit_module.audit_request(db, None, {"sub": "u", "tenant_id": 1}, "a.c", dispatch_webhooks=False)
        assert len(calls) == 1 and calls[0][2] == "a.b"


# ── sites ────────────────────────────────────────────────────────────────────
class TestSites:
    def test_create_update_delete_are_audited(self, client, db):
        sid = client.post("/api/sites", json={"name": "Casa", "owner": "João Silva"}, headers=H()).json()["id"]
        created = one(db, "site.created")
        assert (created.target_id, created.tenant_id, created.user_email, created.details) == (sid, TENANT_A, "admin-a@x.com", {"name": "Casa"})

        assert client.patch(f"/api/sites/{sid}", json={"owner": "Maria Costa", "location": "Porto"}, headers=H()).status_code == 200
        updated = one(db, "site.updated")
        assert updated.details == {"fields": ["location", "owner"]}  # names only: owner/location are personal data
        assert "Maria" not in str(updated.details) and "Porto" not in str(updated.details)

        assert client.delete(f"/api/sites/{sid}", headers=H()).status_code == 200
        deleted = one(db, "site.deleted")
        assert (deleted.target_id, deleted.tenant_id, deleted.details) == (sid, TENANT_A, {"name": "Casa"})

    def test_rejected_requests_leave_no_event(self, client, db):
        assert client.patch("/api/sites/999", json={"name": "x"}, headers=H()).status_code == 404
        assert client.delete("/api/sites/999", headers=H()).status_code == 404
        assert rows(db) == []


# ── devices ──────────────────────────────────────────────────────────────────
class TestDevices:
    def test_device_lifecycle_never_logs_credentials_or_hosts(self, client, db):
        body = {"name": "Inv", "protocol": "modbus_tcp", "config": {"host": "198.51.100.9", "password": "hunter2", "api_key": "KEY"}}
        did = client.post("/api/devices", json=body, headers=H()).json()["id"]
        created = one(db, "device.created")
        assert created.details["protocol"] == "modbus_tcp"

        client.put(f"/api/devices/{did}", json={"config": {"host": "198.51.100.10", "password": "hunter3", "api_key": "KEY"}, "enabled": False}, headers=H())
        updated = one(db, "device.updated")
        assert updated.details["config_keys_changed"] == ["host", "password"]
        assert updated.details["enabled"] is False

        client.post(f"/api/devices/{did}/test", headers=H())
        tested = one(db, "device.tested")
        assert set(tested.details) == {"protocol", "ok"}

        client.delete(f"/api/devices/{did}", headers=H())
        assert one(db, "device.deleted").target_id == did

        blob = " ".join(str(r.details) for r in rows(db))
        for secret in ("hunter2", "hunter3", "KEY", "198.51.100"):
            assert secret not in blob, f"{secret!r} leaked into the audit log"

    def test_foreign_device_is_404_and_unaudited(self, client, db):
        did = client.post("/api/devices", json={"name": "D", "protocol": "solaredge"}, headers=H()).json()["id"]
        before = len(rows(db))
        assert client.delete(f"/api/devices/{did}", headers=H("member-b@x.com", "TENANT_MEMBER", TENANT_B)).status_code == 404
        assert len(rows(db)) == before


# ── vpp ──────────────────────────────────────────────────────────────────────
class TestVpp:
    def test_group_and_membership_events(self, client, db):
        sid = client.post("/api/sites", json={"name": "S"}, headers=H()).json()["id"]
        g = client.post("/api/vpp", json={"name": "G", "market": "MIBEL", "strategy": "arbitrage", "target_kw": 100, "min_bid_kw": 10}, headers=H())
        assert g.status_code == 201, g.text
        gid = g.json()["id"]
        assert one(db, "vpp.group.created").target_id == gid

        assert client.post(f"/api/vpp/{gid}/sites", json={"site_id": sid, "weight": 1.0}, headers=H()).status_code == 200
        assert one(db, "vpp.site.added").details["site_id"] == sid
        assert client.delete(f"/api/vpp/{gid}/sites/{sid}", headers=H()).status_code == 204
        assert one(db, "vpp.site.removed").details["site_id"] == sid
        assert client.delete(f"/api/vpp/{gid}", headers=H()).status_code == 204
        assert one(db, "vpp.group.deleted").target_id == gid


# ── alerts ───────────────────────────────────────────────────────────────────
class TestAlerts:
    def test_rule_and_acknowledge_events_record_the_real_actor(self, client, db):
        rid = client.post("/api/alert-rules", json={"name": "hot", "metric": "temp_c", "operator": "gt", "threshold": 60}, headers=H()).json()["id"]
        created = one(db, "alert_rule.created")
        assert created.target_id == rid and created.details["metric"] == "temp_c"

        alert = models.Alert(tenant_id=TENANT_A, device_id=1, device_name="d", severity="critical", title="t", message="m", metric="temp_c", value=70.0, rule_id=rid)
        db.add(alert)
        db.commit()
        assert client.post(f"/api/alerts/{alert.id}/ack?by=user", headers=H("member-a@x.com", "TENANT_MEMBER")).status_code == 200
        ack = one(db, "alert.acknowledged")
        # `by` is whatever the client sent ("user"); the audit entry has the authenticated actor.
        assert ack.user_email == "member-a@x.com" and ack.details["claimed_by"] == "user"

        assert client.delete(f"/api/alert-rules/{rid}", headers=H()).status_code == 204
        assert one(db, "alert_rule.deleted").target_id == rid


# ── reports ──────────────────────────────────────────────────────────────────
class TestReports:
    def test_request_is_audited(self, client, db, monkeypatch):
        monkeypatch.setattr(reports_module, "_build_pdf", lambda *a, **kw: None)
        resp = client.post("/api/reports/generate", json={"report_type": reports_module.VALID_TYPES[0] if isinstance(reports_module.VALID_TYPES, (list, tuple)) else sorted(reports_module.VALID_TYPES)[0]}, headers=H())
        assert resp.status_code == 201, resp.text
        row = one(db, "report.requested")
        assert row.target_id == resp.json()["id"] and row.user_email == "admin-a@x.com"


# ── users / tenants ──────────────────────────────────────────────────────────
def _user(db, email):
    db.expire_all()
    return db.query(models.User).filter(models.User.email == email).first()


class TestUserAdministration:
    def test_register_is_audited_without_the_password(self, client, db):
        resp = client.post("/api/auth/register", json={"email": "new@x.com", "password": REGISTER_PW, "company": "NewCo",
                                                       "terms_accepted": True, "plan": "pro"})
        assert resp.status_code == 200, resp.text
        row = one(db, "user.registered")
        assert row.user_email == "new@x.com" and row.details["payment_pending"] is True and row.details["plan"] == "home"
        assert REGISTER_PW not in str(row.details)

    def test_change_password_is_audited_without_any_password(self, client, db):
        resp = client.post("/api/auth/change-password", json={"current_password": OLD_PW, "new_password": NEW_PW}, headers=H())
        assert resp.status_code == 200, resp.text
        row = one(db, "user.password_changed")
        assert row.user_email == "admin-a@x.com" and row.details is None
        assert OLD_PW not in str(row.details) and NEW_PW not in str(row.details)

    def test_failed_password_change_is_not_recorded_as_a_change(self, client, db):
        assert client.post("/api/auth/change-password", json={"current_password": "wrong-" + OLD_PW, "new_password": NEW_PW}, headers=H()).status_code == 401
        assert rows(db, "user.password_changed") == []

    def test_invite_toggle_delete_are_audited(self, client, db):
        resp = client.post("/api/auth/invite", json={"email": "mate@x.com", "password": INVITE_PW, "name": "Mate"}, headers=H())
        assert resp.status_code == 200, resp.text
        invited = one(db, "user.invited")
        assert invited.details == {"email": "mate@x.com", "role": "TENANT_MEMBER"} and invited.tenant_id == TENANT_A

        uid = _user(db, "mate@x.com").id
        assert client.patch(f"/api/auth/users/{uid}/toggle-active", headers=H()).status_code == 200
        assert one(db, "user.activation_toggled").details == {"email": "mate@x.com", "active": False}

        assert client.delete(f"/api/auth/users/{uid}", headers=H()).status_code == 200
        deleted = one(db, "user.deleted")
        assert (deleted.target_id, deleted.details["email"]) == (uid, "mate@x.com")

    def test_super_admin_creating_a_tenant_is_audited_against_the_new_tenant(self, client, db):
        resp = client.post("/api/admin/tenants", json={"name": "Brand New", "plan": "pro", "admin_email": "owner@new.com"}, headers=H("root@x.com", "SUPER_ADMIN"))
        assert resp.status_code == 201, resp.text
        row = one(db, "tenant.created")
        assert row.tenant_id == resp.json()["id"] and row.user_email == "root@x.com"
        assert row.details["first_user_email"] == "owner@new.com"
        assert "temporary_password" not in str(row.details)


class TestFailClosedTenantChecks:
    """A token outlives its account (72h). The admin's own row being gone must not
    switch the tenant checks off, nor fall back to tenant 1."""

    def test_invite_with_a_vanished_admin_is_refused_not_placed_in_tenant_1(self, client, db):
        ghost = H("ghost-admin@x.com", "TENANT_ADMIN", TENANT_B)
        resp = client.post("/api/auth/invite", json={"email": "x@x.com", "password": INVITE_PW, "name": "X"}, headers=ghost)
        assert resp.status_code == 403
        assert _user(db, "x@x.com") is None
        assert rows(db, "user.invited") == []

    def test_toggle_and_delete_with_a_vanished_admin_are_refused(self, client, db):
        victim = _user(db, "member-b@x.com")
        ghost = H("ghost-admin@x.com", "TENANT_ADMIN", TENANT_A)
        assert client.patch(f"/api/auth/users/{victim.id}/toggle-active", headers=ghost).status_code == 403
        assert client.delete(f"/api/auth/users/{victim.id}", headers=ghost).status_code == 403
        victim = _user(db, "member-b@x.com")
        assert victim is not None and victim.active is True
        assert rows(db, "user.deleted") == [] and rows(db, "user.activation_toggled") == []

    def test_a_real_admin_still_cannot_touch_another_tenant(self, client, db):
        victim = _user(db, "member-b@x.com")
        assert client.delete(f"/api/auth/users/{victim.id}", headers=H()).status_code == 403
        assert _user(db, "member-b@x.com") is not None

    def test_super_admin_is_unaffected(self, client, db):
        victim = _user(db, "member-b@x.com")
        assert client.patch(f"/api/auth/users/{victim.id}/toggle-active", headers=H("root@x.com", "SUPER_ADMIN")).status_code == 200


# ── outbound test messages ───────────────────────────────────────────────────
def _set_slack(client, url):
    client.patch("/api/tenant-settings", json={"notifications": {"slackWebhook": url}}, headers=H())


class TestSlackTestNotification:
    @pytest.mark.parametrize("url", [
        "http://hooks.slack.com/services/x",       # not https
        "https://169.254.169.254/latest/meta-data/",
        "https://localhost:8080/admin",
        "https://10.0.0.5/hook",
    ])
    def test_internal_or_non_https_destinations_are_refused_and_never_contacted(self, client, db, monkeypatch, url):
        monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", "false")
        _set_slack(client, url)

        def must_not_post(*a, **kw):
            raise AssertionError("must not contact the destination")
        monkeypatch.setattr(tenant_settings_module.httpx, "post", must_not_post)

        resp = client.post("/api/tenant-settings/notifications/test", headers=H())
        assert resp.status_code == 400, resp.text

    def test_the_response_body_is_never_reflected(self, client, db, monkeypatch):
        monkeypatch.setattr("backend.netguard.socket.getaddrinfo", lambda *a, **kw: [(2, 1, 6, "", ("93.184.216.34", 0))])
        _set_slack(client, "https://hooks.slack.com/services/T/B/x")

        class Resp:
            status_code = 500
            text = "INTERNAL-SECRET-BODY"
        monkeypatch.setattr(tenant_settings_module.httpx, "post", lambda *a, **kw: Resp())
        resp = client.post("/api/tenant-settings/notifications/test", headers=H())
        assert resp.status_code == 502
        assert "INTERNAL-SECRET-BODY" not in resp.text

    def test_connection_errors_do_not_reflect_the_exception_text(self, client, db, monkeypatch):
        monkeypatch.setattr("backend.netguard.socket.getaddrinfo", lambda *a, **kw: [(2, 1, 6, "", ("93.184.216.34", 0))])
        _set_slack(client, "https://hooks.slack.com/services/T/B/x")

        def refuse(*a, **kw):
            raise tenant_settings_module.httpx.ConnectError("connect to 10.1.2.3:6379 refused")
        monkeypatch.setattr(tenant_settings_module.httpx, "post", refuse)
        resp = client.post("/api/tenant-settings/notifications/test", headers=H())
        assert resp.status_code == 502 and "10.1.2.3" not in resp.text

    def test_outcome_is_audited_for_success_and_failure(self, client, db, monkeypatch):
        monkeypatch.setattr("backend.netguard.socket.getaddrinfo", lambda *a, **kw: [(2, 1, 6, "", ("93.184.216.34", 0))])
        _set_slack(client, "https://hooks.slack.com/services/T/B/x")

        class Resp:
            status_code = 200
            text = "ok"
        monkeypatch.setattr(tenant_settings_module.httpx, "post", lambda *a, **kw: Resp())
        assert client.post("/api/tenant-settings/notifications/test", headers=H()).status_code == 200
        Resp.status_code = 404
        assert client.post("/api/tenant-settings/notifications/test", headers=H()).status_code == 502
        assert [r.details["ok"] for r in rows(db, "tenant_settings.test_notification")] == [True, False]


class TestWebhookTest:
    def test_manual_test_is_audited_without_notifying_the_webhook_twice(self, client, db, monkeypatch):
        deliveries = []
        monkeypatch.setattr(tasks_module.deliver_webhook, "delay", lambda *a, **kw: deliveries.append(a))
        wid = client.post("/api/webhooks", json={"url": "https://example.com/hook", "event_types": ["*"]}, headers=H()).json()["id"]
        deliveries.clear()
        assert client.post(f"/api/webhooks/{wid}/test", headers=H()).status_code == 200
        assert [d[1] for d in deliveries] == ["webhook.test"]  # one message, not two
        assert one(db, "webhook.tested").target_id == wid


# ── billing ──────────────────────────────────────────────────────────────────
class TestBillingEvents:
    def _event(self, event_id, event_type, obj):
        return {"id": event_id, "type": event_type, "data": {"object": obj}}

    def _post(self, client, monkeypatch, event):
        monkeypatch.setattr(payments_module.stripe.Webhook, "construct_event", lambda payload, sig, secret: event)
        return client.post("/api/payments/webhook", content=b"{}", headers={"stripe-signature": "t=1,v1=ok"})

    def test_checkout_and_portal_are_audited(self, client, db, monkeypatch):
        class Cust:
            id = "cus_1"

        class Sess:
            id = "cs_1"
            url = "https://stripe.example/pay"
        monkeypatch.setattr(payments_module.stripe.Customer, "create", lambda **kw: Cust())
        monkeypatch.setattr(payments_module.stripe.checkout.Session, "create", lambda **kw: Sess())
        assert client.post("/api/payments/create-checkout-session", json={"plan_id": "pro", "billing_cycle": "yearly"}, headers=H()).status_code == 200
        row = one(db, "billing.checkout_started")
        assert row.details == {"plan": "pro", "billing_cycle": "yearly", "amount_eur": 12660.48, "session_id": "cs_1"}

        monkeypatch.setattr(payments_module.stripe.billing_portal.Session, "create", lambda **kw: Sess())
        assert client.post("/api/payments/create-portal-session", headers=H()).status_code == 200
        assert one(db, "billing.portal_opened").tenant_id == TENANT_A

    def test_a_plan_change_by_stripe_is_audited_with_the_system_as_actor(self, client, db, monkeypatch):
        tenant = db.get(models.Tenant, TENANT_A)
        tenant.plan, tenant.subscription_status = "home", "pending_payment"
        db.commit()
        resp = self._post(client, monkeypatch, self._event("evt_1", "checkout.session.completed", {
            "client_reference_id": str(TENANT_A), "customer": "cus_9", "subscription": "sub_9", "payment_status": "paid",
            "metadata": {"tenant_id": str(TENANT_A), "plan_id": "starter"}}))
        assert resp.status_code == 200
        row = one(db, "billing.subscription_changed")
        assert row.user_email == "stripe" and row.tenant_id == TENANT_A and row.details["event_id"] == "evt_1"
        assert (row.details["plan_from"], row.details["plan_to"]) == ("home", "starter")
        assert (row.details["status_from"], row.details["status_to"]) == ("pending_payment", "active")

    def test_events_that_change_nothing_and_duplicates_are_not_audited(self, client, db, monkeypatch):
        tenant = db.get(models.Tenant, TENANT_A)
        tenant.plan, tenant.subscription_status, tenant.stripe_subscription_id = "pro", "active", "sub_1"
        db.commit()
        noop = self._event("evt_noop", "invoice.payment_succeeded", {"customer": "cus_x", "subscription": "sub_1", "metadata": {"tenant_id": str(TENANT_A)}, "client_reference_id": str(TENANT_A)})
        assert self._post(client, monkeypatch, noop).status_code == 200
        assert rows(db, "billing.subscription_changed") == []

        failed = self._event("evt_fail", "invoice.payment_failed", {"customer": "cus_x", "subscription": "sub_1", "client_reference_id": str(TENANT_A)})
        self._post(client, monkeypatch, failed)
        self._post(client, monkeypatch, failed)  # Stripe redelivers: processed (and audited) once
        changes = rows(db, "billing.subscription_changed")
        assert len(changes) == 1 and changes[0].details["status_to"] == "past_due"

    def test_a_failing_audit_never_turns_a_processed_event_into_an_error(self, client, db, monkeypatch):
        monkeypatch.setattr(audit_module, "log_audit_event", lambda **kw: (_ for _ in ()).throw(RuntimeError("boom")))
        tenant = db.get(models.Tenant, TENANT_A)
        tenant.plan, tenant.subscription_status = "home", "pending_payment"
        db.commit()
        resp = self._post(client, monkeypatch, self._event("evt_2", "checkout.session.completed", {
            "client_reference_id": str(TENANT_A), "customer": "c", "subscription": "s", "payment_status": "paid",
            "metadata": {"tenant_id": str(TENANT_A), "plan_id": "pro"}}))
        assert resp.status_code == 200
        db.expire_all()
        assert db.get(models.Tenant, TENANT_A).plan == "pro"  # the change itself is not lost


# ── static guarantees ────────────────────────────────────────────────────────
ROUTERS = sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "routers", "*.py")))

# Mutating endpoints deliberately NOT audited, with the reason. Anything not
# listed here must call the audit helper: this keeps the coverage from rotting.
UNAUDITED = {
    "auth.logout": "no state change; would only add noise",
    "copilot.copilot": "pure computation (LLM answer), no state change",
    "optimization_api.optimize_multi_asset": "pure computation",
    "trading_api.arbitrage_signals": "pure computation",
    "trading_agent.toggle_agent": "in-memory simulation (responses are flagged simulated=true)",
    "trading_agent.update_config": "in-memory simulation (responses are flagged simulated=true)",
    "devices.ingest_reading": "high-volume telemetry; the batch path audits ingestion",
    "devices.ingest_batch": "audited inside _ingest_readings_batch",
    "alerts_ws.fire_alert": "service-to-service gateway call, high volume",
    "oauth_connections.oauth_start": "starts a redirect; connect/disconnect are audited",
    "vpp.optimize_vpp": "persists a VPPOptimizationRun row, which is its own record",
    "vpp.dispatch_dry_run": "dry run, persists an optimisation run, writes nothing to equipment",
}


def _mutating_endpoints():
    for path in ROUTERS:
        module = os.path.basename(path)[:-3]
        tree = ast.parse(open(path).read())
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                is_mutating = any(
                    isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr in ("post", "put", "patch", "delete")
                    for d in node.decorator_list
                )
                if is_mutating:
                    yield module, node


def test_every_mutating_endpoint_is_audited_or_explicitly_exempt():
    missing = []
    for module, node in _mutating_endpoints():
        key = f"{module}.{node.name}"
        body = ast.unparse(node)
        audited = any(token in body for token in ("audit_request", "log_audit_event", "log_user_login", "_audit_command"))
        if not audited and key not in UNAUDITED:
            missing.append(key)
    assert not missing, f"mutating endpoints without an audit event (audit them or justify in UNAUDITED): {missing}"


def test_the_exemption_list_has_no_stale_entries():
    existing = {f"{module}.{node.name}" for module, node in _mutating_endpoints()}
    assert set(UNAUDITED) <= existing, f"stale exemptions: {sorted(set(UNAUDITED) - existing)}"


def test_every_audit_action_is_subscribable_through_webhooks():
    """KNOWN_EVENT_TYPES is a closed list kept by hand; an action missing from it
    can never be subscribed to individually."""
    emitted = set()
    for path in ROUTERS + [os.path.join(os.path.dirname(__file__), "..", "audit.py")]:
        for node in ast.walk(ast.parse(open(path).read())):
            if isinstance(node, ast.Call):
                name = ast.unparse(node.func)
                # Events recorded with dispatch_webhooks=False never reach webhooks,
                # so being subscribable is meaningless for them.
                if any(k.arg == "dispatch_webhooks" and isinstance(k.value, ast.Constant) and k.value.value is False
                       for k in node.keywords):
                    continue
                if name.endswith(("audit_request", "_audit_command")):
                    literals = [a.value for a in node.args if isinstance(a, ast.Constant) and isinstance(a.value, str) and "." in a.value]
                    emitted.update(l for l in literals if l.split(".")[0] not in ("backend", "x"))
                if name.endswith("log_audit_event"):
                    emitted.update(k.value.value for k in node.keywords if k.arg == "action" and isinstance(k.value, ast.Constant))
    missing = sorted(a for a in emitted if a not in webhooks_module.KNOWN_EVENT_TYPES)
    assert not missing, f"audit actions that cannot be subscribed to: {missing}"
