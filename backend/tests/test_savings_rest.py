"""Integration tests for GET /api/savings/today (tenant isolation, real solar
energy + real accepted-bid P&L, no fabricated numbers). Mirrors
test_carbon_integration.py's in-memory-SQLite + dependency-override pattern.
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
from backend.routers import savings as savings_mod
from backend.routers.savings import compute_savings

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine)
Base.metadata.create_all(_engine)


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
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _seed_solar(db, tenant_id, site_id, device_id, energy_kwh, when):
    db.add(models.Site(id=site_id, tenant_id=tenant_id, name=f"Site-{site_id}", solar_kw=10.0))
    db.add(models.Device(id=device_id, tenant_id=tenant_id, site_id=site_id, name="Inverter",
                          device_type="inverter", protocol="simulated", enabled=True))
    db.commit()
    db.add(models.DeviceReading(device_id=device_id, tenant_id=tenant_id, timestamp=when, energy_kwh=energy_kwh))
    db.commit()


def _seed_bid(db, tenant_id, vpp_id, pnl_eur, status, when):
    db.add(models.VPPGroup(id=vpp_id, tenant_id=tenant_id, name=f"VPP-{vpp_id}", market="MIBEL", strategy="peak_shaving"))
    db.commit()
    db.add(models.VPPBid(tenant_id=tenant_id, vpp_id=vpp_id, market="MIBEL", quantity_kw=10.0,
                          direction="sell", status=status, pnl_eur=pnl_eur, submitted_at=when))
    db.commit()


def test_savings_today_combines_real_solar_and_real_pnl(client):
    db = _Session()
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    _seed_solar(db, tenant_id=1, site_id=1, device_id=1, energy_kwh=20.0, when=today_start + timedelta(hours=2))
    _seed_bid(db, tenant_id=1, vpp_id=1, pnl_eur=42.5, status="accepted", when=today_start + timedelta(hours=3))
    # A pending bid must NOT count toward trading_pnl_eur.
    db.add(models.VPPBid(tenant_id=1, vpp_id=1, market="MIBEL", quantity_kw=5.0, direction="sell",
                          status="pending", pnl_eur=999.0, submitted_at=today_start + timedelta(hours=4)))
    db.commit()
    db.close()

    resp = client.get("/api/savings/today")
    assert resp.status_code == 200
    data = resp.json()
    assert data["solar_kwh_today"] == 20.0
    assert data["trading_pnl_eur"] == 42.5
    assert data["solar_value_is_estimate"] is True
    assert data["price_source"] == "simulated"  # no ENTSOE_TOKEN in test env
    assert data["avg_price_eur_kwh"] is not None
    assert data["solar_value_eur"] == round(20.0 * data["avg_price_eur_kwh"], 2)
    assert data["total_eur"] == round(data["solar_value_eur"] + 42.5, 2)


def test_savings_today_tenant_isolation(client):
    db = _Session()
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    _seed_solar(db, tenant_id=2, site_id=2, device_id=2, energy_kwh=99.0, when=today_start + timedelta(hours=1))
    _seed_bid(db, tenant_id=2, vpp_id=2, pnl_eur=500.0, status="accepted", when=today_start + timedelta(hours=1))
    db.close()

    resp = client.get("/api/savings/today")  # authenticated as tenant 1
    assert resp.status_code == 200
    data = resp.json()
    assert data["solar_kwh_today"] == 0.0
    assert data["trading_pnl_eur"] == 0.0


def test_savings_today_no_activity_yet(client):
    resp = client.get("/api/savings/today")
    assert resp.status_code == 200
    data = resp.json()
    assert data["solar_kwh_today"] == 0.0
    assert data["trading_pnl_eur"] == 0.0
    assert data["total_eur"] == 0.0


def test_compute_savings_handles_missing_price():
    result = compute_savings(solar_kwh=10.0, avg_price_eur_kwh=None, trading_pnl_eur=5.0)
    assert result["solar_value_eur"] is None
    assert result["trading_pnl_eur"] == 5.0
    assert result["total_eur"] == 5.0  # missing price never silently treated as zero-value solar shown as real


def test_compute_savings_normal_case():
    result = compute_savings(solar_kwh=10.0, avg_price_eur_kwh=0.15, trading_pnl_eur=-3.0)
    assert result["solar_value_eur"] == 1.5
    assert result["trading_pnl_eur"] == -3.0
    assert result["total_eur"] == -1.5
