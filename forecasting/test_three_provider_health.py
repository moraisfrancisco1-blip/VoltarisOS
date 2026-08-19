from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle, ProviderMetadata
from forecasting.health import require_healthy_bundle


def test_one_stale_provider_blocks_complete_forecast_bundle():
    bundle = ForecastBundle(
        prices_eur_mwh=[50.0] * 24,
        load_kw=[100.0] * 24,
        solar_kw=[20.0] * 24,
        timestamps=[f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)],
        providers=(
            ProviderMetadata("ENTSO-E", "2026-08-19T06:55:00+00:00", 30),
            ProviderMetadata("load-telemetry", "2026-08-19T06:50:00+00:00", 30),
            ProviderMetadata("Open-Meteo", "2026-08-19T06:00:00+00:00", 30),
        ),
    )
    with pytest.raises(ValueError, match="Open-Meteo.*stale"):
        require_healthy_bundle(bundle, now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))
