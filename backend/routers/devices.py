"""
/api/devices  — CRUD + connection test + readings + batch ingest
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, Any, Dict, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.database import SessionLocal
from backend import models
from backend.schemas import (
    DeviceReadingBatchRequest,
    DeviceReadingBatchResponse,
    DeviceReadingBatchItem,
)
from backend.audit import log_audit_event
from backend.security import get_current_user, require_ingest_identity
from backend.routers.alerts_ws import evaluate_rules_sync

router = APIRouter(prefix="/api/devices", tags=["devices"])
# Ingestion routes live on a separate router that is NOT wrapped by the global
# get_current_user dependency in main.py. They accept either a logged-in user
# JWT or a tenant-scoped gateway key (see require_ingest_identity in security.py).
ingest_router = APIRouter(prefix="/api/devices", tags=["ingestion"])


# ── Dependency ──────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Device config sanitization ───────────────────────────────────────────────
_SENSITIVE_CONFIG_KEYS = {
    "api_key", "apikey", "token", "access_token", "refresh_token",
    "password", "secret", "client_secret", "authorization", "bearer",
    "credentials", "mqtt_password", "mqtt_username",
}


def _sanitize_config(config):
    """Return a deep copy of `config` with sensitive keys masked.

    Never mutates the original object. Handles nested dicts and lists of dicts.
    Keys are matched case-insensitively against `_SENSITIVE_CONFIG_KEYS`.
    """
    if isinstance(config, dict):
        result = {}
        for key, value in config.items():
            if str(key).lower() in _SENSITIVE_CONFIG_KEYS:
                result[key] = "***"
            else:
                result[key] = _sanitize_config(value)
        return result
    if isinstance(config, list):
        return [_sanitize_config(item) for item in config]
    return config


# ── Schemas ──────────────────────────────────────────────────────────────────
class DeviceCreate(BaseModel):
    name: str
    site_id: Optional[int] = None
    protocol: str          # solaredge | fronius | huawei | sma | modbus_tcp | modbus_rtu | opcua
    device_type: str = "inverter"
    external_id: Optional[str] = None  # physical serial/external identifier (unique per tenant)
    config: Dict[str, Any] = {}
    enabled: bool = True


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None
    external_id: Optional[str] = None


class DeviceOut(BaseModel):
    id: int
    name: str
    site_id: Optional[int]
    protocol: str
    device_type: str
    external_id: Optional[str] = None
    config: Dict[str, Any]
    enabled: bool
    status: str
    last_seen: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("config")
    @classmethod
    def sanitize_config(cls, config: Dict[str, Any]) -> Dict[str, Any]:
        return _sanitize_config(config)


class ReadingOut(BaseModel):
    id: int
    device_id: int
    timestamp: datetime
    power_kw: Optional[float]
    energy_kwh: Optional[float]
    soc_pct: Optional[float]
    temp_c: Optional[float]
    voltage_v: Optional[float]
    current_a: Optional[float]
    frequency_hz: Optional[float]

    model_config = ConfigDict(from_attributes=True)


# ── Routes ────────────────────────────────────────────────────────────────────
def _get_owned_device(db: Session, device_id: int, user: dict) -> models.Device:
    """Return a device visible to `user`, or 404. SUPER_ADMIN sees all devices;
    everyone else is restricted to their own tenant (no cross-tenant existence leak)."""
    q = db.query(models.Device).filter(models.Device.id == device_id)
    if user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.Device.tenant_id == user.get("tenant_id"))
    dev = q.first()
    if not dev:
        raise HTTPException(404, "Device not found")
    return dev


@router.get("", response_model=List[DeviceOut])
def list_devices(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    q = db.query(models.Device)
    if user.get("role") != "SUPER_ADMIN":
        q = q.filter(models.Device.tenant_id == user.get("tenant_id"))
    return q.all()


@router.post("", response_model=DeviceOut, status_code=201)
def create_device(
    body: DeviceCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Validate the site (if provided) exists and belongs to the effective tenant.
    # SUPER_ADMIN bypasses the tenant filter; normal users cannot attach a device
    # to a site of another tenant (404 no-leak).
    if body.site_id is not None:
        q = db.query(models.Site).filter(models.Site.id == body.site_id)
        if user.get("role") != "SUPER_ADMIN":
            q = q.filter(models.Site.tenant_id == user.get("tenant_id"))
        if not q.first():
            raise HTTPException(404, "Site not found")

    dev = models.Device(**body.model_dump())
    # Tenant isolation: a device is always created under the authenticated
    # user's tenant. `tenant_id` is not part of DeviceCreate, so a client
    # cannot supply its own — any extra `tenant_id` in the payload is ignored
    # by Pydantic and never reaches the model.
    dev.tenant_id = user.get("tenant_id")
    if dev.external_id:
        dup = db.query(models.Device).filter(
            models.Device.tenant_id == dev.tenant_id,
            models.Device.external_id == dev.external_id,
        ).first()
        if dup:
            raise HTTPException(409, "external_id already exists in this tenant")
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    return _get_owned_device(db, device_id, user)


@router.put("/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: int,
    body: DeviceUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    dev = _get_owned_device(db, device_id, user)
    # DeviceUpdate only exposes name/config/enabled — tenant_id (and any other
    # unblessed field) is stripped by Pydantic, so a device can never be
    # reassigned to another tenant through this endpoint.
    data = body.model_dump(exclude_none=True)
    if data.get("external_id"):
        dup = db.query(models.Device).filter(
            models.Device.tenant_id == dev.tenant_id,
            models.Device.external_id == data["external_id"],
            models.Device.id != dev.id,
        ).first()
        if dup:
            raise HTTPException(409, "external_id already exists in this tenant")
    for field, val in data.items():
        setattr(dev, field, val)
    db.commit()
    db.refresh(dev)
    return dev


@router.delete("/{device_id}", status_code=204)
def delete_device(device_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    dev = _get_owned_device(db, device_id, user)
    db.delete(dev)
    db.commit()


@router.post("/{device_id}/test")
async def test_connection(device_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Quick connectivity check — does NOT store readings."""
    dev = _get_owned_device(db, device_id, user)

    result = await _run_test(dev.protocol, dev.config)

    dev.status = "online" if result["ok"] else "error"
    dev.last_seen = models.utcnow_naive() if result["ok"] else dev.last_seen
    db.commit()
    return result


@router.get("/{device_id}/readings", response_model=List[ReadingOut])
def get_readings(device_id: int, limit: int = 50, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    _get_owned_device(db, device_id, user)
    return (
        db.query(models.DeviceReading)
        .filter(models.DeviceReading.device_id == device_id)
        .order_by(models.DeviceReading.timestamp.desc())
        .limit(limit)
        .all()
    )


@ingest_router.post("/{device_id}/ingest", status_code=201)
def ingest_reading(
    device_id: int,
    reading: dict,
    db: Session = Depends(get_db),
    identity: dict = Depends(require_ingest_identity),
):
    """Used by the Edge Gateway to push a normalised reading.

    Tenant isolation: the tenant is derived from the authenticated identity
    (a JWT user or a tenant-scoped gateway key). Any `tenant_id` supplied in
    the reading payload is ignored — the reading is always assigned to the
    device's own tenant, and the device must belong to the authenticated tenant.
    """
    dev = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not dev:
        raise HTTPException(404, "Device not found")

    if reading.get("energy_mode") == "cumulative_total":
        raise HTTPException(422, "energy_mode='cumulative_total' is not supported; convert cumulative energy to interval delta before sending")

    identity_tenant = identity.get("tenant_id")
    role = identity.get("role", "")

    # SUPER_ADMIN bypasses tenant scoping; everyone else must match the device.
    if role != "SUPER_ADMIN":
        if identity_tenant is None or dev.tenant_id != identity_tenant:
            raise HTTPException(403, "Device does not belong to the authenticated tenant")

    ts = _to_naive_utc(reading.get("timestamp")) or models.utcnow_naive()
    existing = db.query(models.DeviceReading.id).filter(
        models.DeviceReading.device_id == device_id,
        models.DeviceReading.timestamp == ts,
    ).first()
    if existing:
        return {"ok": True, "id": existing.id, "duplicated": True}

    r = models.DeviceReading(
        device_id=device_id,
        tenant_id=dev.tenant_id,  # derived from device, never from payload
        timestamp=ts,
        power_kw=reading.get("power_kw"),
        energy_kwh=reading.get("energy_kwh"),
        soc_pct=reading.get("soc_pct"),
        temp_c=reading.get("temp_c"),
        voltage_v=reading.get("voltage_v"),
        current_a=reading.get("current_a"),
        frequency_hz=reading.get("frequency_hz"),
        raw=reading.get("raw"),
    )
    db.add(r)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        dup = db.query(models.DeviceReading.id).filter(
            models.DeviceReading.device_id == device_id,
            models.DeviceReading.timestamp == ts,
        ).first()
        return {"ok": True, "id": (dup.id if dup else None), "duplicated": True}

    # Fresh reading persisted — advance the normal flow.
    dev.status = "online"
    dev.last_seen = models.utcnow_naive()
    _resolve_communication_alerts(db, dev)
    db.commit()
    try:
        evaluate_rules_sync(dev.tenant_id, dev.id, dev.name, {
            k: reading.get(k) for k in ("power_kw", "energy_kwh", "soc_pct", "temp_c", "voltage_v", "current_a", "frequency_hz")
        }, db)
    except Exception:
        pass  # non-critical: alert evaluation must not fail the persisted reading
    return {"ok": True, "id": r.id, "duplicated": False}


# ── Batch Ingest Endpoint ─────────────────────────────────────────────────────

def _to_naive_utc(value):
    """Normalize an optional datetime (or ISO-8601 string) to naive UTC.

    Device telemetry may arrive with timezone-aware timestamps, while the storage
    and comparison layer uses naive UTC (utcnow_naive). An aware value must be
    converted to UTC and stripped of tzinfo to avoid mixed naive/aware errors
    (e.g. comparing an aware reading timestamp against a naive now). ISO strings
    (e.g. from the single-reading dict endpoint) are parsed first and rejected
    with 422 when malformed.
    """
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            raise HTTPException(422, f"Invalid timestamp format: {value!r}")
    if getattr(value, "tzinfo", None) is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _resolve_communication_alerts(db: Session, device):
    """Auto-resolve ONLY the offline-communication alert for a device that just
    reported again. Other alerts (critical/warning for other metrics) are untouched."""
    db.query(models.Alert).filter(
        models.Alert.tenant_id == device.tenant_id,
        models.Alert.device_id == device.id,
        models.Alert.metric == "communication",
        models.Alert.acknowledged.is_(False),
    ).update({
        "acknowledged": True,
        "acknowledged_by": "system:reconnect",
        "acknowledged_at": models.utcnow_naive(),
    })


def _validate_reading(reading: DeviceReadingBatchItem, device_ids: set, device_id: int) -> tuple:
    """Validate a single reading against business rules."""
    if reading.device_id is not None and reading.device_id not in device_ids:
        return False, f"Device {reading.device_id} not found"
    if reading.device_id is None and reading.external_id is None:
        return False, "device_id or external_id is required"

    if reading.energy_mode == "cumulative_total":
        return False, f"energy_mode='cumulative_total' is not supported; convert cumulative energy to interval delta (device {device_id})"

    if reading.power_kw is not None:
        if reading.power_kw < 0:
            return False, f"power_kw cannot be negative for device {device_id}"
        if reading.power_kw > 100000:
            return False, f"power_kw exceeds maximum for device {device_id}"

    if reading.soc_pct is not None:
        if reading.soc_pct < 0 or reading.soc_pct > 100:
            return False, f"soc_pct must be 0-100 for device {device_id}"

    ts = _to_naive_utc(reading.timestamp)
    if ts is not None and ts > models.utcnow_naive():
        return False, f"timestamp cannot be in the future for device {device_id}"

    return True, ""


@ingest_router.post("/ingest/batch", response_model=DeviceReadingBatchResponse, status_code=202)
def ingest_batch(
    request: Request,
    batch: DeviceReadingBatchRequest,
    db: Session = Depends(get_db),
    identity: dict = Depends(require_ingest_identity),
):
    """
    Batch ingest endpoint for high-throughput telemetry.

    Accepts up to 10,000 readings in a single request.
    Returns 202 Accepted immediately; processing happens synchronously
    but the response format is designed for async compatibility.

    Use this endpoint instead of individual /{device_id}/ingest when:
    - Ingesting from multiple devices simultaneously
    - Gateway is pushing buffered readings
    - High-frequency telemetry (sub-second intervals)
    """
    return _ingest_readings_batch(
        db,
        batch,
        identity,
        audit_ip=request.client.host if request.client else None,
    )


def _ingest_readings_batch(db: Session, batch: DeviceReadingBatchRequest, identity: dict, audit_ip: str = None):
    """Core batch-ingest pipeline shared by the HTTP endpoint and the equipment
    adapter gateway flow. Validates, deduplicates, persists and fires alerts.
    Returns the same shape as DeviceReadingBatchResponse."""
    identity_tenant = identity.get("tenant_id")
    role = identity.get("role", "")

    device_ids = {r.device_id for r in batch.readings}

    # Get all devices in one query
    devices = {d.id: d for d in db.query(models.Device).filter(models.Device.id.in_(list(device_ids))).all()}

    accepted = 0
    duplicated = 0
    rejected = 0
    errors = []
    accepted_device_ids = set()
    accepted_reading_by_device = {}

    for i, reading in enumerate(batch.readings):
        # Resolve the target device: by internal device_id, or by physical
        # external_id (strictly within the authenticated tenant).
        device = None
        resolved_id = reading.device_id
        if resolved_id is None and reading.external_id is not None:
            q = db.query(models.Device).filter(models.Device.external_id == reading.external_id)
            if identity_tenant is not None:
                q = q.filter(models.Device.tenant_id == identity_tenant)
            device = q.first()
            if device is None:
                rejected += 1
                errors.append({"index": i, "external_id": reading.external_id,
                               "error": "Device not found for external_id in the authenticated tenant"})
                continue
            resolved_id = device.id
            devices[resolved_id] = device
        elif resolved_id is not None:
            device = devices.get(resolved_id)

        if device is None:
            rejected += 1
            errors.append({"index": i, "device_id": resolved_id, "error": f"Device {resolved_id} not found"})
            continue

        valid, error_msg = _validate_reading(reading, set(devices.keys()), resolved_id)

        if valid and role != "SUPER_ADMIN":
            if identity_tenant is not None and device.tenant_id != identity_tenant:
                valid, error_msg = False, f"Device {resolved_id} does not belong to the authenticated tenant"

        if not valid:
            rejected += 1
            errors.append({"index": i, "device_id": resolved_id, "error": error_msg})
            continue

        ts = _to_naive_utc(reading.timestamp) or models.utcnow_naive()
        dev = device
        # Idempotency: skip if (device_id, timestamp) is already persisted.
        if db.query(models.DeviceReading.id).filter(
            models.DeviceReading.device_id == resolved_id,
            models.DeviceReading.timestamp == ts,
        ).first():
            duplicated += 1
            continue

        db_reading = models.DeviceReading(
            device_id=resolved_id,
            tenant_id=dev.tenant_id,
            power_kw=reading.power_kw,
            energy_kwh=reading.energy_kwh,
            soc_pct=reading.soc_pct,
            temp_c=reading.temp_c,
            voltage_v=reading.voltage_v,
            current_a=reading.current_a,
            frequency_hz=reading.frequency_hz,
            raw=reading.raw,
            timestamp=ts,
        )
        try:
            with db.begin_nested():
                db.add(db_reading)
                db.flush()
        except IntegrityError:
            duplicated += 1
            continue

        accepted += 1
        dev.status = "online"
        dev.last_seen = models.utcnow_naive()
        accepted_device_ids.add(resolved_id)
        accepted_reading_by_device[resolved_id] = reading

    # Auto-resolve offline-communication alerts for devices that just reported.
    for device_id in accepted_device_ids:
        _resolve_communication_alerts(db, devices[device_id])

    db.commit()

    # Auto-alert evaluation after persistence (non-critical; must not fail the
    # already-persisted readings). Evaluates the last reading per device.
    for device_id, reading in accepted_reading_by_device.items():
        dev = devices.get(device_id)
        if dev is None:
            continue
        try:
            evaluate_rules_sync(dev.tenant_id, dev.id, dev.name, reading.model_dump(exclude_none=True), db)
        except Exception:
            continue

    if accepted > 0:
        log_audit_event(
            db=db,
            action="device.readings.batch_ingest",
            details={
                "total_readings": len(batch.readings),
                "accepted": accepted,
                "rejected": rejected,
                "device_count": len(device_ids),
            },
            ip_address=audit_ip,
        )

    return DeviceReadingBatchResponse(
        accepted=accepted,
        duplicated=duplicated,
        rejected=rejected,
        errors=errors,
        timestamp=models.utcnow_naive(),
    )



# ── Internal test helpers ─────────────────────────────────────────────────────
async def _run_test(protocol: str, config: dict) -> dict:
    try:
        if protocol == "solaredge":
            return await _test_solaredge(config)
        elif protocol in ("modbus_tcp",):
            return await _test_modbus_tcp(config)
        elif protocol == "modbus_rtu":
            return _test_modbus_rtu(config)
        elif protocol == "opcua":
            return await _test_opcua(config)
        elif protocol in ("fronius", "huawei", "sma"):
            return await _test_http_api(protocol, config)
        else:
            return {"ok": False, "message": f"Unknown protocol: {protocol}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


async def _test_solaredge(cfg: dict) -> dict:
    import httpx
    api_key = cfg.get("api_key", "")
    site_id = cfg.get("site_id", "")
    if not api_key or not site_id:
        return {"ok": False, "message": "api_key and site_id required"}
    url = f"https://monitoringapi.solaredge.com/site/{site_id}/overview?api_key={api_key}"
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(url)
    if r.status_code == 200:
        return {"ok": True, "message": "SolarEdge API reachable", "data": r.json()}
    return {"ok": False, "message": f"HTTP {r.status_code}: {r.text[:200]}"}


async def _test_modbus_tcp(cfg: dict) -> dict:
    from pymodbus.client import AsyncModbusTcpClient
    host = cfg.get("host", "127.0.0.1")
    port = int(cfg.get("port", 502))
    client = AsyncModbusTcpClient(host, port=port)
    connected = await client.connect()
    await client.close()
    if connected:
        return {"ok": True, "message": f"Modbus TCP connected to {host}:{port}"}
    return {"ok": False, "message": f"Could not connect to {host}:{port}"}


def _test_modbus_rtu(cfg: dict) -> dict:
    import serial
    port = cfg.get("port", "/dev/ttyUSB0")
    baud = int(cfg.get("baudrate", 9600))
    try:
        s = serial.Serial(port, baud, timeout=2)
        s.close()
        return {"ok": True, "message": f"Serial port {port} opened at {baud} baud"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


async def _test_opcua(cfg: dict) -> dict:
    from asyncua import Client as OpcClient
    url = cfg.get("url", "opc.tcp://localhost:4840")
    async with OpcClient(url=url, timeout=5) as c:
        await c.connect()
    return {"ok": True, "message": f"OPC-UA connected to {url}"}


async def _test_http_api(protocol: str, cfg: dict) -> dict:
    import httpx
    host = cfg.get("host", "")
    if not host:
        return {"ok": False, "message": "host required"}
    endpoints = {
        "fronius": f"http://{host}/solar_api/v1/GetInverterRealtimeData.cgi?Scope=System",
        "sma": f"https://{host}/dyn/getDashValues.json",
        "huawei": f"https://{host}/rest/pvms/web/auth/token",
    }
    url = endpoints.get(protocol, f"http://{host}/")
    async with httpx.AsyncClient(timeout=6, verify=False) as c:
        r = await c.get(url)
    if r.status_code < 400:
        return {"ok": True, "message": f"{protocol} API reachable ({r.status_code})"}
    return {"ok": False, "message": f"HTTP {r.status_code}"}
