"""
Tests for GET /api/sites/telemetry-coverage

Covers:
- authenticated tenant access
- tenant isolation (normal users only see their own tenant)
- empty telemetry history
- telemetry history with readings
- correct first_reading / last_reading / readings_count
- SUPER_ADMIN can query another tenant via ?tenant_id=
- unauthenticated request returns 401
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.main import app
from backend.routers.sites import get_db
from backend.security import get_current_user

TEST_TENANT_A = 1
TEST_TENANT_B = 2

TEST_USER_A = {
    "sub": "1",
    "tenant_id": TEST_TENANT_A,
    "role": "TENANT_MEMBER",
    "email": "user-a@test.com",
}

TEST_USER_B = {
    "sub": "2",
    "tenant_id": TEST_TENANT_B,
    "role": "TENANT_MEMBER",
    "email": "user-b@test.com",
}

TEST_SUPER_ADMIN = {
    "sub": "99",
    "tenant_id": 99,
    "role": "SUPER_ADMIN",
    "email": "admin@test.com",
}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    user_holder = {"user": TEST_USER_A}

    def _override_get_current_user():
        return user_holder["user"]

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    with TestClient(app) as c:
        c._user_holder = user_holder
        yield c

    app.dependency_overrides.clear()


def _seed_readings(db_session, tenant_id, count, start_time):
    for i in range(count):
        r = models.DeviceReading(
            tenant_id=tenant_id,
            # device_id is a global PK; a device belongs to exactly one tenant, so
            # each tenant seeds its own device (idempotency enforces unique
            # (device_id, timestamp) pairs).
            device_id=tenant_id,
            timestamp=start_time + timedelta(hours=i),
            power_kw=1.0 + i * 0.1,
        )
        db_session.add(r)
    db_session.commit()


class TestTelemetryCoverageAuth:
    def test_unauthenticated_returns_401(self, db_session):
        app.dependency_overrides.clear()

        def _override_get_db():
            try:
                yield db_session
            finally:
                pass

        app.dependency_overrides[get_db] = _override_get_db

        with TestClient(app) as c:
            resp = c.get("/api/sites/telemetry-coverage")
            assert resp.status_code == 401

        app.dependency_overrides.clear()


class TestTelemetryCoverageTenantIsolation:
    def test_tenant_a_sees_only_own_data(self, client, db_session):
        _seed_readings(db_session, TEST_TENANT_A, 5, datetime(2025, 6, 1, 10, 0, 0))
        _seed_readings(db_session, TEST_TENANT_B, 3, datetime(2025, 6, 1, 12, 0, 0))

        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == TEST_TENANT_A
        assert data["readings_count"] == 5

    def test_tenant_b_sees_only_own_data(self, client, db_session):
        _seed_readings(db_session, TEST_TENANT_A, 5, datetime(2025, 6, 1, 10, 0, 0))
        _seed_readings(db_session, TEST_TENANT_B, 3, datetime(2025, 6, 1, 12, 0, 0))

        client._user_holder["user"] = TEST_USER_B
        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == TEST_TENANT_B
        assert data["readings_count"] == 3


class TestTelemetryCoverageEmpty:
    def test_empty_telemetry_returns_zeros(self, client, db_session):
        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == TEST_TENANT_A
        assert data["readings_count"] == 0
        assert data["first_reading"] is None
        assert data["last_reading"] is None


class TestTelemetryCoverageWithData:
    def test_readings_count(self, client, db_session):
        _seed_readings(db_session, TEST_TENANT_A, 10, datetime(2025, 6, 1, 0, 0, 0))
        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        assert resp.json()["readings_count"] == 10

    def test_first_reading(self, client, db_session):
        start = datetime(2025, 6, 1, 8, 30, 0)
        _seed_readings(db_session, TEST_TENANT_A, 3, start)
        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        first = resp.json()["first_reading"]
        assert first is not None
        assert first.startswith("2025-06-01T08:30:00")

    def test_last_reading(self, client, db_session):
        start = datetime(2025, 6, 1, 8, 30, 0)
        _seed_readings(db_session, TEST_TENANT_A, 3, start)
        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        last = resp.json()["last_reading"]
        assert last is not None
        assert last.startswith("2025-06-01T10:30:00")

    def test_single_reading_first_equals_last(self, client, db_session):
        ts = datetime(2025, 7, 15, 14, 0, 0)
        _seed_readings(db_session, TEST_TENANT_A, 1, ts)
        resp = client.get("/api/sites/telemetry-coverage")
        data = resp.json()
        assert data["readings_count"] == 1
        assert data["first_reading"] == data["last_reading"]
        assert data["first_reading"].startswith("2025-07-15T14:00:00")


class TestTelemetryCoverageSuperAdmin:
    def test_super_admin_default_own_tenant(self, client, db_session):
        _seed_readings(db_session, 99, 4, datetime(2025, 6, 1, 0, 0, 0))
        client._user_holder["user"] = TEST_SUPER_ADMIN
        resp = client.get("/api/sites/telemetry-coverage")
        assert resp.status_code == 200
        assert resp.json()["tenant_id"] == 99
        assert resp.json()["readings_count"] == 4

    def test_super_admin_query_other_tenant(self, client, db_session):
        _seed_readings(db_session, TEST_TENANT_A, 7, datetime(2025, 6, 1, 0, 0, 0))
        client._user_holder["user"] = TEST_SUPER_ADMIN
        resp = client.get(f"/api/sites/telemetry-coverage?tenant_id={TEST_TENANT_A}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == TEST_TENANT_A
        assert data["readings_count"] == 7

    def test_normal_user_cannot_query_other_tenant(self, client, db_session):
        _seed_readings(db_session, TEST_TENANT_B, 3, datetime(2025, 6, 1, 0, 0, 0))
        resp = client.get(f"/api/sites/telemetry-coverage?tenant_id={TEST_TENANT_B}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["tenant_id"] == TEST_TENANT_A
        assert data["readings_count"] == 0