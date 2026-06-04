"""
Virtual Power Plant — aggregação de sites + licitação de mercado
GET  /api/vpp                    — listar grupos
POST /api/vpp                    — criar grupo
POST /api/vpp/{id}/sites         — adicionar site ao grupo
GET  /api/vpp/{id}/aggregate     — potência agregada em tempo real
POST /api/vpp/{id}/bid           — submeter bid ao mercado
GET  /api/vpp/{id}/bids          — histórico de bids
GET  /api/vpp/{id}/dispatch      — calcular dispatch por site
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import random, json, os
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

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

    # Get latest reading per device for sites in group
    site_ids = [m.site_id for m in members]
    devices = db.query(models.Device).filter(models.Device.site_id.in_(site_ids)).all() if site_ids else []

    total_power_kw = 0.0
    total_capacity_kw = 0.0
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

        # Simulated if no real data
        if site_power == 0:
            site_power = round(random.uniform(80, 450), 1)

        total_power_kw += site_power * m.weight
        site_data.append({
            "site_id": m.site_id,
            "weight": m.weight,
            "power_kw": site_power,
            "contribution_kw": site_power * m.weight,
        })

    # Market signal simulation
    spot_price = round(random.uniform(45, 180), 2)
    fcr_price = round(random.uniform(8, 35), 2)
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
            "recommendation": _recommend(g.strategy, total_power_kw, spot_price, g.min_bid_kw),
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
def submit_bid(vpp_id: int, body: BidBody, tenant_id: int = Query(default=1), db: Session = Depends(get_db)):
    g = db.query(models.VPPGroup).filter(models.VPPGroup.id == vpp_id).first()
    if not g:
        raise HTTPException(404)

    # Simulate market acceptance
    accepted = random.random() > 0.25
    price = body.price_eur_mwh or round(random.uniform(60, 120), 2)
    pnl = round(body.quantity_kw / 1000 * price * random.uniform(0.8, 1.2), 2) if accepted else 0

    bid = models.VPPBid(
        tenant_id=tenant_id,
        vpp_id=vpp_id,
        market=g.market,
        quantity_kw=body.quantity_kw,
        price_eur_mwh=price,
        direction=body.direction,
        delivery_period=body.delivery_period or (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:00"),
        status="accepted" if accepted else "rejected",
        pnl_eur=pnl,
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)
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
        "total_energy_mwh": round(total_kwh / 1000, 2),
        "avg_price_eur_mwh": round(
            sum(b.price_eur_mwh or 0 for b in accepted) / max(len(accepted), 1), 2
        ),
    }
