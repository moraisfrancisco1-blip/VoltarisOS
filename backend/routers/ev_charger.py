"""
backend/routers/ev_charger.py
==============================
REST API endpoints for EV charger management in VoltarisOS.

Endpoints:
  GET  /api/ev/{device_id}/status       - current charger state
  POST /api/ev/{device_id}/command      - send control command
  POST /api/ev/{device_id}/optimise     - run one optimisation cycle
  GET  /api/ev/{device_id}/history      - session history
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user
from gateway.connectors import alfen_eve

router = APIRouter(prefix="/api/ev", tags=["ev_charger"])


# --- Dependency ---------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Schemas ------------------------------------------------------------------

class EVCommandRequest(BaseModel):
    command: Literal["set_current", "pause", "resume"]
    value: Optional[float] = None   # Amps for set_current


class EVOptimiseRequest(BaseModel):
    solar_surplus_kw: float         # Current solar surplus (kW)
    spot_price_eur: float           # Current ENTSO-E spot price (EUR/kWh)


class EVCommandResponse(BaseModel):
    ok: bool
    command: str
    message: Optional[str] = None
    amps: Optional[float] = None


# --- Helper -------------------------------------------------------------------

def _get_ev_device(device_id: int, db: Session):
    """Fetch device and verify it is an EV charger."""
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.device_type != "ev_charger":
        raise HTTPException(status_code=400, detail=f"Device {device_id} is not an EV charger")
    if not device.enabled:
        raise HTTPException(status_code=400, detail="Device is disabled")
    return device


# --- Endpoints ----------------------------------------------------------------

@router.get("/{device_id}/status")
async def get_ev_status(
    device_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Read live charger state via Modbus TCP."""
    device = _get_ev_device(device_id, db)
    config = device.config or {}
    config["host"] = config.get("host", "")

    if not config["host"]:
        raise HTTPException(status_code=400, detail="Device has no IP configured")

    try:
        state = await alfen_eve.poll(config)
        return {"device_id": device_id, "name": device.name, **state}
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Modbus error: {e}")


@router.post("/{device_id}/command", response_model=EVCommandResponse)
async def send_ev_command(
    device_id: int,
    body: EVCommandRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Send a control command to the charger.
    - set_current: set charge current in Amps (value required)
    - pause: block charging
    - resume: allow charging
    """
    device = _get_ev_device(device_id, db)
    config = device.config or {}

    if body.command == "set_current" and body.value is None:
        raise HTTPException(status_code=422, detail="value (Amps) required for set_current")

    result = await alfen_eve.send_command(
        config=config,
        command=body.command,
        value=body.value or 0.0,
    )

    if not result.get("ok"):
        raise HTTPException(status_code=503, detail=result.get("message", "Command failed"))

    return EVCommandResponse(
        ok=True,
        command=body.command,
        amps=result.get("amps"),
    )


@router.post("/{device_id}/optimise")
async def optimise_ev(
    device_id: int,
    body: EVOptimiseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Run one solar optimisation cycle.
    Called by the frontend or by the background task every 30s.
    """
    device = _get_ev_device(device_id, db)
    config = device.config or {}

    result = await alfen_eve.solar_optimise(
        config=config,
        solar_surplus_kw=body.solar_surplus_kw,
        spot_price_eur=body.spot_price_eur,
    )
    return {"device_id": device_id, **result}
