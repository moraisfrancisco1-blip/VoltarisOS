"""RGPD: a user can export their data and have it anonymised; nothing identifying
survives, credentials never leak into the export, and the guards hold."""
from __future__ import annotations

import json
import secrets

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import gdpr, models
from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_module
from backend.routers import privacy as privacy_module
from backend.routers import webhooks as webhooks_module
from backend.security import ALGORITHM, SECRET_KEY, limiter
import backend.tasks as tasks_module

PW = "t-" + secrets.token_hex(8)
VICTIM = "ana@example.com"


def H(email, role="TENANT_MEMBER", tenant_id=1):
    tok = jwt.encode({"sub": email, "role": role, "tenant_id": tenant_id}, SECRET_KEY, algorithm=ALGORITHM)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    s.add_all([models.Tenant(id=1, name="A", slug="a", plan="pro", max_sites=5),
               models.Tenant(id=2, name="B", slug="b", plan="pro", max_sites=5)])
    s.add_all([
        models.User(id=10, tenant_id=1, email=VICTIM, name="Ana", phone="+351 900", job_title="Eng",
                    password_hash=auth_module.hash_pw(PW), role="TENANT_MEMBER", active=True,
                    totp_secret="TOTPSECRET", totp_enabled=True, totp_backup_codes=["h1"], avatar_data_url="data:x"),
        models.User(id=11, tenant_id=1, email="boss@example.com", password_hash=auth_module.hash_pw(PW),
                    role="TENANT_ADMIN", active=True),
        models.User(id=12, tenant_id=2, email="other@example.com", password_hash="x", role="TENANT_MEMBER", active=True),
        models.User(id=13, tenant_id=1, email="root@example.com", password_hash="x", role="SUPER_ADMIN", active=True),
    ])
    s.commit()
    s.add(models.AuditLog(tenant_id=1, user_id=10, user_email=VICTIM, action="user.login.success",
                          ip_address="203.0.113.9", user_agent="UA"))
    s.add(models.AuditLog(tenant_id=1, user_id=11, user_email="boss@example.com", action="user.invited",
                          target_resource="user", target_id=10, details={"email": VICTIM}))
    s.add(models.ApiKey(tenant_id=1, user_id=10, name="k", key_prefix="vos_abc", key_hash="HASH"))
    s.add(models.OAuthConnection(tenant_id=1, user_id=10, provider="google", access_token="TOK", account_label=VICTIM))
    s.add(models.ReportJob(tenant_id=1, report_type="x", requested_by=VICTIM))
    s.add(models.Lead(name="Ana", email=VICTIM))
    s.commit()
    try:
        yield s
    finally:
        s.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(tasks_module.deliver_webhook, "delay", lambda *a, **kw: None)

    def _get_db():
        yield db

    for module in (privacy_module, auth_module, webhooks_module):
        app.dependency_overrides[module.get_db] = _get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def test_export_contains_the_data_and_none_of_the_credentials(client, db):
    r = client.get("/api/privacy/me/export", headers=H(VICTIM))
    assert r.status_code == 200
    body = r.json()
    assert body["profile"]["email"] == VICTIM and body["profile"]["phone"] == "+351 900"
    assert [k["prefix"] for k in body["api_keys"]] == ["vos_abc"]
    assert body["oauth_connections"][0]["provider"] == "google"
    assert len(body["leads"]) == 1 and len(body["report_requests"]) == 1
    assert any(a["ip_address"] == "203.0.113.9" for a in body["activity_log"])
    blob = json.dumps(body)
    for secret in ("TOTPSECRET", "HASH", "TOK", "h1", "password_hash"):
        assert secret not in blob
    assert db.query(models.AuditLog).filter_by(action="privacy.data_exported").count() == 1


def test_erasure_needs_password_and_confirmation(client, db):
    assert client.post("/api/privacy/me/erase", headers=H(VICTIM), json={"password": PW, "confirm": "no"}).status_code == 400
    assert client.post("/api/privacy/me/erase", headers=H(VICTIM), json={"password": "wrong", "confirm": "ERASE"}).status_code == 403
    db.expire_all()
    assert db.get(models.User, 10).email == VICTIM


def test_self_erasure_removes_every_identifier(client, db):
    r = client.post("/api/privacy/me/erase", headers=H(VICTIM), json={"password": PW, "confirm": "ERASE"})
    assert r.status_code == 200, r.text
    db.expire_all()
    u = db.get(models.User, 10)
    assert u.email == gdpr.pseudonym_for(10) and u.active is False
    assert (u.name, u.phone, u.job_title, u.avatar_data_url, u.totp_secret, u.totp_backup_codes) == (None,) * 6
    assert u.totp_enabled is False
    assert db.query(models.Lead).count() == 0
    assert db.query(models.OAuthConnection).count() == 0
    assert db.query(models.ApiKey).one().revoked_at is not None
    assert db.query(models.ReportJob).one().requested_by == gdpr.pseudonym_for(10)
    for row in db.query(models.AuditLog):
        assert row.ip_address is None or row.action == "privacy.user_erased"
        assert VICTIM not in json.dumps([row.user_email, row.details, row.user_agent])
    assert db.query(models.AuditLog).filter_by(action="user.invited").one().details == {"email": gdpr.pseudonym_for(10)}
    event = db.query(models.AuditLog).filter_by(action="privacy.user_erased").one()
    assert VICTIM not in json.dumps([event.user_email, event.details])
    # and the account can no longer log in
    assert client.post("/api/auth/login", json={"email": VICTIM, "password": PW}).status_code in (401, 403, 404)


def test_second_erasure_is_refused(client, db):
    gdpr.erase_user(db, db.get(models.User, 10))
    r = client.post("/api/privacy/users/10/erase", headers=H("boss@example.com", "TENANT_ADMIN"), json={"confirm": "ERASE"})
    assert r.status_code == 409


def test_the_only_tenant_admin_cannot_erase_themselves(client, db):
    r = client.post("/api/privacy/me/erase", headers=H("boss@example.com", "TENANT_ADMIN"), json={"password": PW, "confirm": "ERASE"})
    assert r.status_code == 409


def test_super_admin_accounts_are_never_anonymised_here(client, db):
    r = client.post("/api/privacy/users/13/erase", headers=H("root@example.com", "SUPER_ADMIN"), json={"confirm": "ERASE"})
    assert r.status_code == 403


class TestAdminVariants:
    def test_tenant_admin_can_export_and_erase_a_colleague(self, client, db):
        h = H("boss@example.com", "TENANT_ADMIN")
        assert client.get("/api/privacy/users/10/export", headers=h).status_code == 200
        assert client.post("/api/privacy/users/10/erase", headers=h, json={"confirm": "ERASE"}).status_code == 200
        db.expire_all()
        assert db.get(models.User, 10).email == gdpr.pseudonym_for(10)

    def test_cross_tenant_is_forbidden(self, client, db):
        h = H("boss@example.com", "TENANT_ADMIN")
        assert client.get("/api/privacy/users/12/export", headers=h).status_code == 403
        assert client.post("/api/privacy/users/12/erase", headers=h, json={"confirm": "ERASE"}).status_code == 403
        db.expire_all()
        assert db.get(models.User, 12).email == "other@example.com"

    def test_members_cannot_use_the_admin_routes(self, client):
        assert client.get("/api/privacy/users/11/export", headers=H(VICTIM)).status_code == 403
        assert client.post("/api/privacy/users/11/erase", headers=H(VICTIM), json={"confirm": "ERASE"}).status_code == 403
