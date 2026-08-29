"""E2E for the equipment adapter foundation + normalized ingest contract.

GenericEquipmentAdapter -> NormalizedReading -> ingest_adapter_payload -> the
existing ingest pipeline (validation, tenant isolation, idempotency, persistence,
alerts, carbon). No manufacturer is emulated.
"""
import json
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.main as main
from backend.database import Base
from backend import models
from backend.security import get_current_user
from backend.routers import devices as devices_mod
from backend.routers import carbon as carbon_mod
from backend.routers import maintenance as maint_mod
from backend.routers import alerts_ws as alerts_mod
from backend.equipment import (
    GenericEquipmentAdapter,
    NormalizationError,
    ingest_adapter_payload,
)

_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(bind=_engine)
Base.metadata.create_all(_engine)


@pytest.fixture()
def ctx():
    Base.metadata.drop_all(_engine)
    Base.metadata.create_all(_engine)

    def _override_db():
        db = _Session()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[devices_mod.get_db] = _override_db
    main.app.dependency_overrides[carbon_mod.get_db] = _override_db
    main.app.dependency_overrides[maint_mod.get_db] = _override_db
    main.app.dependency_overrides[alerts_mod.get_db] = _override_db
    main.app.dependency_overrides[get_current_user] = lambda: {"id": 1, "tenant_id": 1, "role": "TENANT_ADMIN"}

    db = _Session()
    db.add(models.Tenant(id=1, name="T1", slug="t1", plan="enterprise"))
    db.add(models.Tenant(id=2, name="T2", slug="t2", plan="enterprise"))
    db.commit()
    db.close()

    client = TestClient(main.app)
    yield client
    main.app.dependency_overrides.clear()


def _add_device(tenant_id, device_id, external_id, site_id=1):
    db = _Session()
    if not db.query(models.Site).filter_by(id=site_id).first():
        db.add(models.Site(id=site_id, tenant_id=tenant_id, name="S", solar_kw=0.0))
    db.add(models.Device(id=device_id, tenant_id=tenant_id, site_id=site_id, name=f"D{device_id}",
                         protocol="test", device_type="inverter", external_id=external_id,
                         enabled=True, status="unknown"))
    db.commit()
    db.close()


def _now_ts():
    return (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()


def _ingest(payload, tenant_id):
    db = _Session()
    try:
        return ingest_adapter_payload(
            GenericEquipmentAdapter(),
            payload,
            {"sub": "gateway", "role": "GATEWAY", "tenant_id": tenant_id},
            db,
        )
    finally:
        db.close()


def test_adapter_normalizes_valid_payload():
    adapter = GenericEquipmentAdapter()
    nrs = adapter.normalize({
        "external_id": "SN-1", "timestamp": _now_ts(),
        "power_kw": 120.0, "energy_kwh": 0.5, "energy_mode": "interval_delta",
        "soc_pct": 55.0, "raw": {"serial": "SN-1"},
    })
    assert len(nrs) == 1
    nr = nrs[0]
    assert nr.external_id == "SN-1"
    assert nr.power_kw == 120.0
    assert nr.energy_kwh == 0.5
    assert nr.energy_mode == "interval_delta"
    assert nr.soc_pct == 55.0


def test_adapter_rejects_invalid_payload():
    adapter = GenericEquipmentAdapter()
    with pytest.raises(NormalizationError):
        adapter.normalize({})  # missing external_id/device_id
    with pytest.raises(NormalizationError):
        adapter.normalize({"external_id": "X", "energy_mode": "cumulative_total"})
    with pytest.raises(NormalizationError):
        adapter.normalize({"external_id": "X", "energy_mode": "unknown_mode"})
    with pytest.raises(NormalizationError):
        adapter.normalize({"external_id": "X", "power_kw": -5.0})
    with pytest.raises(NormalizationError):
        adapter.normalize("not-a-dict")
    with pytest.raises(NormalizationError):
        adapter.normalize({"external_id": "X", "bogus_field": 1})


def test_ingest_persists_and_device_online(ctx):
    _add_device(1, 1001, "SN-1001")
    r = _ingest({"external_id": "SN-1001", "timestamp": _now_ts(), "power_kw": 120.0, "energy_kwh": 0.5}, 1)
    assert r.accepted == 1
    db = _Session()
    dev = db.query(models.Device).filter_by(id=1001).first()
    assert dev.status == "online"
    assert db.query(models.DeviceReading).filter_by(device_id=1001).count() == 1
    db.close()


def test_retry_is_idempotent(ctx):
    _add_device(1, 1002, "SN-1002")
    payload = {"external_id": "SN-1002", "timestamp": _now_ts(), "power_kw": 10.0, "energy_kwh": 0.2}
    r1 = _ingest(payload, 1)
    assert r1.accepted == 1
    r2 = _ingest(payload, 1)
    assert r2.duplicated == 1
    db = _Session()
    assert db.query(models.DeviceReading).filter_by(device_id=1002).count() == 1
    db.close()


def test_external_id_cross_tenant_rejected(ctx):
    _add_device(2, 2001, "SN-B")
    payload = {"external_id": "SN-B", "timestamp": _now_ts(), "power_kw": 10.0, "energy_kwh": 0.2}
    r = _ingest(payload, 1)  # tenant 1 gateway tries tenant 2's device
    assert r.accepted == 0
    assert r.rejected == 1
    r2 = _ingest(payload, 2)  # tenant 2 gateway can ingest its own
    assert r2.accepted == 1


def test_carbon_receives_normalized_energy(ctx):
    _add_device(1, 1003, "SN-1003")
    _ingest({"external_id": "SN-1003", "timestamp": _now_ts(), "power_kw": 120.0, "energy_kwh": 0.5}, 1)
    body = ctx.get("/api/carbon/overview").json()
    assert body["solar_today_kwh"] == 0.5


def test_alerts_still_fire(ctx):
    _add_device(1, 1004, "SN-1004")
    db = _Session()
    db.add(models.AlertRule(tenant_id=1, name="hot", metric="temp_c", operator="gt",
                            threshold=45.0, severity="warning", enabled=True))
    db.commit()
    db.close()
    _ingest({"external_id": "SN-1004", "timestamp": _now_ts(), "power_kw": 10.0, "temp_c": 50.0}, 1)
    db = _Session()
    assert db.query(models.Alert).filter_by(device_id=1004, metric="temp_c", acknowledged=False).count() == 1
    db.close()


def test_raw_payload_no_secrets(ctx):
    _add_device(1, 1005, "SN-1005")
    _ingest({"external_id": "SN-1005", "timestamp": _now_ts(), "power_kw": 10.0, "energy_kwh": 0.2,
             "raw": {"api_key": "hunter2", "serial": "SN-1005", "nested": {"token": "abc"}}}, 1)
    db = _Session()
    reading = db.query(models.DeviceReading).filter_by(device_id=1005).first()
    raw = reading.raw
    db.close()
    blob = json.dumps(raw)
    assert "hunter2" not in blob
    assert "abc" not in blob
    assert "***REDACTED***" in blob

