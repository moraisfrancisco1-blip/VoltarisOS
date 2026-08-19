"""Market price forecasting for VoltarisOS.

Production source: ENTSO-E day-ahead market data.
The synthetic generator is retained only as an explicit development fallback.
"""
from __future__ import annotations

import numpy as np
from forecasting.contracts import ProviderMetadata


async def forecast_market_prices(country_code: str = "PT", hours: int = 24, allow_fallback: bool = False) -> list[float]:
    """Return hourly day-ahead prices in EUR/MWh."""
    values, _ = await forecast_market_prices_with_metadata(country_code, hours, allow_fallback=allow_fallback)
    return values


async def forecast_market_prices_with_metadata(country_code: str = "PT", hours: int = 24, allow_fallback: bool = False) -> tuple[list[float], ProviderMetadata]:
    """Return day-ahead prices plus the provider's actual retrieval timestamp."""
    if hours <= 0:
        raise ValueError("hours must be positive")
    from backend.market.entsoe import get_entsoe_client
    client = get_entsoe_client()
    if client is not None:
        response = await client.get_day_ahead_prices(country_code=country_code)
        if response.success and response.data:
            values = [float(point.price_eur_mwh) for point in response.data[:hours]]
            if len(values) >= hours:
                if response.generated_at is None:
                    raise RuntimeError("ENTSO-E response is missing generated_at")
                return values, ProviderMetadata("ENTSO-E", response.generated_at.isoformat(), response.max_age_minutes)
            raise RuntimeError(f"ENTSO-E returned only {len(values)} hourly prices; {hours} required")
        if not allow_fallback:
            raise RuntimeError(response.error or "ENTSO-E returned no day-ahead prices")
    elif not allow_fallback:
        raise RuntimeError("ENTSO-E API client is not configured")
    return forecast_prices(hours=hours), ProviderMetadata("synthetic-dev", "1970-01-01T00:00:00+00:00", 0)


def forecast_prices(hours: int = 24) -> list[float]:
    """Deterministic synthetic prices for tests/development only."""
    if hours <= 0:
        raise ValueError("hours must be positive")
    return [round(60.0 + np.sin(i / 24 * 2 * np.pi) * 20, 2) for i in range(hours)]
