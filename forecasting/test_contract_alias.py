from datetime import datetime, timezone

from forecasting.contracts import ForecastBundle as ContractsBundle
from forecasting.forecast_bundle import ForecastBundle as PublicBundle


def test_forecast_bundle_has_one_canonical_contract():
    assert PublicBundle is ContractsBundle
    bundle = PublicBundle(
        prices_eur_mwh=[10.0, 20.0],
        load_kw=[100.0, 110.0],
        solar_kw=[0.0, 10.0],
        timestamps=[
            "2026-08-19T06:00:00+00:00",
            "2026-08-19T07:00:00+00:00",
        ],
    )
    bundle.validate(2, now=datetime(2026, 8, 19, 6, tzinfo=timezone.utc))
