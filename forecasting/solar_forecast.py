"""Solar production forecast based on Open-Meteo weather data."""

from forecasting.weather_forecast import get_weather_forecast


def forecast_solar_production(lat: float, lon: float, solar_kw: float, efficiency: float = 0.18,
                              performance_ratio: float = 0.80, hours: int = 48, *, include_metadata: bool = False):
    weather_response = get_weather_forecast(lat, lon, hours=hours, include_metadata=include_metadata)
    if include_metadata:
        weather = weather_response["forecast"]
    else:
        weather = weather_response
    result = []
    for entry in weather:
        irradiance = entry["shortwave_radiation"] or 0.0
        cloud = entry["cloud_cover"] or 0
        estimated_kwh = (irradiance / 1000.0) * solar_kw * performance_ratio
        temp = entry["temperature_2m"] or 25.0
        estimated_kwh *= 1.0 - max(0, (temp - 25.0) * 0.004)
        capacity_factor = estimated_kwh / solar_kw if solar_kw > 0 else 0
        result.append({"time": entry["time"], "irradiance_wm2": round(irradiance, 1),
                       "cloud_cover_pct": cloud, "temperature_c": temp,
                       "estimated_kwh": round(max(0, estimated_kwh), 3),
                       "capacity_factor": round(min(1.0, max(0, capacity_factor)), 3)})
    if include_metadata:
        weather_response["forecast"] = result
        return weather_response
    return result
