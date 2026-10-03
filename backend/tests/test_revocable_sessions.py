"""Sessions are revocable: a login is a server-side row, the JWT names it, and
ending it (logout, password change, deactivation, admin, RGPD erasure) kills the
token at once instead of when its 72h expiry arrives."""
from __future__ import annotations

import secrets
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models, security
from backend.database import Base
from backend.main import app
from backend.routers import auth as auth_module
from backend.routers import privacy as privacy_module
from backend.routers import sessions as sessions_module
from backend.security import ALGORITHM, SECRET_KEY, limiter

PW = "t-" + secrets.token_hex(8)
NEW_PW = "t-" + secrets.token_hex(8)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    s = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    s.add_all([models.Tenant(id=1, name="A", slug="a", plan="pro", max_sites=5),
               models.Tenant(id=2, name="B", slug="b", plan="pro", max_sites=5)])
    s.add_all([
        models.User(id=1, tenant_id=1, email="ana@x.com", password_hash=auth_module.hash_pw(PW), role="TENANT_MEMBER", active=True),
        models.User(id=2, tenant_id=1, email="boss@x.com", password_hash=auth_module.hash_pw(PW), role="TENANT_ADMIN", active=True),
        models.User(id=3, tenant_id=2, email="other@x.com", password_hash=auth_module.hash_pw(PW), role="TENANT_ADMIN", active=True),
    ])
    s.commit()
    try:
        yield s
    finally:
        s.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db, monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)

    def _get_db():
        yield db

    for module in (auth_module, sessions_module, privacy_module):
        app.dependency_overrides[module.get_db] = _get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def login(client, email="ana@x.com"):
    r = client.post("/api/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


def sid_of(token):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["sid"]


def test_login_creates_a_session_and_the_token_works(client, db):
    token = login(client)
    assert db.get(models.UserSession, sid_of(token)).user_id == 1
    assert client.get("/api/auth/me", headers=H(token)).status_code == 200


def test_logout_kills_the_token_that_was_used(client, db):
    token = login(client)
    assert client.post("/api/auth/logout", headers=H(token)).status_code == 200
    db.expire_all()
    assert db.query(models.UserSession).count() == 0
    r = client.get("/api/auth/me", headers=H(token))
    assert r.status_code == 401 and "Sessão" in r.json()["detail"]


def test_an_expired_session_is_refused(client, db):
    token = login(client)
    row = db.get(models.UserSession, sid_of(token))
    row.expires_at = models.utcnow_naive() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/auth/me", headers=H(token)).status_code == 401


def test_tokens_without_sid_still_work_unless_required(client, monkeypatch):
    legacy = jwt.encode({"sub": "ana@x.com", "role": "TENANT_MEMBER", "tenant_id": 1}, SECRET_KEY, algorithm=ALGORITHM)
    assert client.get("/api/auth/me", headers=H(legacy)).status_code == 200
    monkeypatch.setenv("SESSIONS_REQUIRE_SID", "true")
    assert client.get("/api/auth/me", headers=H(legacy)).status_code == 401


def test_me_upgrades_a_legacy_token_to_a_revocable_session(client, db):
    legacy = jwt.encode({"sub": "ana@x.com", "role": "TENANT_MEMBER", "tenant_id": 1}, SECRET_KEY, algorithm=ALGORITHM)
    me = client.get("/api/auth/me", headers=H(legacy))
    assert db.query(models.UserSession).count() == 1
    assert me.status_code == 200


def test_me_keeps_the_same_session_and_extends_it(client, db):
    token = login(client)
    row = db.get(models.UserSession, sid_of(token))
    row.expires_at = models.utcnow_naive() + timedelta(hours=1)
    db.commit()
    client.get("/api/auth/me", headers=H(token))
    db.expire_all()
    assert db.query(models.UserSession).count() == 1
    assert db.get(models.UserSession, sid_of(token)).expires_at > models.utcnow_naive() + timedelta(hours=70)


def test_changing_password_ends_the_other_logins_but_not_this_one(client, db):
    here, elsewhere = login(client), login(client)
    r = client.post("/api/auth/change-password", headers=H(here), json={"current_password": PW, "new_password": NEW_PW})
    assert r.status_code == 200
    assert client.get("/api/auth/me", headers=H(r.json()["token"])).status_code == 200
    assert client.get("/api/auth/me", headers=H(elsewhere)).status_code == 401


def test_deactivating_a_user_ends_their_sessions(client, db):
    victim = login(client, "ana@x.com")
    boss = login(client, "boss@x.com")
    assert client.patch("/api/auth/users/1/toggle-active", headers=H(boss)).json() == {"id": 1, "active": False}
    assert client.get("/api/auth/me", headers=H(victim)).status_code == 401


def test_list_marks_the_current_session_and_hides_others_users(client, db):
    mine, other = login(client), login(client, "other@x.com")
    listed = client.get("/api/sessions", headers=H(mine)).json()
    assert [s["current"] for s in listed] == [True]
    assert listed[0]["id"] == sid_of(mine) and sid_of(other) not in str(listed)


def test_revoke_one_and_revoke_others(client, db):
    a, b, c = login(client), login(client), login(client)
    assert client.delete(f"/api/sessions/{sid_of(b)}", headers=H(a)).status_code == 200
    assert client.get("/api/auth/me", headers=H(b)).status_code == 401
    assert client.post("/api/sessions/revoke-others", headers=H(a)).json() == {"ended": 1}
    assert client.get("/api/auth/me", headers=H(c)).status_code == 401
    assert client.get("/api/auth/me", headers=H(a)).status_code == 200


def test_a_user_cannot_end_someone_elses_session(client, db):
    mine, other = login(client), login(client, "other@x.com")
    assert client.delete(f"/api/sessions/{sid_of(other)}", headers=H(mine)).status_code == 404
    assert client.get("/api/auth/me", headers=H(other)).status_code == 200


def test_admin_can_end_a_colleagues_sessions_but_not_across_tenants(client, db):
    victim, boss, outsider = login(client), login(client, "boss@x.com"), login(client, "other@x.com")
    assert client.post("/api/sessions/users/1/revoke", headers=H(boss)).json() == {"ended": 1}
    assert client.get("/api/auth/me", headers=H(victim)).status_code == 401
    assert client.post("/api/sessions/users/3/revoke", headers=H(boss)).status_code == 403
    assert client.get("/api/auth/me", headers=H(outsider)).status_code == 200
    assert client.post("/api/sessions/users/1/revoke", headers=H(login(client))).status_code == 403  # a member is not an admin


def test_deleting_a_user_with_sessions_does_not_violate_the_foreign_key(client, db):
    login(client, "ana@x.com")
    boss = login(client, "boss@x.com")
    assert client.delete("/api/auth/users/1", headers=H(boss)).status_code == 200
    db.expire_all()
    assert db.get(models.User, 1) is None and db.query(models.UserSession).filter_by(user_id=1).count() == 0


def test_rgpd_erasure_ends_sessions_and_exports_them(client, db):
    token = login(client)
    export = client.get("/api/privacy/me/export", headers=H(token)).json()
    assert len(export["sessions"]) == 1
    assert client.post("/api/privacy/me/erase", headers=H(token), json={"password": PW, "confirm": "ERASE"}).status_code == 200
    assert db.query(models.UserSession).count() == 0
    assert client.get("/api/auth/me", headers=H(token)).status_code == 401


def test_an_unreadable_session_store_fails_closed(client, monkeypatch):
    token = login(client)

    class Broken:
        def begin(self):
            raise RuntimeError("db down")

    monkeypatch.setattr(security, "engine", Broken())
    assert client.get("/api/auth/me", headers=H(token)).status_code == 503
