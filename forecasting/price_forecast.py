"""Market price forecasting for VoltarisOS.

Production source: ENTSO-E day-ahead market data.
The synthetic generator is retained only as an explicit development fallback.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
from forecasting.contracts import ProviderMetadata


async def forecast_market_prices(country_code: str = "PT", hours: int = 24, allow_fallback: bool = False) -> list[float]:
    """Return hourly day-ahead prices in EUR/MWh."""
    values, _ = await forecast_market_prices_with_metadata(country_code, hours, allow_fallback=allow_fallback)
    return values


class DayAheadNotPublished(RuntimeError):
    """The market has not yet published prices for every hour that was asked for. Expected, not a
    fault: tomorrow's day-ahead prices come out around 13:00 CET, so a 24-hour look-ahead started
    late in the day or early in the morning cannot be filled until then."""


def _utc_hour(moment: datetime) -> datetime:
    moment = moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment.astimezone(timezone.utc)
    return moment.replace(minute=0, second=0, microsecond=0)


async def forecast_market_prices_with_metadata(country_code: str = "PT", hours: int = 24, allow_fallback: bool = False,
                                               start: datetime | None = None) -> tuple[list[float], ProviderMetadata]:
    """Return day-ahead prices plus the provider's actual retrieval timestamp.

    Without `start` the first `hours` prices of today's market day are returned (legacy behaviour,
    not tied to a clock hour). With `start`, the prices are the ones for exactly the hours
    start, start+1h, ... so they line up with the forecast's timestamps; if the market has not
    published all of them yet, DayAheadNotPublished is raised instead of returning shifted data."""
    if hours <= 0:
        raise ValueError("hours must be positive")
    from backend.market.entsoe import get_entsoe_client
    client = get_entsoe_client()
    if client is not None:
        if start is None:
            response = await client.get_day_ahead_prices(country_code=country_code)
        else:
            first_hour = _utc_hour(start)
            day = first_hour.replace(hour=0)
            # Two market days, so a window that runs past midnight still finds tomorrow's prices.
            response = await client.get_day_ahead_prices(country_code=country_code, start=day, end=day + timedelta(days=2))
        if response.success and response.data:
            if start is None:
                values = [float(point.price_eur_mwh) for point in response.data[:hours]]
            else:
                by_hour = {_utc_hour(point.timestamp): float(point.price_eur_mwh) for point in response.data}
                wanted = [first_hour + timedelta(hours=i) for i in range(hours)]
                missing = [h for h in wanted if h not in by_hour]
                if missing:
                    raise DayAheadNotPublished(
                        f"ENTSO-E day-ahead prices do not cover the next {hours} hours yet "
                        f"({len(missing)} missing, first at {missing[0].isoformat()}); "
                        "tomorrow's prices are published around 13:00 CET")
                values = [by_hour[h] for h in wanted]
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
