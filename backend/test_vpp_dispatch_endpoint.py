from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers.vpp import get_db


def test_vpp_dispatch_dry_run_endpoint():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    vpp = models.VPPGroup(tenant_id=1, name="CI VPP", active=True)
    db.add(vpp)
    db.flush()

    site = models.Site(tenant_id=1, name="CI Site")
    db.add(site)
    db.flush()

    db.add(models.VPPSiteMembership(vpp_id=vpp.id, site_id=site.id, weight=1.0))
    db.add(models.Device(
        site_id=site.id,
        name="CI Battery",
        device_type="battery",
        config={"max_charge_kw": 50, "max_discharge_kw": 40},
    ))
    db.commit()
    vpp_id = vpp.id
    db.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        client = TestClient(app)
        response = client.post(
            f"/api/vpp/{vpp_id}/dispatch/dry-run",
            json={"asset_dispatch": {"device-1": [60, -70, 10]}},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["mode"] == "dry_run"
        assert payload["executed"] is False
        assert payload["physical_control"] == "not_connected"
        assert [s["power_kw"] for s in payload["setpoints"]] == [40.0, -50.0, 10.0]
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()
