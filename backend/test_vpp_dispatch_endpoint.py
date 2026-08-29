from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers.vpp import get_db
from backend.security import get_current_user


def test_vpp_dispatch_dry_run_endpoint(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    db.add(models.Site(id=101, tenant_id=1, name="CI Site", solar_kw=0.0))
    vpp = models.VPPGroup(tenant_id=1, name="CI VPP", active=True)
    db.add(vpp)
    db.flush()

    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=101, weight=1.0))
    db.add(models.Device(
        site_id=101,
        tenant_id=1,  # real API-created devices always carry a tenant
        name="CI Battery",
        protocol="simulated",
        device_type="battery",
        config={"max_charge_kw": 50, "max_discharge_kw": 40},
    ))
    db.commit()
    vpp_id = vpp.id
    device_id = db.query(models.Device).filter(models.Device.site_id == 101).one().id
    db.close()

    asset_id = f"device-{device_id}"

    class FakeResult:
        status = "optimal"
        solver_time_ms = 1.0
        total_cost_eur = 0.0
        total_import_kwh = 0.0
        total_export_kwh = 0.0
        vpp_dispatch = [0.0, 0.0]
        site_dispatch = {"101": [0.0, 0.0]}
        asset_dispatch = {asset_id: [60.0, -70.0, 10.0]}
        schedule = [{"hour": 0}, {"hour": 1}]

    # Keep the test hermetic: stub only the MILP solver. The real asset mapper and
    # dispatch executor still run, so Site + membership + device are exercised.
    monkeypatch.setattr(
        "backend.routers.vpp.MultiAssetOptimizer",
        lambda: type("O", (), {"optimize": lambda self, portfolio: FakeResult()})(),
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
        response = client.post(
            f"/api/vpp/{vpp_id}/dispatch/dry-run",
            json={
                "horizon_hours": 2,
                "prices_eur_mwh": [10.0, 20.0],
                "base_load_kw": [0.0, 0.0],
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["status"] == "optimal"

        execution = payload["execution"]
        assert execution["mode"] == "dry_run"
        assert execution["executed"] is False
        assert execution["physical_control"] == "not_connected"
        assert [s["power_kw"] for s in execution["setpoints"]] == [40.0, -50.0, 10.0]
        assert [s["action"] for s in execution["setpoints"]] == ["discharge", "charge", "discharge"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        engine.dispose()
