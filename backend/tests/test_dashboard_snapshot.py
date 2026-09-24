"""Tests for backend/dashboard_snapshot.py (shared by /ws/dashboard and
GET /api/dashboard/snapshot) and the REST endpoint itself. Same
in-memory-SQLite + dependency-override pattern as test_savings_rest.py.
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
from backend.dashboard_snapshot import fetch_dashboard_snapshot
from backend.routers import savings as savings_mod
from backend.routers import dashboard_snapshot_api as snapshot_mod

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine)
Base.metadata.create_all(_engine)


def test_fetch_dashboard_snapshot_buckets_solar_and_battery():
    db = _Session()
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    db.add(models.Site(id=1, tenant_id=1, name="Site-1", solar_kw=10.0))
    db.add(models.Device(id=1, tenant_id=1, site_id=1, name="Inverter", device_type="inverter",
                          protocol="simulated", enabled=True))
    db.add(models.Device(id=2, tenant_id=1, site_id=1, name="Battery", device_type="battery",
                          protocol="simulated", enabled=True))
    db.commit()
    now = datetime.utcnow()
    db.add(models.DeviceReading(device_id=1, tenant_id=1, timestamp=now, power_kw=5.0, soc_pct=None))
    db.add(models.DeviceReading(device_id=2, tenant_id=1, timestamp=now, power_kw=2.0, soc_pct=60.0))
    db.commit()

    snapshot = fetch_dashboard_snapshot(db, tenant_id=1)
    db.close()

    assert snapshot["solar_kw"] == 5.0
    assert snapshot["battery_kw"] == 2.0
    assert snapshot["total_power_kw"] == 7.0
    assert snapshot["device_count"] == 2


@pytest.fixture()
def client():
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
    main.app.dependency_overrides[savings_mod.get_db] = _override_db
    main.app.dependency_overrides[snapshot_mod.get_db] = _override_db
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_dashboard_snapshot_endpoint_combines_metrics_and_savings(client):
    db = _Session()
    db.add(models.Site(id=1, tenant_id=1, name="Site-1", solar_kw=10.0))
    db.add(models.Device(id=1, tenant_id=1, site_id=1, name="Inverter", device_type="inverter",
                          protocol="simulated", enabled=True))
    db.commit()
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    db.add(models.DeviceReading(device_id=1, tenant_id=1, timestamp=now, power_kw=3.0))
    db.add(models.DeviceReading(device_id=1, tenant_id=1, timestamp=today_start + timedelta(hours=1),
                                 energy_kwh=15.0))
    db.commit()
    db.close()

    resp = client.get("/api/dashboard/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert data["solar_kw"] == 3.0
    assert "savings" in data
    assert data["savings"]["solar_kwh_today"] == 15.0
    assert data["savings"]["solar_value_is_estimate"] is True


def test_dashboard_snapshot_endpoint_no_devices_yet(client):
    resp = client.get("/api/dashboard/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert data["device_count"] == 0
    assert data["savings"]["total_eur"] == 0.0
