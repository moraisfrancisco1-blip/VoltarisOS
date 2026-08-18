"""
Virtual Power Plant — aggregação de sites + licitação de mercado
GET  /api/vpp                    — listar grupos
POST /api/vpp                    — criar grupo
POST /api/vpp/{id}/sites         — adicionar site ao grupo
GET  /api/vpp/{id}/aggregate     — potência agregada em tempo real
POST /api/vpp/{id}/bid            — submeter bid ao mercado
GET  /api/vpp/{id}/bids           — histórico de bids
GET  /api/vpp/{id}/dispatch       — calcular dispatch por site
POST /api/vpp/{id}/optimize       — otimizar o VPP com o motor multi-asset
POST /api/vpp/{id}/dispatch/dry-run — transformar dispatch em setpoints sem controlo físico
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.audit import log_audit_event
from optimization.asset_mapper import build_portfolio_from_vpp
from optimization.multi_asset_optimizer import MultiAssetOptimizer
from control.dispatch_executor import DispatchExecutor

router = APIRouter(prefix="/api/vpp", tags=["vpp"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ───────────────────────────────────────────────────────────────────
class VPPGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    market: str = "MIBEL"
    strategy: str = "peak_shaving"
    target_kw: Optional[float] = None
    min_bid_kw: float = 100.0

class VPPGroupOut(VPPGroupCreate):
    id: int
    tenant_id: int
    active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class AddSiteBody(BaseModel):
    site_id: int
    weight: float = 1.0

class BidBody(BaseModel):
    quantity_kw: float
    price_eur_mwh: Optional[float] = None
    direction: str = "sell"
    delivery_period: Optional[str] = None

class BidOut(BaseModel):
    id: int
    vpp_id: int
    market: str
    quantity_kw: float
    price_eur_mwh: Optional[float]
    direction: str
    status: str
    pnl_eur: Optional[float]
    submitted_at: datetime
    class Config:
        from_attributes = True

class VPPOptimizeBody(BaseModel):
    horizon_hours: int = 24
    country_code: str = "NL"
    prices_eur_mwh: Optional[List[float]] = None
    base_load_kw: Optional[List[float]] = None
    max_import_kw: Optional[float] = None
    max_export_kw: Optional[float] = None


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("", response_model=List[VPPGroupOut])
def list_groups(tenant_id: int = Query(default=1), db: Session = Depends(get_db)):
    return db.query(models.VPPGroup).filter(models.VPPGroup.tenant_id == tenant_id).all()


@router.post("", response_model=VPPGroupOut, status_code=201)
def create_group(body: VPPGroupCreate, tenant_id: int = Query(default=1), db: Session = Depends(get_db)):
    g = models.VPPGroup(tenant_id=tenant_id, **body.dict())
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.get("/{vpp_id}", response_model=VPPGroupOut)
def get_group(vpp_id: int, db: Session = Depends(get_db)):
    g = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not g:
        raise HTTPException(404)
    return g


@router.delete("/{vpp_id}", status_code=204)
def delete_group(vpp_id: int, db: Session = Depends(get_db)):
    g = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not g:
        raise HTTPException(404)
    db.delete(g)
    db.commit()


@router.post("/{vpp_id}/sites")
def add_site(vpp_id: int, body: AddSiteBody, db: Session = Depends(get_db)):
    existing = db.query(models.VPPSiteMembership).filter(
        models.VPPSiteMembership.vpp_id == vpp_id,
        models.VPPSiteMembership.site_id == body.site_id
    ).first()
    if existing:
        return {"ok": True, "message": "Already member"}
    m = models.VPPSiteMembership(vpp_id=vpp_id, site_id=body.site_id, weight=body.weight)
    db.add(m)
    db.commit()
    return {"ok": True}


@router.delete("/{vpp_id}/sites/{site_id}", status_code=204)
def remove_site(vpp_id: int, site_id: int, db: Session = Depends(get_db)):
    m = db.query(models.VPPSiteMembership).filter(
        models.VPPSiteMembership.vpp_id == vpp_id,
        models.VPPSiteMembership.site_id == site_id
    ).first()
    if m:
        db.delete(m)
        db.commit()


@router.get("/{vpp_id}/aggregate")
def aggregate(vpp_id: int, db: Session = Depends(get_db)):
    """Aggregate real-time power across all sites in VPP group."""
    g = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not g:
        raise HTTPException(404)

    members = db.query(models.VPPSiteMembership).filter(
        models.VPPSiteMembership.vpp_id == vpp_id
    ).all()

    site_ids = [m.site_id for m in members]
    devices = db.query(models.Device).filter(models.Device.site_id.in_(site_ids)).all() if site_ids else []

    total_power_kw = 0.0
    site_data = []

    for m in members:
        site_devices = [d for d in devices if d.site_id == m.site_id]
        site_power = 0.0
        for dev in site_devices:
            reading = (
                db.query(models.DeviceReading)
                .filter(models.DeviceReading.device_id == dev.id)
                .order_by(models.DeviceReading.timestamp.desc())
                .first()
            )
            if reading and reading.power_kw:
                site_power += reading.power_kw

        total_power_kw += site_power * m.weight
        site_data.append({
            "site_id": m.site_id,
            "weight": m.weight,
            "power_kw": site_power,
            "contribution_kw": site_power * m.weight,
        })

    spot_price = None
    fcr_price = None
    is_peak = datetime.utcnow().hour in range(7, 22)

    return {
        "vpp_id": vpp_id,
        "name": g.name,
        "market": g.market,
        "strategy": g.strategy,
        "total_power_kw": round(total_power_kw, 1),
        "min_bid_kw": g.min_bid_kw,
        "can_bid": total_power_kw >= g.min_bid_kw,
        "site_count": len(members),
        "sites": site_data,
        "market_signals": {
            "spot_price_eur_mwh": spot_price,
            "fcr_price_eur_mw": fcr_price,
            "is_peak_hour": is_peak,
            "price_feed_status": "unavailable" if spot_price is None else "live",
            "recommendation": _recommend(g.strategy, total_power_kw, spot_price or 0, g.min_bid_kw),
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


def _recommend(strategy: str, power_kw: float, price: float, min_bid: float) -> dict:
    if power_kw < min_bid:
        return {"action": "wait", "reason": f"Need {min_bid} kW minimum, currently {power_kw:.0f} kW"}
    if strategy == "peak_shaving" and price > 100:
        return {"action": "sell", "reason": f"High spot price ({price:.0f} €/MWh) — discharge BESS now"}
    if strategy == "arbitrage" and price < 60:
        return {"action": "buy", "reason": f"Low price ({price:.0f} €/MWh) — charge BESS"}
    if strategy == "fcr":
        return {"action": "bid_fcr", "reason": "Submit FCR capacity offer to TSO"}
    if strategy == "afrr":
        return {"action": "bid_afrr", "reason": "Submit aFRR capacity offer"}
    return {"action": "hold", "reason": "Conditions not optimal for bidding"}


async def _optimize_persisted_vpp(vpp_id: int, body: VPPOptimizeBody, db: Session):
    vpp = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not vpp:
        raise HTTPException(404, "VPP group not found")
    if not vpp.active:
        raise HTTPException(409, "VPP group is inactive")
    if body.horizon_hours < 1 or body.horizon_hours > 168:
        raise HTTPException(400, "horizon_hours must be between 1 and 168")

    horizon = body.horizon_hours
    prices = list(body.prices_eur_mwh or [])
    price_source = "request"

    if not prices:
        from backend.market.entsoe import get_entsoe_client
        client = get_entsoe_client()
        if not client:
            raise HTTPException(503, "No price series supplied and ENTSO-E is not configured")
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
    prices = prices[:horizon]

    portfolio, mapping = build_portfolio_from_vpp(
        db=db,
        vpp=vpp,
        prices_eur_mwh=prices,
        base_load_kw=body.base_load_kw,
        horizon=horizon,
    )
    if body.max_import_kw is not None:
        portfolio.max_import_kw = body.max_import_kw
    if body.max_export_kw is not None:
        portfolio.max_export_kw = body.max_export_kw

    result = MultiAssetOptimizer().optimize(portfolio)
    return vpp, price_source, mapping, result


@router.post("/{vpp_id}/optimize")
async def optimize_vpp(vpp_id: int, body: VPPOptimizeBody, db: Session = Depends(get_db)):
    """Run the multi-asset optimizer against the persisted VPP portfolio."""
    vpp, price_source, mapping, result = await _optimize_persisted_vpp(vpp_id, body, db)
    return {
        "vpp_id": vpp_id,
        "status": result.status,
        "price_source": price_source,
        "mapping": mapping,
        "total_cost_eur": result.total_cost_eur,
        "total_import_kwh": result.total_import_kwh,
        "total_export_kwh": result.total_export_kwh,
        "solver_time_ms": result.solver_time_ms,
        "asset_dispatch": result.asset_dispatch,
        "site_dispatch": result.site_dispatch,
        "vpp_dispatch": result.vpp_dispatch,
        "schedule": result.schedule,
        "physical_control": "not_connected",
    }


@router.post("/{vpp_id}/dispatch/dry-run")
async def dispatch_dry_run(vpp_id: int, body: VPPOptimizeBody, db: Session = Depends(get_db)):
    """Optimize a persisted VPP and translate its asset dispatch into safe setpoints.

    This endpoint is deliberately simulation-only. It never writes to physical devices.
    """
    vpp, price_source, mapping, result = await _optimize_persisted_vpp(vpp_id, body, db)
    if result.status != "optimal":
        raise HTTPException(422, f"Optimizer status is {result.status}; no setpoints generated")

    members = db.query(models.VPPSiteMembership).filter(
        models.VPPSiteMembership.vpp_id == vpp.id
    ).all()
    site_ids = [m.site_id for m in members]
    devices = (
        db.query(models.Device)
        .filter(models.Device.site_id.in_(site_ids), models.Device.enabled.is_(True))
        .all()
        if site_ids else []
    )

    executor = DispatchExecutor(mode="dry_run")
    setpoints = executor.build_setpoints(devices, result.asset_dispatch)
    plan = executor.execute(setpoints)

    return {
        "vpp_id": vpp_id,
        "status": result.status,
        "price_source": price_source,
        "mapping": mapping,
        "dispatch": {
            "vpp": result.vpp_dispatch,
            "sites": result.site_dispatch,
            "assets": result.asset_dispatch,
        },
        "execution": plan,
    }


@router.get("/{vpp_id}/dispatch")
def dispatch_plan(vpp_id: int, target_kw: float = Query(default=0), db: Session = Depends(get_db)):
    """Calculate optimal dispatch across sites."""
    members = db.query(models.VPPSiteMembership).filter(
        models.VPPSiteMembership.vpp_id == vpp_id
    ).all()
    if not members:
        return {"sites": [], "total_kw": 0}

    total_weight = sum(m.weight for m in members)
    plan = []
    for m in members:
        allocated = (m.weight / total_weight) * target_kw if total_weight else 0
        plan.append({
            "site_id": m.site_id,
            "weight": m.weight,
            "allocated_kw": round(allocated, 1),
            "setpoint_pct": round((allocated / max(target_kw, 1)) * 100, 1),
        })

    return {
        "vpp_id": vpp_id,
        "target_kw": target_kw,
        "sites": plan,
        "total_kw": round(sum(p["allocated_kw"] for p in plan), 1),
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.post("/{vpp_id}/bid", response_model=BidOut, status_code=201)
def submit_bid(
    vpp_id: int,
    body: BidBody,
    request: Request,
    tenant_id: int = Query(default=1),
    db: Session = Depends(get_db),
):
    """Submit a bid to the energy market."""
    g = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not g:
        raise HTTPException(404, "VPP group not found")
    if body.quantity_kw < g.min_bid_kw:
        raise HTTPException(400, f"Bid quantity ({body.quantity_kw} kW) below minimum ({g.min_bid_kw} kW)")
    valid_directions = ["sell", "buy", "fcr_up", "fcr_down", "afrr_up", "afrr_down"]
    if body.direction not in valid_directions:
        raise HTTPException(400, f"Invalid direction. Must be one of: {valid_directions}")

    bid = models.VPPBid(
        tenant_id=tenant_id,
        vpp_id=vpp_id,
        market=g.market,
        quantity_kw=body.quantity_kw,
        price_eur_mwh=body.price_eur_mwh,
        direction=body.direction,
        delivery_period=body.delivery_period or (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:00"),
        status="pending",
        pnl_eur=None,
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)
    log_audit_event(
        db=db,
        action="vpp.bid.submitted",
        tenant_id=tenant_id,
        target_resource="vpp_bid",
        target_id=bid.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "vpp_id": vpp_id,
            "quantity_kw": body.quantity_kw,
            "price_eur_mwh": body.price_eur_mwh,
            "direction": body.direction,
            "market": g.market,
            "delivery_period": bid.delivery_period,
        },
    )
    return bid


@router.get("/{vpp_id}/bids", response_model=List[BidOut])
def list_bids(vpp_id: int, limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(models.VPPBid)
        .filter(models.VPPBid.vpp_id == vpp_id)
        .order_by(models.VPPBid.submitted_at.desc())
        .limit(limit).all()
    )


@router.get("/{vpp_id}/performance")
def performance(vpp_id: int, days: int = 30, db: Session = Depends(get_db)):
    bids = db.query(models.VPPBid).filter(models.VPPBid.vpp_id == vpp_id).all()
    total_bids = len(bids)
    accepted = [b for b in bids if b.status == "accepted"]
    total_pnl = sum(b.pnl_eur or 0 for b in accepted)
    total_kwh = sum(b.quantity_kw for b in accepted)

    return {
        "total_bids": total_bids,
        "accepted": len(accepted),
        "acceptance_rate_pct": round(len(accepted) / max(total_bids, 1) * 100, 1),
        "total_pnl_eur": round(total_pnl, 2),
        "total_kwh": round(total_kwh, 1),
        "avg_pnl_per_bid_eur": round(total_pnl / max(len(accepted), 1), 2),
        "period_days": days,
    }
