"""Integration tests for the real Carbon overview (tenant isolation, real energy,
deterministic CO2, no random). Uses an in-memory SQLite DB with router-level
dependency overrides so only the carbon endpoints are exercised.
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main
from backend.database import Base
from backend import models
from backend.security import get_current_user
from backend.routers import carbon as carbon_mod

# StaticPool keeps a single in-memory connection so all sessions share the DB.
_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine)
Base.metadata.create_all(_engine)

CO2 = 0.233


@pytest.fixture()
def client():
    # Fresh schema per test.
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    def _override_db():
        db = _Session()
        try:
            yield db
        finally:
            db.close()

    def _auth(tenant_id, role="TENANT_ADMIN"):
        return lambda: {"id": 1, "tenant_id": tenant_id, "role": role}

    main.app.dependency_overrides[get_current_user] = _auth(1)
    main.app.dependency_overrides[carbon_mod.get_db] = _override_db
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _seed_solar(db, tenant_id, site_id, device_id, energy_kwh):
    db.add(models.Site(id=site_id, tenant_id=tenant_id, name=f"Site-{site_id}", solar_kw=10.0))
    db.add(models.Device(id=device_id, tenant_id=tenant_id, site_id=site_id, name=f"Dev-{device_id}",
                         protocol="test", device_type="solar", enabled=True, status="online"))
    now = datetime.utcnow()
    db.add(models.DeviceReading(tenant_id=tenant_id, device_id=device_id, timestamp=now - timedelta(minutes=5),
                                power_kw=10.0, energy_kwh=energy_kwh))
    db.commit()


def test_tenant_a_does_not_see_tenant_b_data(client):
    db = _Session()
    _seed_solar(db, 1, 101, 1001, 100.0)
    _seed_solar(db, 2, 201, 2001, 500.0)
    db.close()

    r = client.get("/api/carbon/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["solar_today_kwh"] == 100.0
    assert body["co2_today_kg"] == round(100.0 * CO2, 1)
    site_names = {s["name"] for s in body["sites"]}
    assert site_names == {"Site-101"}
    assert "Site-201" not in site_names


def test_energy_aggregation_is_real(client):
    db = _Session()
    db.add(models.Site(id=101, tenant_id=1, name="S", solar_kw=10.0))
    db.add(models.Device(id=1001, tenant_id=1, site_id=101, name="D", protocol="test",
                         device_type="solar", enabled=True, status="online"))
    now = datetime.utcnow()
    db.add(models.DeviceReading(tenant_id=1, device_id=1001, timestamp=now - timedelta(minutes=10),
                                energy_kwh=100.0))
    db.add(models.DeviceReading(tenant_id=1, device_id=1001, timestamp=now - timedelta(minutes=5),
                                energy_kwh=50.0))
    db.commit()
    db.close()

    body = client.get("/api/carbon/overview").json()
    assert body["solar_today_kwh"] == 150.0


def test_zero_readings_is_zero_not_random(client):
    body = client.get("/api/carbon/overview").json()
    assert body["solar_today_kwh"] == 0.0
    assert body["co2_today_kg"] == 0.0
    assert body["co2_month_kg"] == 0.0


def test_co2_is_deterministic(client):
    db = _Session()
    _seed_solar(db, 1, 101, 1001, 100.0)
    db.close()

    r1 = client.get("/api/carbon/overview").json()
    r2 = client.get("/api/carbon/overview").json()
    assert r1["co2_today_kg"] == r2["co2_today_kg"] == round(100.0 * CO2, 1)
    assert r1["solar_today_kwh"] == r2["solar_today_kwh"] == 100.0


def test_super_admin_sees_all_tenants(client):
    main.app.dependency_overrides[get_current_user] = lambda: {"id": 9, "tenant_id": None, "role": "SUPER_ADMIN"}
    db = _Session()
    _seed_solar(db, 1, 101, 1001, 100.0)
    _seed_solar(db, 2, 201, 2001, 500.0)
    db.close()

    body = client.get("/api/carbon/overview").json()
    assert body["solar_today_kwh"] == 600.0
