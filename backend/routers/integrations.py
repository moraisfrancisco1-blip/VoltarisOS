"""
integrations.py — Settings > API Keys: real status for the market-data
provider credentials the backend actually reads from its own environment
(ENTSOE_API_KEY, EEX_API_KEY -- see backend/config.py and
backend/market/entsoe.py). Settings.jsx used to show these with a
completely fabricated masked value that had nothing to do with the real
env vars a platform admin sets in Railway -- this reports the real
configured/not-configured state instead, never the secret value itself
(same "configured" pattern used by oauth_connections.py and
white_label.py).

Weather forecasting is deliberately NOT listed here: it runs on
Open-Meteo (forecasting/weather_forecast.py), a free API that needs no
key at all -- there is nothing to configure.

    GET /api/integrations/status
"""
from fastapi import APIRouter, Depends

from backend.config import settings
from backend.security import require_admin

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/status")
def integrations_status(current_user: dict = Depends(require_admin)):
    return [
        {
            "key": "entsoe",
            "label": "ENTSO-E (day-ahead prices)",
            "configured": bool(settings.ENTSOE_API_KEY),
            "env_var": "ENTSOE_API_KEY",
        },
        {
            "key": "eex",
            "label": "EEX (market data)",
            "configured": bool(settings.EEX_API_KEY),
            "env_var": "EEX_API_KEY",
        },
    ]
