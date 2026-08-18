"""Safe VPP dispatch execution endpoints.

The current implementation is simulation-only. It converts an optimizer result into
validated device setpoints and never writes to physical equipment.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal
from control.dispatch_executor import DispatchExecutor
from optimization.asset_mapper import build_portfolio_from_vpp
from optimization.multi_asset_optimizer import MultiAssetOptimizer

router = APIRouter(prefix="/api/vpp", tags=["vpp-dispatch"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DryRunDispatchBody(BaseModel):
    horizon_hours: int = Field(default=24, ge=1, le=168)
    country_code: str = "NL"
    prices_eur_mwh: Optional[list[float]] = None
    base_load_kw: Optional[list[float]] = None
    max_import_kw: Optional[float] = None
    max_export_kw: Optional[float] = None


@router.post("/{vpp_id}/dispatch/dry-run")
async def dispatch_dry_run(vpp_id: int, body: DryRunDispatchBody, db: Session = Depends(get_db)):
    """Optimize a persisted VPP and return the device setpoints that would be sent.

    This endpoint is intentionally simulation-only. No physical gateway or device
    protocol is called and the executor refuses any mode other than dry_run.
    """
    vpp = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not vpp:
        raise HTTPException(404, "VPP group not found")
    if not vpp.active:
        raise HTTPException(409, "VPP group is inactive")

    horizon = body.horizon_hours
    prices = list(body.prices_eur_mwh or [])
    price_source = "request"

    if not prices:
        from backend.market.entsoe import get_entsoe_client
        client = get_entsoe_client()
        if not client:
            raise HTTPException(503, "No price series supplied and ENTSO-E is not configured")
        from datetime import datetime, timedelta
        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        response = await client.get_day_ahead_prices(
            country_code=body.country_code,
            start=now,
            end=now + timedelta(hours=horizon),
        )
        if not response.success or not response.data:
            raise HTTPException(502, f"ENTSO-E price feed failed: {response.error or 'no data'}")
        prices = [point.price_eur_mwh for point in response.data]
        price_source = "ENTSO-E day-ahead"

    if len(prices) < horizon:
        raise HTTPException(400, f"Need at least {horizon} hourly prices, received {len(prices)}")

    portfolio, mapping = build_portfolio_from_vpp(
        db=db,
        vpp=vpp,
        prices_eur_mwh=prices[:horizon],
        base_load_kw=body.base_load_kw,
        horizon=horizon,
    )
    if body.max_import_kw is not None:
        portfolio.max_import_kw = body.max_import_kw
    if body.max_export_kw is not None:
        portfolio.max_export_kw = body.max_export_kw

    result = MultiAssetOptimizer().optimize(portfolio)
    if result.status != "optimal":
        raise HTTPException(422, f"Optimizer did not return an optimal solution: {result.status}")

    site_ids = mapping.get("site_ids", [])
    devices = (
        db.query(models.Device)
        .filter(models.Device.site_id.in_(site_ids), models.Device.enabled.is_(True))
        .all()
        if site_ids else []
    )

    executor = DispatchExecutor(mode="dry_run")
    setpoints = executor.build_setpoints(devices, result.asset_dispatch)
    execution = executor.execute(setpoints)

    return {
        "vpp_id": vpp_id,
        "status": "dry_run",
        "optimizer_status": result.status,
        "price_source": price_source,
        "mapping": mapping,
        "dispatch": {
            "vpp": result.vpp_dispatch,
            "sites": result.site_dispatch,
            "assets": result.asset_dispatch,
        },
        "execution": execution,
    }
