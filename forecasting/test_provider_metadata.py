from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle, ProviderMetadata
from forecasting.health import assess_bundle_health, require_healthy_bundle


def test_each_provider_is_checked_independently():
    bundle = ForecastBundle(
        prices_eur_mwh=[50.0] * 2,
        load_kw=[100.0] * 2,
        solar_kw=[20.0] * 2,
        timestamps=["2026-08-19T06:00:00+00:00", "2026-08-19T07:00:00+00:00"],
        providers=(
            ProviderMetadata("ENTSO-E", "2026-08-19T06:55:00+00:00", 30),
            ProviderMetadata("load-telemetry", "2026-08-19T06:50:00+00:00", 30),
            ProviderMetadata("Open-Meteo", "2026-08-19T05:00:00+00:00", 30),
        ),
    )
    health = assess_bundle_health(bundle, now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))
    assert [item.healthy for item in health] == [True, True, False]
    assert health[2].name == "Open-Meteo"


def test_any_unhealthy_provider_blocks_bundle():
    bundle = ForecastBundle(
        prices_eur_mwh=[50.0] * 2,
        load_kw=[100.0] * 2,
        solar_kw=[20.0] * 2,
        timestamps=["2026-08-19T06:00:00+00:00", "2026-08-19T07:00:00+00:00"],
        providers=(ProviderMetadata("ENTSO-E", "2026-08-19T06:55:00+00:00", 30),
                   ProviderMetadata("Open-Meteo", "2026-08-19T05:00:00+00:00", 30)),
    )
    with pytest.raises(ValueError, match="Open-Meteo"):
        require_healthy_bundle(bundle, now=datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc))
