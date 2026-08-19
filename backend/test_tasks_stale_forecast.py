from datetime import datetime, timezone

import pytest

from forecasting.contracts import ForecastBundle, ProviderMetadata
from forecasting.health import require_healthy_bundle


class SolverMustNotRun:
    def optimize(self, portfolio):
        raise AssertionError("solver must not run for stale forecast")


def test_stale_persisted_snapshot_is_blocked_before_solver():
    generated = datetime(2026, 8, 19, 16, 0, tzinfo=timezone.utc)
    now = datetime(2026, 8, 19, 18, 0, tzinfo=timezone.utc)
    bundle = ForecastBundle(
        prices_eur_mwh=[50.0] * 24,
        load_kw=[100.0] * 24,
        solar_kw=[20.0] * 24,
        timestamps=[f"2026-08-19T{hour:02d}:00:00+00:00" for hour in range(24)],
        providers=(
            ProviderMetadata("ENTSO-E", generated.isoformat(), 120),
            ProviderMetadata("load-telemetry", now.isoformat(), 30),
            ProviderMetadata("Open-Meteo", now.isoformat(), 60),
        ),
    )

    with pytest.raises(ValueError, match="ENTSO-E.*stale"):
        require_healthy_bundle(bundle, now=now)
