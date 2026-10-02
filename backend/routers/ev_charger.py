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

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Literal
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, netguard
from backend.audit import log_audit_event
from backend.security import get_current_user, require_admin
from backend.routers.devices import _get_owned_device
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
    # Amps for set_current. NaN/inf are rejected and the range is bounded by the
    # connector's hard ceiling (alfen_eve.HARD_MAX_AMPS) on top of the device's
    # own configured limits.
    value: Optional[float] = Field(default=None, ge=0, le=alfen_eve.HARD_MAX_AMPS, allow_inf_nan=False)


class EVOptimiseRequest(BaseModel):
    solar_surplus_kw: float = Field(allow_inf_nan=False, ge=0, le=1000)   # Current solar surplus (kW)
    spot_price_eur: float = Field(allow_inf_nan=False, ge=-10, le=10)     # Current ENTSO-E spot price (EUR/kWh)


class EVCommandResponse(BaseModel):
    ok: bool
    command: str
    message: Optional[str] = None
    amps: Optional[float] = None


# --- Helper -------------------------------------------------------------------

def _get_ev_device(device_id: int, db: Session, user: dict):
    """Fetch device, verify it belongs to the caller's tenant (SUPER_ADMIN sees
    all — same rule as devices.py), and that it is an EV charger."""
    device = _get_owned_device(db, device_id, user)
    if device.device_type != "ev_charger":
        raise HTTPException(status_code=400, detail=f"Device {device_id} is not an EV charger")
    if not device.enabled:
        raise HTTPException(status_code=400, detail="Device is disabled")
    return device


async def _require_safe_host(device) -> dict:
    """The charger's host must be configured (no silent fallback to a hard-coded
    LAN address) and must be a destination the server is allowed to contact
    (SSRF guard, see backend/netguard.py)."""
    config = dict(device.config or {})
    host = config.get("host", "")
    if not host:
        raise HTTPException(status_code=400, detail="Device has no IP configured")
    try:
        await netguard.acheck_host(host)
    except netguard.BlockedDestination as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return config


def _audit_command(db: Session, request: Request, user: dict, device, action: str, details: dict) -> None:
    """Every physical command is audited, successful or not."""
    log_audit_event(
        db=db, action=action, tenant_id=device.tenant_id, user_email=user.get("sub"),
        target_resource="device", target_id=device.id,
        ip_address=request.client.host if request.client else None,
        details=details,
    )


# --- Endpoints ----------------------------------------------------------------

@router.get("/{device_id}/status")
async def get_ev_status(
    device_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Read live charger state via Modbus TCP."""
    device = _get_ev_device(device_id, db, current_user)
    config = await _require_safe_host(device)

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
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """
    Send a control command to the charger.
    - set_current: set charge current in Amps (value required)
    - pause: block charging
    - resume: allow charging

    Physical control: TENANT_ADMIN / SUPER_ADMIN only, and audited.
    """
    device = _get_ev_device(device_id, db, current_user)
    config = await _require_safe_host(device)

    if body.command == "set_current" and body.value is None:
        raise HTTPException(status_code=422, detail="value (Amps) required for set_current")

    result = await alfen_eve.send_command(
        config=config,
        command=body.command,
        value=body.value or 0.0,
    )

    _audit_command(db, request, current_user, device, "device.command", {
        "command": body.command, "requested_value": body.value,
        "applied_amps": result.get("amps"), "ok": bool(result.get("ok")),
    })

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
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """
    Run one solar optimisation cycle.
    Called by the frontend or by the background task every 30s. It sends
    commands to the charger, so like /command it is admin-only and audited.
    """
    device = _get_ev_device(device_id, db, current_user)
    config = await _require_safe_host(device)

    result = await alfen_eve.solar_optimise(
        config=config,
        solar_surplus_kw=body.solar_surplus_kw,
        spot_price_eur=body.spot_price_eur,
    )
    _audit_command(db, request, current_user, device, "device.optimise", {
        "solar_surplus_kw": body.solar_surplus_kw, "spot_price_eur": body.spot_price_eur,
        "action": result.get("action"),
    })
    return {"device_id": device_id, **result}
