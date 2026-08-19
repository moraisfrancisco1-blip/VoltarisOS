from datetime import datetime, timezone

from forecasting.contracts import ForecastBundle, ProviderMetadata
from forecasting.persistence import bundle_from_record


def test_persisted_forecast_reconstructs_operational_bundle():
    generated = datetime(2026, 8, 19, 18, 0, tzinfo=timezone.utc)

    class Record:
        prices_eur_mwh = [50.0] * 24
        load_kw = [100.0] * 24
        solar_kw = [20.0] * 24
        timestamps = [f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)]
        providers = [
            {"name": "ENTSO-E", "generated_at": generated.isoformat(), "max_age_minutes": 120},
            {"name": "load-telemetry", "generated_at": generated.isoformat(), "max_age_minutes": 30},
            {"name": "Open-Meteo", "generated_at": generated.isoformat(), "max_age_minutes": 60},
        ]

    bundle = bundle_from_record(Record())

    assert isinstance(bundle, ForecastBundle)
    assert len(bundle.prices_eur_mwh) == 24
    assert len(bundle.load_kw) == 24
    assert len(bundle.solar_kw) == 24
    assert [provider.name for provider in bundle.providers] == ["ENTSO-E", "load-telemetry", "Open-Meteo"]
    assert all(provider.generated_at == generated.isoformat() for provider in bundle.providers)
