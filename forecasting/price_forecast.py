"""Market price forecasting for VoltarisOS.

Production source: ENTSO-E day-ahead market data.
The synthetic generator is retained only as an explicit development fallback.
"""
from __future__ import annotations

import numpy as np


async def forecast_market_prices(country_code: str = "PT", hours: int = 24, allow_fallback: bool = False) -> list[float]:
    """Return hourly day-ahead prices in EUR/MWh."""
    if hours <= 0:
        raise ValueError("hours must be positive")

    from backend.market.entsoe import get_entsoe_client
    client = get_entsoe_client()
    if client is not None:
        response = await client.get_day_ahead_prices(country_code=country_code)
        if response.success and response.data:
            values = [float(point.price_eur_mwh) for point in response.data[:hours]]
            if len(values) >= hours:
                return values
            raise RuntimeError(f"ENTSO-E returned only {len(values)} hourly prices; {hours} required")
        if not allow_fallback:
            raise RuntimeError(response.error or "ENTSO-E returned no day-ahead prices")
    elif not allow_fallback:
        raise RuntimeError("ENTSO-E API client is not configured")

    return forecast_prices(hours=hours)


def forecast_prices(hours: int = 24) -> list[float]:
    """Deterministic synthetic prices for tests/development only."""
    if hours <= 0:
        raise ValueError("hours must be positive")
    return [round(60.0 + np.sin(i / 24 * 2 * np.pi) * 20, 2) for i in range(hours)]
