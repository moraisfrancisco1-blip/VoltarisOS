"""forecast_solar_production must prefer tilted (GTI) irradiance over flat
horizontal (GHI) once a site's orientation is known, and must say so on every
returned entry -- never silently pass off a flat-panel approximation as the
real forecast."""
from forecasting.solar_forecast import forecast_solar_production


def _fake_weather(*, with_gti: bool):
    def _inner(lat, lon, hours=48, *, tilt_deg=None, azimuth_deg=None, include_metadata=False):
        assert (lat, lon) == (51.9225, 4.4792)
        entries = []
        for i in range(hours):
            entry = {
                "time": f"2026-01-10T{i % 24:02d}:00",
                "shortwave_radiation": 200.0,
                "temperature_2m": 10.0,  # below 25C -> no thermal derating, keeps the math simple
                "cloud_cover": 20,
                "wind_speed_10m": 3.0,
                "precipitation": 0.0,
            }
            if with_gti:
                assert (tilt_deg, azimuth_deg) == (35.0, 0.0)
                # A tilted, south-facing panel catching low winter sun sees more
                # than the flat-horizontal projection -- GTI > GHI is expected here.
                entry["global_tilted_irradiance"] = 260.0
            else:
                assert (tilt_deg, azimuth_deg) == (None, None)
            entries.append(entry)
        return entries
    return _inner


def test_uses_tilted_irradiance_when_orientation_is_known(monkeypatch):
    monkeypatch.setattr("forecasting.solar_forecast.get_weather_forecast", _fake_weather(with_gti=True))
    result = forecast_solar_production(51.9225, 4.4792, solar_kw=10.0, hours=2, tilt_deg=35.0, azimuth_deg=0.0)

    assert len(result) == 2
    for entry in result:
        assert entry["orientation_applied"] is True
        assert entry["irradiance_wm2"] == 260.0  # GTI drives the estimate
        assert entry["ghi_wm2"] == 200.0         # GHI still reported, just not used for the estimate

    ghi_only_kwh = (200.0 / 1000.0) * 10.0 * 0.80
    assert result[0]["estimated_kwh"] > round(ghi_only_kwh, 3)


def test_falls_back_to_ghi_without_orientation(monkeypatch):
    monkeypatch.setattr("forecasting.solar_forecast.get_weather_forecast", _fake_weather(with_gti=False))
    result = forecast_solar_production(51.9225, 4.4792, solar_kw=10.0, hours=2)

    for entry in result:
        assert entry["orientation_applied"] is False
        assert entry["irradiance_wm2"] == 200.0
        assert entry["ghi_wm2"] == 200.0
