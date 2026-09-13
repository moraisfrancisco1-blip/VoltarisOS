"""Fixes #1 and #4 from the energy-engineering audit, both in the same
ENTSO-E auto-fetch branch of _optimize_persisted_vpp:

#1 - /api/vpp/{id}/optimize and /dispatch/dry-run fetch ENTSO-E prices inline
when the caller doesn't supply its own, but previously never checked how old
that price data was before optimizing/dispatching on it -- unlike the
background rolling-horizon task, which already refused stale forecast
providers via forecasting/health.py.

#4 - the same branch accepted horizon_hours up to 168 (7 days) and silently
reused whatever ENTSO-E returned for the whole window, even though ENTSO-E
only ever publishes real day-ahead prices for the next day or so.

These tests cover only the ENTSO-E branch (no prices_eur_mwh in the request
body); the existing test_vpp_dispatch_endpoint.py already covers the
caller-supplied-prices branch, which neither fix touches.
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers.vpp import get_db
from backend.security import get_current_user


def _setup_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    db.add(models.Site(id=201, tenant_id=1, name="CI Site", solar_kw=0.0))
    vpp = models.VPPGroup(tenant_id=1, name="CI VPP", active=True)
    db.add(vpp)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=201, weight=1.0))
    db.commit()
    vpp_id = vpp.id
    db.close()
    return engine, TestingSessionLocal, vpp_id


class FakeOptimizeResult:
    status = "optimal"
    solver_time_ms = 1.0
    total_cost_eur = 0.0
    total_import_kwh = 0.0
    total_export_kwh = 0.0
    vpp_dispatch = [0.0, 0.0]
    site_dispatch = {"201": [0.0, 0.0]}
    asset_dispatch = {}
    schedule = [{"hour": 0}, {"hour": 1}]


def _run(monkeypatch, tmp_path, vpp_id, TestingSessionLocal, engine, generated_at, max_age_minutes,
         horizon_hours=2, entsoe_should_be_called=True):
    from backend.market import entsoe

    class FakeClient:
        async def get_day_ahead_prices(self, country_code="PT", start=None, end=None):
            if not entsoe_should_be_called:
                raise AssertionError("ENTSO-E must not be called once horizon_hours is already rejected")
            return entsoe.EntsoeResponse(
                success=True,
                data=[entsoe.PricePoint(generated_at, 50.0) for _ in range(horizon_hours)],
                generated_at=generated_at,
                max_age_minutes=max_age_minutes,
            )

    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: FakeClient())
    monkeypatch.setattr(
        "backend.routers.vpp.MultiAssetOptimizer",
        lambda: type("O", (), {"optimize": lambda self, portfolio: FakeOptimizeResult()})(),
    )
    monkeypatch.chdir(tmp_path)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {
        "sub": "1",
        "tenant_id": 1,
        "role": "TENANT_MEMBER",
    }
    try:
        client = TestClient(app)
        return client.post(
            f"/api/vpp/{vpp_id}/optimize",
            json={"horizon_hours": horizon_hours, "base_load_kw": [0.0] * horizon_hours},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()


def test_vpp_optimize_rejects_stale_entsoe_prices(tmp_path, monkeypatch):
    engine, TestingSessionLocal, vpp_id = _setup_db()
    stale = datetime.now(timezone.utc) - timedelta(hours=3)
    response = _run(monkeypatch, tmp_path, vpp_id, TestingSessionLocal, engine, stale, max_age_minutes=120)
    assert response.status_code == 502, response.text
    assert "stale" in response.json()["detail"].lower()


def test_vpp_optimize_accepts_fresh_entsoe_prices(tmp_path, monkeypatch):
    engine, TestingSessionLocal, vpp_id = _setup_db()
    fresh = datetime.now(timezone.utc) - timedelta(minutes=5)
    response = _run(monkeypatch, tmp_path, vpp_id, TestingSessionLocal, engine, fresh, max_age_minutes=120)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "optimal"


def test_vpp_optimize_rejects_long_horizon_without_entsoe_call(tmp_path, monkeypatch):
    engine, TestingSessionLocal, vpp_id = _setup_db()
    fresh = datetime.now(timezone.utc) - timedelta(minutes=5)
    response = _run(
        monkeypatch, tmp_path, vpp_id, TestingSessionLocal, engine, fresh, max_age_minutes=120,
        horizon_hours=72, entsoe_should_be_called=False,
    )
    assert response.status_code == 400, response.text
    assert "prices_eur_mwh" in response.json()["detail"]


def test_vpp_optimize_allows_48h_entsoe_horizon(tmp_path, monkeypatch):
    engine, TestingSessionLocal, vpp_id = _setup_db()
    fresh = datetime.now(timezone.utc) - timedelta(minutes=5)
    response = _run(
        monkeypatch, tmp_path, vpp_id, TestingSessionLocal, engine, fresh, max_age_minutes=120,
        horizon_hours=48,
    )
    assert response.status_code == 200, response.text
