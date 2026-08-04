from fastapi import APIRouter
from pydantic import BaseModel
import random

router = APIRouter(prefix="/api")


# ─── Arbitrage signal engine ────────────────────────────────────────────────
# Moved from the frontend (was previously computed client-side in
# EnergyArbitrage.jsx, fully readable in the shipped JS bundle). The scoring
# thresholds and dispatch logic are the actual IP of the VPP dispatch engine,
# so they now live here, server-side, and the browser only ever sees results.

class PricePoint(BaseModel):
    h: str
    price: float
    forecast: float | None = None


class SignalsRequest(BaseModel):
    prices: list[PricePoint]
    bess_kwh: float = 500
    efficiency: float = 0.92


@router.post("/arbitrage-signals")
def arbitrage_signals(payload: SignalsRequest):
    prices = payload.prices
    if not prices:
        return {"signals": []}

    vals = [p.price for p in prices]
    avg = sum(vals) / len(vals)
    min3 = sorted(vals)[:3]
    max3 = sorted(vals, reverse=True)[:3]

    signals = []
    for p in prices:
        action, score = "hold", 50.0
        if p.price in min3 and p.price < avg * 0.75:
            action, score = "charge", 90 + random.random() * 9
        elif p.price in max3 and p.price > avg * 1.25:
            action, score = "discharge", 88 + random.random() * 11
        elif p.price < avg * 0.9:
            action, score = "charge", 60 + random.random() * 15
        elif p.price > avg * 1.1:
            action, score = "discharge", 62 + random.random() * 18

        spread = p.price - avg
        if action == "discharge":
            potential = (p.price * payload.bess_kwh * payload.efficiency) / 1000
        elif action == "charge":
            potential = -(p.price * payload.bess_kwh) / 1000
        else:
            potential = 0

        signals.append({
            "h": p.h,
            "price": p.price,
            "forecast": p.forecast,
            "action": action,
            "score": round(score),
            "spread": round(spread),
            "potential": round(potential),
        })

    return {"signals": signals}

total_profit = 0

@router.get("/trade")
def trade():

    global total_profit

    price = random.uniform(20,100)
    battery = random.uniform(20,100)

    if price > 70:
        action = "SELL"
        profit = price * 0.2
    elif price < 40:
        action = "BUY"
        profit = -price * 0.1
    else:
        action = "HOLD"
        profit = 0

    total_profit += profit

    return {
        "price": round(price,2),
        "battery": round(battery,2),
        "action": action,
        "profit": round(profit,2),
        "total_profit": round(total_profit,2)
    }