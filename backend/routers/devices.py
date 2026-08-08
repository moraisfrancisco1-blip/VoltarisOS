"""
/api/devices  — CRUD + connection test + readings + batch ingest
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.schemas import (
    DeviceReadingBatchRequest,
    DeviceReadingBatchResponse,
    DeviceReadingBatchItem,
)
from backend.audit import log_audit_event

router = APIRouter(prefix="/api/devices", tags=["devices"])


# ── Dependency ──────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ──────────────────────────────────────────────────────────────────
class DeviceCreate(BaseModel):
    name: str
    site_id: Optional[int] = None
    protocol: str          # solaredge | fronius | huawei | sma | modbus_tcp | modbus_rtu | opcua
    device_type: str = "inverter"
    config: Dict[str, Any] = {}
    enabled: bool = True


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


class DeviceOut(BaseModel):
    id: int
    name: str
    site_id: Optional[int]
    protocol: str
    device_type: str
    config: Dict[str, Any]
    enabled: bool
    status: str
    last_seen: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    return db.query(models.Device).all()


@router.post("", response_model=DeviceOut, status_code=201)
def create_device(body: DeviceCreate, db: Session = Depends(get_db)):
    dev = models.Device(**body.dict())
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return dev


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: int, db: Session = Depends(get_db)):
    dev = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not dev:
        raise HTTPException(404, "Device not found")
    return dev


@router.put("/{device_id}", response_model=DeviceOut)
def update_device(device_id: int, body: DeviceUpdate, db: Session = Depends(get_db)):
    dev = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not dev:
        raise HTTPException(404, "Device not found")
    for field, val in body.dict(exclude_none=True).items():
        setattr(dev, field, val)
    db.commit()
    db.refresh(dev)
    return dev


@router.delete("/{device_id}", status_code=204)
def delete_device(device_id: int, db: Session = Depends(get_db)):
    dev = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not dev:
        raise HTTPException(404, "Device not found")
    db.delete(dev)
    db.commit()


@router.post("/{device_id}/test")
async def test_connection(device_id: int, db: Session = Depends(get_db)):
    """Quick connectivity check — does NOT store readings."""
    dev = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not dev:
        raise HTTPException(404, "Device not found")

    result = await _run_test(dev.protocol, dev.config)

    dev.status = "online" if result["ok"] else "error"
    dev.last_seen = datetime.utcnow() if result["ok"] else dev.last_seen
    db.commit()
    return result


@router.get("/{device_id}/readings", response_model=List[ReadingOut])
def get_readings(device_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(models.DeviceReading)
        .filter(models.DeviceReading.device_id == device_id)
        .order_by(models.DeviceReading.timestamp.desc())
        .limit(limit)
        .all()
    )


@router.post("/{device_id}/ingest", status_code=201)
def ingest_reading(device_id: int, reading: dict, db: Session = Depends(get_db)):
    """Used by the Edge Gateway to push a normalised reading."""
    dev = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not dev:
        raise HTTPException(404, "Device not found")

    r = models.DeviceReading(
        device_id=device_id,
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
    dev.status = "online"
    dev.last_seen = datetime.utcnow()
    db.commit()
    return {"ok": True, "id": r.id}


# ── Batch Ingest Endpoint ─────────────────────────────────────────────────────

def _validate_reading(reading: DeviceReadingBatchItem, device_ids: set) -> tuple:
    """Validate a single reading against business rules."""
    if reading.device_id not in device_ids:
        return False, f"Device {reading.device_id} not found"
    
    if reading.power_kw is not None:
        if reading.power_kw < 0:
            return False, f"power_kw cannot be negative for device {reading.device_id}"
        if reading.power_kw > 100000:
            return False, f"power_kw exceeds maximum for device {reading.device_id}"
    
    if reading.soc_pct is not None:
        if reading.soc_pct < 0 or reading.soc_pct > 100:
            return False, f"soc_pct must be 0-100 for device {reading.device_id}"
    
    if reading.timestamp is not None:
        if reading.timestamp > datetime.utcnow():
            return False, f"timestamp cannot be in the future for device {reading.device_id}"
    
    return True, ""


@router.post("/ingest/batch", response_model=DeviceReadingBatchResponse, status_code=202)
def ingest_batch(
    request: Request,
    batch: DeviceReadingBatchRequest,
    db: Session = Depends(get_db),
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
    device_ids = {r.device_id for r in batch.readings}
    
    # Get all devices in one query
    devices = {d.id: d for d in db.query(models.Device).filter(models.Device.id.in_(list(device_ids))).all()}
    
    accepted = 0
    rejected = 0
    errors = []
    readings_to_insert = []
    
    for i, reading in enumerate(batch.readings):
        valid, error_msg = _validate_reading(reading, set(devices.keys()))
        
        if not valid:
            rejected += 1
            errors.append({"index": i, "device_id": reading.device_id, "error": error_msg})
            continue
        
        db_reading = models.DeviceReading(
            device_id=reading.device_id,
            tenant_id=devices[reading.device_id].tenant_id,
            power_kw=reading.power_kw,
            energy_kwh=reading.energy_kwh,
            soc_pct=reading.soc_pct,
            temp_c=reading.temp_c,
            voltage_v=reading.voltage_v,
            current_a=reading.current_a,
            frequency_hz=reading.frequency_hz,
            raw=reading.raw,
            timestamp=reading.timestamp or datetime.utcnow(),
        )
        readings_to_insert.append(db_reading)
        
        devices[reading.device_id].status = "online"
        devices[reading.device_id].last_seen = datetime.utcnow()
    
    if readings_to_insert:
        db.bulk_save_objects(readings_to_insert)
        accepted = len(readings_to_insert)
    
    db.commit()
    
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
            ip_address=request.client.host if request.client else None,
        )
    
    return DeviceReadingBatchResponse(
        accepted=accepted,
        rejected=rejected,
        errors=errors,
        timestamp=datetime.utcnow(),
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
