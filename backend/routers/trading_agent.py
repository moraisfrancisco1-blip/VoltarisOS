from fastapi import APIRouter, Depends
from pydantic import BaseModel
import random, datetime, threading
from backend.models import utcnow_naive
from backend.security import get_current_user

router = APIRouter()

# ── Per-tenant in-memory agent state ─────────────────────────────────────────
# Isolated by the authenticated tenant_id (no cross-tenant leakage). This is
# mock state only — NOT persisted across restarts and NOT wired to real
# dispatch/VPP bids (process_vpp_bid remains not_implemented). Every response
# carries `simulated: true` so clients can disclose it.
_actions = [
    ("BUY", "charge", "#4ade80"),
    ("SELL", "discharge", "#f87171"),
    ("HOLD", "hold", "#f59e0b"),
]

_state_lock = threading.Lock()
_state_by_tenant: dict = {}     # tenant_key -> {"status", "pnl", ..., "log"}
_config_by_tenant: dict = {}    # tenant_key -> AgentConfig (in-memory)


def _tenant_key(user: dict) -> str:
    """Isolation key derived from the authenticated user's tenant_id."""
    tid = user.get("tenant_id")
    return f"tenant-{tid}" if tid is not None else "super-admin"


def _new_state() -> dict:
    log = []
    for i in range(20):
        h = utcnow_naive() - datetime.timedelta(hours=20 - i)
        action, dtype, color = random.choice(_actions)
        qty = random.randint(20, 120)
        price = round(random.uniform(35, 140), 2)
        pnl = round((price - 65) * qty / 1000, 2) if action == "SELL" else round(-(price - 65) * qty / 1000, 2)
        log.append({
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
    return {
        "status": "running",
        "pnl": 1840.50,
        "trades_today": 7,
        "trades_total": 156,
        "win_rate": 0.87,
        "last_action": "SELL 80 kWh @ €127.4/MWh",
        "log": log,
    }


def _get_state(user: dict) -> dict:
    key = _tenant_key(user)
    with _state_lock:
        if key not in _state_by_tenant:
            _state_by_tenant[key] = _new_state()
        return _state_by_tenant[key]

class AgentConfig(BaseModel):
    sell_min_price: float = 80.0
    buy_max_price: float = 50.0
    soc_min: float = 20.0
    soc_max: float = 90.0
    max_trade_kwh: float = 150.0

@router.get("/api/trading-agent/status")
def get_status(user: dict = Depends(get_current_user)):
    st = _get_state(user)
    # Simulate a live P&L tick (mock)
    st["pnl"] = round(st["pnl"] + random.uniform(-5, 12), 2)
    return {**st, "simulated": True}

@router.post("/api/trading-agent/toggle")
def toggle_agent(user: dict = Depends(get_current_user)):
    st = _get_state(user)
    st["status"] = "paused" if st["status"] == "running" else "running"
    return {"status": st["status"], "simulated": True}

@router.get("/api/trading-agent/log")
def get_log(user: dict = Depends(get_current_user)):
    st = _get_state(user)
    return {"log": list(reversed(st["log"][-50:])), "simulated": True}

@router.post("/api/trading-agent/config")
def update_config(config: AgentConfig, user: dict = Depends(get_current_user)):
    with _state_lock:
        _config_by_tenant[_tenant_key(user)] = config.model_dump()
    return {"message": "Configuração atualizada", "config": config.model_dump(), "simulated": True}
