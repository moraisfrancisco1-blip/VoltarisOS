"""
Solar production forecast based on real weather data from Open-Meteo.
Uses shortwave radiation (W/m²) and panel capacity to estimate kWh output.
"""

from forecasting.weather_forecast import get_weather_forecast


def forecast_solar_production(
    lat: float,
    lon: float,
    solar_kw: float,
    efficiency: float = 0.18,
    performance_ratio: float = 0.80,
    hours: int = 48,
) -> list[dict]:
    """
    Forecasts solar energy production for a site.

    Parameters:
        lat, lon        : site coordinates
        solar_kw        : installed peak power (kWp)
        efficiency      : panel efficiency (default 18%)
        performance_ratio: system losses factor (default 80%)
        hours           : forecast horizon in hours

    Returns list of dicts:
        - time
        - irradiance_wm2
        - cloud_cover_pct
        - temperature_c
        - estimated_kwh   : production estimate for that hour
        - capacity_factor : fraction of peak production (0-1)
    """
    weather = get_weather_forecast(lat, lon, hours=hours)

    result = []
    for entry in weather:
        irradiance = entry["shortwave_radiation"] or 0.0
        cloud = entry["cloud_cover"] or 0

        # Simple model: Production = (irradiance / 1000) * solar_kw * performance_ratio
        # 1000 W/m² = STC (Standard Test Conditions) reference
        estimated_kwh = (irradiance / 1000.0) * solar_kw * performance_ratio

        # Temperature derating: panels lose ~0.4% efficiency per °C above 25°C
        temp = entry["temperature_2m"] or 25.0
        temp_derating = 1.0 - max(0, (temp - 25.0) * 0.004)
        estimated_kwh *= temp_derating

        capacity_factor = estimated_kwh / solar_kw if solar_kw > 0 else 0

        result.append({
            "time": entry["time"],
            "irradiance_wm2": round(irradiance, 1),
            "cloud_cover_pct": cloud,
            "temperature_c": temp,
            "estimated_kwh": round(max(0, estimated_kwh), 3),
            "capacity_factor": round(min(1.0, max(0, capacity_factor)), 3),
        })

    return result
