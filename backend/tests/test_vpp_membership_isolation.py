"""FASE 8.5B — VPP membership integrity, device<->site tenant isolation and
defense-in-depth for aggregate/dispatch. Uses an in-memory SQLite engine and
overrides the DB + auth dependencies so no persistent DB is touched."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.security import get_current_user
from backend.routers import vpp as vpp_router
from backend.routers import devices as devices_router
from backend.routers import sites as sites_router

TENANT_A = 1
TENANT_B = 2

USER_A = {"sub": "a@test.com", "tenant_id": TENANT_A, "role": "TENANT_MEMBER"}
USER_B = {"sub": "b@test.com", "tenant_id": TENANT_B, "role": "TENANT_MEMBER"}
SUPER_ADMIN = {"sub": "admin@test.com", "tenant_id": 99, "role": "SUPER_ADMIN"}


@pytest.fixture()
def ctx(monkeypatch):
    """In-memory DB + TestClient with tenant A as the authenticated user."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    db = TestingSessionLocal()
    db.add_all([
        models.Tenant(id=TENANT_A, name="Tenant A", slug="tenant-a", plan="enterprise", max_sites=999),
        models.Tenant(id=TENANT_B, name="Tenant B", slug="tenant-b", plan="enterprise", max_sites=999),
    ])
    db.commit()
    db.close()

    def _get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def _set_user(user):
        app.dependency_overrides[get_current_user] = lambda: user

    for get_db in (vpp_router.get_db, devices_router.get_db, sites_router.get_db):
        app.dependency_overrides[get_db] = _get_db

    _set_user(USER_A)

    with TestClient(app) as client:
        yield {
            "client": client,
            "session": TestingSessionLocal,
            "set_user": _set_user,
        }

    app.dependency_overrides.clear()
    engine.dispose()


def _make_site(db, site_id, tenant_id):
    s = models.Site(id=site_id, tenant_id=tenant_id, name=f"Site {site_id}",
                    location="PT", lat=0.0, lng=0.0, solar_kw=0.0, battery_kwh=0.0,
                    ev_chargers=0, owner="owner", status="active")
    db.add(s)
    return s


def _make_vpp(db, tenant_id, name="VPP"):
    v = models.VPPGroup(tenant_id=tenant_id, name=name, active=True)
    db.add(v)
    db.flush()
    return v


def _make_device(db, device_id, tenant_id, site_id, device_type="inverter",
                 config=None):
    d = models.Device(id=device_id, tenant_id=tenant_id, site_id=site_id,
                      name=f"Device {device_id}", protocol="simulated",
                      device_type=device_type, config=config or {},
                      enabled=True)
    db.add(d)
    db.flush()
    return d


# ─── VPP membership ─────────────────────────────────────────────────────────
def test_add_site_cross_tenant_404(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 1, TENANT_A)
    _make_site(db, 2, TENANT_B)
    vpp = _make_vpp(db, TENANT_A)
    db.commit()
    vpp_id = vpp.id
    db.close()

    resp = client.post(f"/api/vpp/{vpp_id}/sites", json={"site_id": 2, "weight": 1.0})
    assert resp.status_code == 404, resp.text
    db = Session()
    assert db.query(models.VPPSiteMembership).filter_by(site_id=2).count() == 0
    db.close()


def test_add_site_own_tenant_works(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 10, TENANT_A)
    vpp = _make_vpp(db, TENANT_A)
    db.commit()
    vpp_id = vpp.id
    db.close()

    resp = client.post(f"/api/vpp/{vpp_id}/sites", json={"site_id": 10, "weight": 1.0})
    assert resp.status_code == 200, resp.text
    db = Session()
    assert db.query(models.VPPSiteMembership).filter_by(vpp_id=vpp_id, site_id=10).count() == 1
    db.close()


def test_add_site_duplicate_membership_ok(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 20, TENANT_A)
    vpp = _make_vpp(db, TENANT_A)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=20, weight=1.0))
    db.commit()
    vpp_id = vpp.id
    db.close()

    resp = client.post(f"/api/vpp/{vpp_id}/sites", json={"site_id": 20, "weight": 2.0})
    assert resp.status_code == 200, resp.text
    db = Session()
    assert db.query(models.VPPSiteMembership).filter_by(vpp_id=vpp_id, site_id=20).count() == 1
    db.close()


def test_add_site_super_admin_cross_tenant_ok(ctx):
    client, Session, set_user = ctx["client"], ctx["session"], ctx["set_user"]
    db = Session()
    _make_site(db, 30, TENANT_B)
    vpp = _make_vpp(db, TENANT_A)
    db.commit()
    vpp_id = vpp.id
    db.close()

    set_user(SUPER_ADMIN)
    resp = client.post(f"/api/vpp/{vpp_id}/sites", json={"site_id": 30, "weight": 1.0})
    assert resp.status_code == 200, resp.text
    db = Session()
    assert db.query(models.VPPSiteMembership).filter_by(vpp_id=vpp_id, site_id=30).count() == 1
    db.close()


# ─── Device <-> Site ────────────────────────────────────────────────────────
def test_create_device_cross_tenant_site_404(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 40, TENANT_B)
    db.commit()
    db.close()

    resp = client.post("/api/devices", json={
        "name": "Bad", "site_id": 40, "protocol": "simulated",
    })
    assert resp.status_code == 404, resp.text
    db = Session()
    assert db.query(models.Device).count() == 0
    db.close()


def test_create_device_own_site_works(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 50, TENANT_A)
    db.commit()
    db.close()

    resp = client.post("/api/devices", json={
        "name": "Good", "site_id": 50, "protocol": "simulated",
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["site_id"] == 50


def test_create_device_without_site_works(ctx):
    client = ctx["client"]
    resp = client.post("/api/devices", json={
        "name": "Standalone", "protocol": "simulated",
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["site_id"] is None


# ─── Defense-in-depth: aggregate ────────────────────────────────────────────
def test_aggregate_excludes_foreign_tenant_device(ctx):
    """Inconsistent data injected directly in DB: a foreign-tenant device on a
    site that belongs to the caller's VPP must NOT contribute to the aggregate."""
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 100, TENANT_A)
    vpp = _make_vpp(db, TENANT_A)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=100, weight=1.0))
    legit = _make_device(db, 1, TENANT_A, 100, device_type="inverter")
    foreign = _make_device(db, 2, TENANT_B, 100, device_type="inverter")  # inconsistent
    db.add(models.DeviceReading(device_id=legit.id, tenant_id=TENANT_A, power_kw=5.0))
    db.add(models.DeviceReading(device_id=foreign.id, tenant_id=TENANT_B, power_kw=99.0))
    db.commit()
    vpp_id = vpp.id
    db.close()

    resp = client.get(f"/api/vpp/{vpp_id}/aggregate")
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["total_power_kw"] == 5.0  # 99.0 (foreign) excluded
    assert payload["sites"][0]["power_kw"] == 5.0


# ─── Defense-in-depth: dispatch/dry-run ─────────────────────────────────────
def test_dispatch_dry_run_excludes_foreign_tenant_device(ctx, monkeypatch):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 101, TENANT_A)
    vpp = _make_vpp(db, TENANT_A)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=101, weight=1.0))
    battery_cfg = {"max_charge_kw": 50.0, "max_discharge_kw": 40.0}
    legit = _make_device(db, 11, TENANT_A, 101, device_type="battery", config=battery_cfg)
    foreign = _make_device(db, 12, TENANT_B, 101, device_type="battery", config=battery_cfg)
    db.commit()
    vpp_id = vpp.id
    legit_id, foreign_id = legit.id, foreign.id
    db.close()

    class FakeResult:
        status = "optimal"
        solver_time_ms = 1.0
        total_cost_eur = 0.0
        total_import_kwh = 0.0
        total_export_kwh = 0.0
        vpp_dispatch = [10.0]
        site_dispatch = {"101": [10.0]}
        asset_dispatch = {f"device-{legit_id}": [40.0], f"device-{foreign_id}": [-50.0]}
        schedule = [{"hour": 0}]

    monkeypatch.setattr(
        "backend.routers.vpp.MultiAssetOptimizer",
        lambda: type("O", (), {"optimize": lambda self, portfolio: FakeResult()})(),
    )

    resp = client.post(
        f"/api/vpp/{vpp_id}/dispatch/dry-run",
        json={"horizon_hours": 1, "prices_eur_mwh": [10.0], "base_load_kw": [0.0]},
    )
    assert resp.status_code == 200, resp.text
    setpoints = resp.json()["execution"]["setpoints"]
    setpoint_device_ids = {sp["device_id"] for sp in setpoints}
    assert foreign_id not in setpoint_device_ids  # foreign device never used
    assert legit_id in setpoint_device_ids         # own device dispatched


# ─── Delete site cleans memberships ─────────────────────────────────────────
def test_delete_site_removes_vpp_memberships(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 60, TENANT_A)
    vpp = _make_vpp(db, TENANT_A)
    db.flush()
    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=60, weight=1.0))
    db.commit()
    db.close()

    resp = client.delete("/api/sites/60")
    assert resp.status_code == 200, resp.text
    db = Session()
    assert db.query(models.VPPSiteMembership).filter_by(site_id=60).count() == 0
    assert db.query(models.Site).filter_by(id=60).count() == 0
    db.close()
