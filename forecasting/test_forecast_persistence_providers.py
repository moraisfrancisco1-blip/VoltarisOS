from datetime import datetime, timezone

from forecasting.contracts import ForecastBundle, ProviderMetadata
from forecasting.persistence import bundle_from_record, record_from_bundle


class FakeForecastRecord:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class FakeModels:
    ForecastRecord = FakeForecastRecord


def test_all_provider_metadata_survives_persistence_round_trip():
    generated = datetime(2026, 8, 19, 18, 0, tzinfo=timezone.utc)
    bundle = ForecastBundle(
        prices_eur_mwh=[50.0, 51.0],
        load_kw=[100.0, 101.0],
        solar_kw=[20.0, 21.0],
        timestamps=["2026-08-19T18:00:00+00:00", "2026-08-19T19:00:00+00:00"],
        providers=(
            ProviderMetadata("ENTSO-E", generated.isoformat(), 120),
            ProviderMetadata("load-telemetry", generated.isoformat(), 30),
            ProviderMetadata("Open-Meteo", generated.isoformat(), 60),
        ),
    )
    record = record_from_bundle(FakeModels, 7, bundle, now=generated)
    restored = bundle_from_record(record)

    assert restored.prices_eur_mwh == bundle.prices_eur_mwh
    assert restored.load_kw == bundle.load_kw
    assert restored.solar_kw == bundle.solar_kw
    assert [(p.name, p.generated_at, p.max_age_minutes) for p in restored.providers] == [
        (p.name, p.generated_at, p.max_age_minutes) for p in bundle.providers
    ]
