"""
Combined forecast: weather + solar production + price forecast per site.
Used by the optimizer to make charge/discharge decisions.
"""

from forecasting.solar_forecast import forecast_solar_production
from forecasting.price_forecast import forecast_prices


def get_full_forecast(
    lat: float,
    lon: float,
    solar_kw: float,
    hours: int = 48,
) -> list[dict]:
    """
    Returns combined forecast with solar production + price per hour.

    Each entry:
        - time
        - irradiance_wm2
        - cloud_cover_pct
        - temperature_c
        - estimated_kwh
        - capacity_factor
        - price_eur_mwh     : forecasted electricity price
        - recommendation    : 'charge' | 'discharge' | 'hold'
    """
    solar = forecast_solar_production(lat, lon, solar_kw, hours=hours)
    prices = forecast_prices()  # 24h prices

    # Extend prices to match forecast length by repeating daily pattern
    extended_prices = (prices * ((hours // 24) + 2))[:hours]

    result = []
    for i, entry in enumerate(solar):
        price = extended_prices[i] if i < len(extended_prices) else 60.0

        # Simple recommendation logic (same logic as ai_optimizer but weather-aware)
        kwh = entry["estimated_kwh"]
        if price < 50 and kwh < 0.1:
            recommendation = "charge"  # low price, no solar → buy from grid
        elif price > 90 and kwh < solar_kw * 0.3:
            recommendation = "discharge"  # high price, low solar → sell battery
        elif kwh > solar_kw * 0.7:
            recommendation = "export"  # strong solar → export excess
        else:
            recommendation = "hold"

        result.append({
            **entry,
            "price_eur_mwh": round(float(price), 2),
            "recommendation": recommendation,
        })

    return result
