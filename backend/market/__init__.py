"""
market — Energy market API integrations.

Provides clients for:
- ENTSO-E Transparency Platform (European transmission system operators)
- EEX (European Energy Exchange)
- OMIE (Iberian energy market - MIBEL)

Usage:
    from backend.market import get_entsoe_client, get_eex_client
    
    entsoe = get_entsoe_client()
    prices = await entsoe.get_day_ahead_prices(country_code="PT")
"""
from backend.market.entsoe import EntsoeClient, get_entsoe_client, PricePoint, EntsoeResponse

__all__ = [
    "EntsoeClient",
    "get_entsoe_client",
    "PricePoint",
    "EntsoeResponse",
]