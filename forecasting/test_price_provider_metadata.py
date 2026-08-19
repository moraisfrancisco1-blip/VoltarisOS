from datetime import datetime, timezone

import pytest

from forecasting.contracts import ProviderMetadata
from forecasting.price_forecast import forecast_market_prices_with_metadata


@pytest.mark.asyncio
async def test_price_provider_preserves_entsoe_retrieval_timestamp(monkeypatch):
    from backend.market import entsoe

    generated_at = datetime(2026, 8, 19, 18, 0, tzinfo=timezone.utc)

    class FakeClient:
        async def get_day_ahead_prices(self, country_code):
            return entsoe.EntsoeResponse(
                success=True,
                data=[entsoe.PricePoint(generated_at, 50.0) for _ in range(24)],
                generated_at=generated_at,
                max_age_minutes=120,
            )

    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: FakeClient())
    values, provider = await forecast_market_prices_with_metadata("PT", 24)

    assert len(values) == 24
    assert isinstance(provider, ProviderMetadata)
    assert provider.name == "ENTSO-E"
    assert provider.generated_at == generated_at.isoformat()
    assert provider.max_age_minutes == 120
