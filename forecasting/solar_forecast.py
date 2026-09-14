"""Solar production forecast based on Open-Meteo weather data.

Irradiance source: prefers global_tilted_irradiance (GTI) -- irradiance on the
actual panel plane, computed by Open-Meteo's own radiative-transfer model from
the site's real tilt/azimuth -- over shortwave_radiation (GHI, flat-horizontal).
A flat, un-tilted panel is not a real installation; using GHI as a stand-in
for panel output biases the forecast, worst in winter at high latitude, where
a well-tilted south-facing panel captures meaningfully more low-angle direct
sun than its horizontal projection suggests. GTI needs the site's tilt_deg/
azimuth_deg (backend.models.Site) -- until those are set, this falls back to
GHI and says so via `orientation_applied: False` on every returned entry.
"""

from forecasting.weather_forecast import get_weather_forecast


def forecast_solar_production(lat: float, lon: float, solar_kw: float, efficiency: float = 0.18,
                              performance_ratio: float = 0.80, hours: int = 48, *,
                              tilt_deg: float | None = None, azimuth_deg: float | None = None,
                              include_metadata: bool = False):
    weather_response = get_weather_forecast(lat, lon, hours=hours, tilt_deg=tilt_deg, azimuth_deg=azimuth_deg,
                                             include_metadata=include_metadata)
    if include_metadata:
        weather = weather_response["forecast"]
    else:
        weather = weather_response
    result = []
    for entry in weather:
        ghi = entry["shortwave_radiation"] or 0.0
        gti = entry.get("global_tilted_irradiance")
        orientation_applied = gti is not None
        irradiance = gti if orientation_applied else ghi
        cloud = entry["cloud_cover"] or 0
        estimated_kwh = (irradiance / 1000.0) * solar_kw * performance_ratio
        temp = entry["temperature_2m"] or 25.0
        estimated_kwh *= 1.0 - max(0, (temp - 25.0) * 0.004)
        capacity_factor = estimated_kwh / solar_kw if solar_kw > 0 else 0
        result.append({"time": entry["time"], "irradiance_wm2": round(irradiance, 1),
                       "ghi_wm2": round(ghi, 1), "orientation_applied": orientation_applied,
                       "cloud_cover_pct": cloud, "temperature_c": temp,
                       "estimated_kwh": round(max(0, estimated_kwh), 3),
                       "capacity_factor": round(min(1.0, max(0, capacity_factor)), 3)})
    if include_metadata:
        weather_response["forecast"] = result
        return weather_response
    return result
