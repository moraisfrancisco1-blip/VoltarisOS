from fastapi import APIRouter
from pydantic import BaseModel
import random, datetime

router = APIRouter()

# In-memory agent state
agent_state = {
    "status": "running",
    "pnl": 1840.50,
    "trades_today": 7,
    "trades_total": 156,
    "win_rate": 0.87,
    "last_action": "SELL 80 kWh @ €127.4/MWh",
    "log": []
}

# Generate mock log
_actions = [
    ("BUY", "charge", "#4ade80"),
    ("SELL", "discharge", "#f87171"),
    ("HOLD", "hold", "#f59e0b"),
]
for i in range(20):
    h = (datetime.datetime.utcnow() - datetime.timedelta(hours=20-i))
    action, dtype, color = random.choice(_actions)
    qty = random.randint(20, 120)
    price = round(random.uniform(35, 140), 2)
    pnl = round((price - 65) * qty / 1000, 2) if action == "SELL" else round(-(price - 65) * qty / 1000, 2)
    agent_state["log"].append({
        "id": i,
        "time": h.strftime("%H:%M:%S"),
        "date": h.strftime("%d/%m"),
        "action": action,
        "qty": qty,
        "price": price,
        "pnl": pnl,
        "color": color,
        "reason": f"Price signal: €{price}/MWh | SoC: {random.randint(30,90)}% | Confidence: {random.randint(70,97)}%"
    })

class AgentConfig(BaseModel):
    sell_min_price: float = 80.0
    buy_max_price: float = 50.0
    soc_min: float = 20.0
    soc_max: float = 90.0
    max_trade_kwh: float = 150.0

@router.get("/api/trading-agent/status")
def get_status():
    # Simulate live P&L tick
    agent_state["pnl"] = round(agent_state["pnl"] + random.uniform(-5, 12), 2)
    return agent_state

@router.post("/api/trading-agent/toggle")
def toggle_agent():
    agent_state["status"] = "paused" if agent_state["status"] == "running" else "running"
    return {"status": agent_state["status"]}

@router.get("/api/trading-agent/log")
def get_log():
    return {"log": list(reversed(agent_state["log"][-50:]))}

@router.post("/api/trading-agent/config")
def update_config(config: AgentConfig):
    return {"message": "Configuração atualizada", "config": config.dict()}
