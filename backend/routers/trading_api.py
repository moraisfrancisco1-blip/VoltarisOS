from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from backend.audit import log_audit_event
from backend.database import SessionLocal

router = APIRouter(prefix="/api")


# ─── Arbitrage signal engine ────────────────────────────────────────────────
# Deterministic scoring based on price analysis — no randomness.
# The scoring thresholds and dispatch logic are the actual IP of the VPP
# dispatch engine, living server-side.

class PricePoint(BaseModel):
    h: str = Field(..., description="Hour identifier")
    price: float = Field(..., ge=0, description="Price in EUR/MWh")
    forecast: Optional[float] = Field(None, ge=0, description="Forecasted price")


class SignalsRequest(BaseModel):
    prices: List[PricePoint] = Field(..., min_length=1, description="List of price points")
    bess_kwh: float = Field(500, gt=0, le=10000, description="Battery capacity in kWh")
    efficiency: float = Field(0.92, gt=0, le=1, description="Round-trip efficiency")


class SignalOut(BaseModel):
    h: str
    price: float
    forecast: Optional[float]
    action: str  # "charge", "discharge", "hold"
    score: int = Field(..., ge=0, le=100)
    spread: float
    potential: float


@router.post("/arbitrage-signals")
def arbitrage_signals(payload: SignalsRequest):
    """
    Calculate deterministic arbitrage signals based on price analysis.
    
    Scoring is based on:
    - Price deviation from average (spread)
    - Position in price ranking (percentile)
    - Forecast vs actual price comparison
    
    No randomness — same input always produces same output.
    """
    prices = payload.prices
    if not prices:
        return {"signals": [], "generated_at": datetime.utcnow().isoformat()}

    vals = [p.price for p in prices]
    avg = sum(vals) / len(vals)
    
    # Calculate percentiles deterministically
    sorted_vals = sorted(vals)
    n = len(sorted_vals)
    p20_idx = max(0, int(n * 0.2) - 1)
    p80_idx = min(n - 1, int(n * 0.8))
    low_threshold = sorted_vals[p20_idx]
    high_threshold = sorted_vals[p80_idx]

    signals = []
    for p in prices:
        # Deterministic scoring based on price position
        spread = p.price - avg
        spread_pct = (spread / avg) * 100 if avg > 0 else 0
        
        # Score calculation (deterministic)
        if p.price <= low_threshold and p.price < avg * 0.75:
            action = "charge"
            # Score based on how far below average (max 100)
            score = min(100, int(70 + abs(spread_pct) * 0.5))
        elif p.price >= high_threshold and p.price > avg * 1.25:
            action = "discharge"
            score = min(100, int(70 + abs(spread_pct) * 0.5))
        elif p.price < avg * 0.9:
            action = "charge"
            score = min(70, int(50 + abs(spread_pct) * 0.3))
        elif p.price > avg * 1.1:
            action = "discharge"
            score = min(70, int(50 + abs(spread_pct) * 0.3))
        else:
            action = "hold"
            score = max(0, int(50 - abs(spread_pct) * 0.5))

        # Potential profit calculation
        if action == "discharge":
            potential = (p.price * payload.bess_kwh * payload.efficiency) / 1000
        elif action == "charge":
            potential = -(p.price * payload.bess_kwh) / 1000
        else:
            potential = 0

        signals.append(SignalOut(
            h=p.h,
            price=p.price,
            forecast=p.forecast,
            action=action,
            score=score,
            spread=round(spread, 2),
            potential=round(potential, 2),
        ))

    return {
        "signals": [s.model_dump() for s in signals],
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "avg_price": round(avg, 2),
            "low_threshold": round(low_threshold, 2),
            "high_threshold": round(high_threshold, 2),
            "charge_signals": sum(1 for s in signals if s.action == "charge"),
            "discharge_signals": sum(1 for s in signals if s.action == "discharge"),
            "hold_signals": sum(1 for s in signals if s.action == "hold"),
        }
    }


# ─── Trade endpoint (deprecated — use VPP bids instead) ─────────────────────
# This endpoint is kept for backward compatibility but should not be used
# for new integrations. Use POST /api/vpp/{id}/bid instead.

@router.get("/trade")
def trade():
    """
    DEPRECATED: This endpoint returns mock data for demo purposes only.
    
    For real trading, use:
    - POST /api/vpp/{id}/bid — Submit bids to energy markets
    - POST /api/arbitrage-signals — Get deterministic trading signals
    
    This endpoint will be removed in a future version.
    """
    return {
        "deprecated": True,
        "message": "This endpoint is deprecated. Use POST /api/vpp/{id}/bid for real trading.",
        "migration_guide": {
            "submit_bid": "POST /api/vpp/{vpp_id}/bid",
            "get_signals": "POST /api/arbitrage-signals",
        }
    }
