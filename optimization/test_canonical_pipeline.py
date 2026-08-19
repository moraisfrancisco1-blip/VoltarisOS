from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle, ProviderMetadata
from optimization.canonical_pipeline import optimize_forecast


def test_canonical_pipeline_blocks_stale_provider_before_optimization():
    forecast = ForecastBundle(
        prices_eur_mwh=[50.0] * 24,
        load_kw=[100.0] * 24,
        solar_kw=[20.0] * 24,
        timestamps=[f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)],
        providers=(ProviderMetadata("Open-Meteo", "2026-08-19T05:00:00+00:00", 30),),
    )
    with pytest.raises(ValueError, match="Open-Meteo.*stale"):
        optimize_forecast(
            forecast,
            lambda _: (_ for _ in ()).throw(AssertionError("portfolio must not be built")),
            now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc),
        )
