"""A tenant's own API key (Settings > API Keys) can push readings to that tenant's devices, so a customer can
send data from a home hub (e.g. a Homey Flow) without a gateway key. Never to another tenant's device."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models
from backend.database import Base
from backend.main import app
from backend.routers.devices import get_db
from backend.security import generate_api_key, utcnow_naive

TENANT_A = 1
TENANT_B = 2


@pytest.fixture()
def db_session(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr("backend.database.SessionLocal", factory)  # _resolve_api_key opens its own session
    session = factory()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def _device(db, tenant_id):
    dev = models.Device(tenant_id=tenant_id, name="battery", protocol="marstek", device_type="battery",
                        config={}, enabled=True, status="unknown")
    db.add(dev)
    db.commit()
    return dev.id


def _key(db, tenant_id, revoked=False):
    full, prefix, digest = generate_api_key()
    user = models.User(tenant_id=tenant_id, email=f"u{tenant_id}@x.com", password_hash="x", role="TENANT_ADMIN")
    db.add(user)
    db.flush()
    db.add(models.ApiKey(tenant_id=tenant_id, user_id=user.id, name="homey", key_prefix=prefix, key_hash=digest,
                         revoked_at=utcnow_naive() if revoked else None))
    db.commit()
    return full


def _post(client, device_id, key, body=None):
    return client.post(f"/api/devices/{device_id}/ingest", json=body or {"soc_pct": 26.0, "temp_c": 24.0},
                       headers={"Authorization": f"Bearer {key}"})


def test_api_key_ingests_into_its_own_tenants_device(client, db_session):
    device = _device(db_session, TENANT_A)
    resp = _post(client, device, _key(db_session, TENANT_A))
    assert resp.status_code == 201
    reading = db_session.query(models.DeviceReading).filter_by(device_id=device).one()
    assert (reading.tenant_id, reading.soc_pct, reading.temp_c) == (TENANT_A, 26.0, 24.0)


def test_api_key_cannot_ingest_into_another_tenants_device(client, db_session):
    other = _device(db_session, TENANT_B)
    assert _post(client, other, _key(db_session, TENANT_A)).status_code == 403
    assert db_session.query(models.DeviceReading).count() == 0


def test_revoked_or_unknown_api_key_is_refused(client, db_session):
    device = _device(db_session, TENANT_A)
    assert _post(client, device, _key(db_session, TENANT_A, revoked=True)).status_code == 401
    assert _post(client, device, "vos_" + "x" * 43).status_code == 401
    assert db_session.query(models.DeviceReading).count() == 0
