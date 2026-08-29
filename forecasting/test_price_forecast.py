import pytest

from datetime import datetime, timezone

from forecasting.price_forecast import forecast_market_prices


@pytest.mark.asyncio
async def test_market_price_forecast_uses_entsoe(monkeypatch):
    class Point:
        def __init__(self, value):
            self.price_eur_mwh = value

    class Response:
        success = True
        error = None
        data = [Point(42 + i) for i in range(24)]
        generated_at = datetime(2026, 8, 19, 6, 0, tzinfo=timezone.utc)
        max_age_minutes = 120

    class Client:
        async def get_day_ahead_prices(self, country_code="PT"):
            assert country_code == "PT"
            return Response()

    monkeypatch.setattr("backend.market.entsoe.get_entsoe_client", lambda: Client())
    prices = await forecast_market_prices("PT", 24)
    assert prices == [42 + i for i in range(24)]


@pytest.mark.asyncio
async def test_market_price_forecast_fails_closed_without_client(monkeypatch):
    monkeypatch.setattr("backend.market.entsoe.get_entsoe_client", lambda: None)
    with pytest.raises(RuntimeError, match="not configured"):
        await forecast_market_prices("PT", 24)


@pytest.mark.asyncio
async def test_market_price_forecast_can_explicitly_fallback(monkeypatch):
    monkeypatch.setattr("backend.market.entsoe.get_entsoe_client", lambda: None)
    prices = await forecast_market_prices("PT", 24, allow_fallback=True)
    assert len(prices) == 24
    assert prices[0] == 60.0
