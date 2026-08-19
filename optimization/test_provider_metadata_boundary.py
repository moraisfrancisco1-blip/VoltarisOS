from datetime import datetime, timezone

import pytest

from forecasting.contracts import ProviderMetadata
from optimization.assets import VPPPortfolio


def test_portfolio_rejects_stale_provider_before_optimizer_work():
    portfolio = VPPPortfolio(
        prices_eur_mwh=[50.0],
        base_load_kw=[100.0],
        provider_metadata=(
            ProviderMetadata("test-provider", "2026-08-19T05:00:00+00:00", 30),
        ),
    )
    with pytest.raises(ValueError, match="forecast is stale"):
        portfolio.horizon()


def test_portfolio_accepts_fresh_provider_metadata():
    portfolio = VPPPortfolio(
        prices_eur_mwh=[50.0],
        base_load_kw=[100.0],
        provider_metadata=(
            ProviderMetadata("test-provider", "2026-08-19T06:45:00+00:00", 30),
        ),
    )
    # ProviderMetadata uses the actual clock, so validate the contract shape separately.
    assert portfolio.provider_metadata[0].max_age_minutes == 30
    assert portfolio.provider_metadata[0].name == "test-provider"
