"""FASE 8.7B — Reports tenant isolation / IDOR and real-data content tests.

Uses an in-memory SQLite engine and overrides the DB + auth dependencies so no
persistent DB is touched. The background PDF task uses SessionLocal (global DB)
and finds no in-memory job, so it returns early without side effects.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.security import get_current_user
from backend.routers import reports

TENANT_A = 1
TENANT_B = 2

USER_A = {"sub": "a@test.com", "tenant_id": TENANT_A, "role": "TENANT_MEMBER"}
USER_B = {"sub": "b@test.com", "tenant_id": TENANT_B, "role": "TENANT_MEMBER"}
SUPER_ADMIN = {"sub": "admin@test.com", "tenant_id": 99, "role": "SUPER_ADMIN"}


@pytest.fixture()
def ctx(monkeypatch):
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

    app.dependency_overrides[reports.get_db] = _get_db
    _set_user(USER_A)

    with TestClient(app) as client:
        yield {
            "client": client,
            "session": TestingSessionLocal,
            "set_user": _set_user,
        }

    app.dependency_overrides.clear()
    engine.dispose()


def _make_job(db, tenant_id, report_type="monthly"):
    j = models.ReportJob(tenant_id=tenant_id, report_type=report_type,
                         period="2025-05", status="pending")
    db.add(j)
    db.flush()
    return j


def _make_site(db, site_id, tenant_id):
    s = models.Site(id=site_id, tenant_id=tenant_id, name=f"Site {site_id}",
                    location="PT", lat=0.0, lng=0.0, solar_kw=100.0, battery_kwh=50.0,
                    ev_chargers=1, owner="owner", status="active")
    db.add(s)
    db.flush()
    return s


# ── 1. Generate: tenant from token, not from client ─────────────────────────
def test_generate_uses_authenticated_tenant(ctx):
    client, Session = ctx["client"], ctx["session"]
    resp = client.post("/api/reports/generate", json={"report_type": "monthly"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["tenant_id"] == TENANT_A
    assert body["requested_by"] == USER_A["sub"]

    db = Session()
    job = db.query(models.ReportJob).filter(models.ReportJob.id == body["id"]).first()
    assert job.tenant_id == TENANT_A
    db.close()


def test_generate_ignores_client_tenant_id_field(ctx):
    client, Session = ctx["client"], ctx["session"]
    # tenant_id is no longer a contract field; if sent it must be ignored.
    resp = client.post("/api/reports/generate", json={"report_type": "monthly", "tenant_id": TENANT_B})
    assert resp.status_code == 201, resp.text
    assert resp.json()["tenant_id"] == TENANT_A
    db = Session()
    assert db.query(models.ReportJob).filter(models.ReportJob.tenant_id == TENANT_A).count() >= 1
    db.close()


# ── 2. List: only own tenant ─────────────────────────────────────────────────
def test_list_only_own_tenant(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_job(db, TENANT_A)
    _make_job(db, TENANT_B)
    db.commit()
    db.close()

    resp = client.get("/api/reports")
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    db = Session()
    b_ids = [j.id for j in db.query(models.ReportJob).filter(models.ReportJob.tenant_id == TENANT_B).all()]
    db.close()
    assert not any(i in b_ids for i in ids)  # tenant B jobs not visible


# ── 3 & 4. GET / DOWNLOAD cross-tenant -> 404 no-leak ───────────────────────
def test_get_cross_tenant_404(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    job_b = _make_job(db, TENANT_B)
    db.commit()
    b_id = job_b.id
    db.close()

    resp = client.get(f"/api/reports/{b_id}")
    assert resp.status_code == 404


def test_download_cross_tenant_404(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    job_b = _make_job(db, TENANT_B)
    db.commit()
    b_id = job_b.id
    db.close()

    resp = client.get(f"/api/reports/{b_id}/download")
    assert resp.status_code == 404

# ── 5. site_ids of another tenant -> blocked ────────────────────────────────
def test_generate_cross_tenant_site_404(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 500, TENANT_B)
    db.commit()
    db.close()

    resp = client.post("/api/reports/generate", json={"report_type": "monthly", "site_ids": [500]})
    assert resp.status_code == 404, resp.text


def test_generate_own_site_works(ctx):
    client, Session = ctx["client"], ctx["session"]
    db = Session()
    _make_site(db, 501, TENANT_A)
    db.commit()
    db.close()

    resp = client.post("/api/reports/generate", json={"report_type": "monthly", "site_ids": [501]})
    assert resp.status_code == 201, resp.text
    job_id = resp.json()["id"]
    db = Session()
    job = db.query(models.ReportJob).filter(models.ReportJob.id == job_id).first()
    assert job.site_ids == [501]
    db.close()


# ── 6. SUPER_ADMIN bypass ───────────────────────────────────────────────────
def test_super_admin_can_read_other_tenant_report(ctx):
    client, Session, set_user = ctx["client"], ctx["session"], ctx["set_user"]
    db = Session()
    job_b = _make_job(db, TENANT_B)
    db.commit()
    b_id = job_b.id
    db.close()

    set_user(SUPER_ADMIN)
    resp = client.get(f"/api/reports/{b_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["tenant_id"] == TENANT_B


# ── 7. Real-data metrics (no random KPIs) ────────────────────────────────────
def test_collect_metrics_uses_real_data():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = Session()
    db.add(models.Tenant(id=1, name="A", slug="a", plan="enterprise", max_sites=999))
    db.flush()
    _make_site(db, 1, 1)  # solar_kw=100, battery_kwh=50
    dev = models.Device(id=1, tenant_id=1, site_id=1, name="Batt", protocol="simulated",
                        device_type="battery", config={}, enabled=True, status="online")
    db.add(dev)
    db.add(models.VPPBid(tenant_id=1, vpp_id=1, market="MIBEL", quantity_kw=10,
                         status="accepted", pnl_eur=10.0))
    db.add(models.Alert(tenant_id=1, device_id=1, severity="critical", title="X", acknowledged=False))
    job = _make_job(db, 1)
    db.commit()

    metrics = reports._collect_metrics(db, job)
    assert metrics["solar_capacity"] == 100.0
    assert metrics["bess_capacity"] == 50.0
    assert metrics["total_devices"] == 1
    assert metrics["online_devices"] == 1
    assert metrics["total_bids"] == 1
    assert metrics["accepted_bids"] == 1
    assert metrics["pnl_eur"] == 10.0
    assert metrics["total_alerts"] == 1
    assert metrics["critical_alerts"] == 1

    html = reports._build_html(metrics, {"report_type": "monthly", "period": "2025-05",
                                        "currency": "EUR", "include_carbon": False, "include_forecast": False})
    assert "100.0 kW" in html
    assert "random" not in html.lower()
    db.close()
    engine.dispose()

