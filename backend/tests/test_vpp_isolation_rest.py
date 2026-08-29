"""REST coverage for VPP and device-readings same-tenant success + cross-tenant denial."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.main import app
from backend.routers.vpp import get_db as vpp_get_db
from backend.routers.devices import get_db as devices_get_db
from backend.security import SECRET_KEY, ALGORITHM

TENANT_A = 1
TENANT_B = 2


def _make_jwt(tenant_id: int, role: str = "TENANT_MEMBER", sub: str = "1") -> str:
    return jwt.encode(
        {"sub": sub, "tenant_id": tenant_id, "role": role},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _auth(tenant_id: int, role: str = "TENANT_MEMBER") -> dict:
    return {"Authorization": f"Bearer {_make_jwt(tenant_id, role=role)}"}


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _vpp_override():
        yield db_session

    def _devices_override():
        yield db_session

    app.dependency_overrides[vpp_get_db] = _vpp_override
    app.dependency_overrides[devices_get_db] = _devices_override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _seed_vpp(db_session, tenant_id: int, name: str = "VPP", active: bool = True) -> int:
    vpp = models.VPPGroup(tenant_id=tenant_id, name=name, market="MIBEL",
                          strategy="peak_shaving", min_bid_kw=100, active=active)
    db_session.add(vpp)
    db_session.commit()
    return vpp.id


def _seed_device(db_session, tenant_id: int, device_id: int) -> None:
    db_session.add(models.Device(
        id=device_id, tenant_id=tenant_id, name="Dev", site_id=1,
        protocol="simulated", device_type="battery", config={},
        enabled=True, status="unknown",
    ))
    db_session.commit()


# ── VPP same-tenant success ─────────────────────────────────────────────────
class TestVppListSameTenant:
    def test_tenant_sees_only_own_vpps(self, client, db_session):
        _seed_vpp(db_session, TENANT_A, name="A1")
        _seed_vpp(db_session, TENANT_B, name="B1")

        resp = client.get("/api/vpp", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        names = {g["name"] for g in resp.json()}
        assert "A1" in names
        assert "B1" not in names


class TestVppCreate:
    def test_create_derives_tenant_from_jwt(self, client, db_session):
        resp = client.post(
            "/api/vpp",
            json={"name": "Created VPP", "market": "MIBEL", "strategy": "peak_shaving"},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["tenant_id"] == TENANT_A
        assert body["name"] == "Created VPP"


class TestVppGetDelete:
    def test_get_same_tenant(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.get(f"/api/vpp/{vpp_id}", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert resp.json()["id"] == vpp_id

    def test_delete_same_tenant(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.delete(f"/api/vpp/{vpp_id}", headers=_auth(TENANT_A))
        assert resp.status_code == 204
        assert db_session.query(models.VPPGroup).filter_by(id=vpp_id).count() == 0


class TestVppAggregate:
    def test_aggregate_same_tenant(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.get(f"/api/vpp/{vpp_id}/aggregate", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = resp.json()
        assert body["vpp_id"] == vpp_id
        assert "total_power_kw" in body


class TestVppOptimize:
    def test_optimize_same_tenant_real_solver(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.post(
            f"/api/vpp/{vpp_id}/optimize",
            json={
                "horizon_hours": 2,
                "prices_eur_mwh": [30.0, 40.0],
                "base_load_kw": [0.0, 0.0],
            },
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["vpp_id"] == vpp_id
        assert "optimization_run_id" in body
        assert "status" in body
        assert "total_cost_eur" in body


class TestVppBid:
    def test_submit_bid_same_tenant(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.post(
            f"/api/vpp/{vpp_id}/bid",
            json={"quantity_kw": 200, "direction": "sell", "price_eur_mwh": 50.0},
            headers=_auth(TENANT_A),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["vpp_id"] == vpp_id
        assert body["status"] == "pending"

    def test_list_bids_same_tenant(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.get(f"/api/vpp/{vpp_id}/bids", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestVppPerformance:
    def test_performance_same_tenant(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.get(f"/api/vpp/{vpp_id}/performance", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        body = resp.json()
        assert "total_bids" in body
        assert "total_pnl_eur" in body


# ── Device readings same-tenant success ──────────────────────────────────────
class TestDeviceReadingsSameTenant:
    def test_readings_same_tenant(self, client, db_session):
        _seed_device(db_session, TENANT_A, device_id=500)
        db_session.add(models.DeviceReading(device_id=500, tenant_id=TENANT_A, power_kw=1.5))
        db_session.commit()

        resp = client.get("/api/devices/500/readings", headers=_auth(TENANT_A))
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["power_kw"] == 1.5


# ── Cross-tenant denial (REST) ───────────────────────────────────────────────
class TestCrossTenantDenial:
    def test_get_vpp_cross_tenant_404(self, client, db_session):
        vpp_id = _seed_vpp(db_session, TENANT_A)
        resp = client.get(f"/api/vpp/{vpp_id}", headers=_auth(TENANT_B))
        assert resp.status_code == 404

    def test_readings_cross_tenant_404(self, client, db_session):
        _seed_device(db_session, TENANT_A, device_id=600)
        resp = client.get("/api/devices/600/readings", headers=_auth(TENANT_B))
        assert resp.status_code == 404