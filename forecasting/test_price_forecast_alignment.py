"""With `start`, prices are the ones for exactly start, start+1h, ... (not the first hours of the day)."""
from datetime import datetime, timedelta, timezone

import pytest

from backend.market import entsoe
from forecasting.price_forecast import DayAheadNotPublished, forecast_market_prices_with_metadata

DAY = datetime(2026, 10, 5, 0, 0, tzinfo=timezone.utc)
GENERATED = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)


def _client(hours_available, skip=()):
    """Fake ENTSO-E client: hourly prices 100, 101, ... from DAY 00:00 UTC; records the window asked for."""
    class Client:
        def __init__(self):
            self.calls = []

        async def get_day_ahead_prices(self, country_code, start=None, end=None):
            self.calls.append((country_code, start, end))
            data = [entsoe.PricePoint(DAY + timedelta(hours=i), 100.0 + i)
                    for i in range(hours_available) if i not in skip]
            return entsoe.EntsoeResponse(success=True, data=data, generated_at=GENERATED, max_age_minutes=120)

    return Client()


@pytest.mark.asyncio
async def test_prices_start_at_the_requested_hour_not_at_midnight(monkeypatch):
    client = _client(48)
    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: client)
    start = datetime(2026, 10, 5, 13, 20, tzinfo=timezone.utc)
    values, provider = await forecast_market_prices_with_metadata("NL", 24, start=start)
    assert values == [113.0 + i for i in range(24)]   # the price for 13:00 first, up to 12:00 the next day
    assert provider.name == "ENTSO-E"
    assert client.calls == [("NL", DAY, DAY + timedelta(days=2))]  # today and tomorrow


@pytest.mark.asyncio
async def test_a_naive_start_is_read_as_utc(monkeypatch):
    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: _client(48))
    values, _ = await forecast_market_prices_with_metadata("NL", 24, start=datetime(2026, 10, 5, 13, 0))
    assert values[0] == 113.0


@pytest.mark.asyncio
async def test_unpublished_tomorrow_is_reported_not_returned_shifted(monkeypatch):
    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: _client(24))  # only today is out
    with pytest.raises(DayAheadNotPublished, match="13:00 CET") as err:
        await forecast_market_prices_with_metadata("NL", 24, start=datetime(2026, 10, 5, 13, 0, tzinfo=timezone.utc))
    assert isinstance(err.value, RuntimeError)  # existing handlers still catch it


@pytest.mark.asyncio
async def test_a_gap_in_the_middle_is_not_papered_over(monkeypatch):
    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: _client(48, skip={20}))
    with pytest.raises(DayAheadNotPublished, match="1 missing"):
        await forecast_market_prices_with_metadata("NL", 24, start=datetime(2026, 10, 5, 13, 0, tzinfo=timezone.utc))


@pytest.mark.asyncio
async def test_without_start_the_legacy_behaviour_is_unchanged(monkeypatch):
    client = _client(48)
    monkeypatch.setattr(entsoe, "get_entsoe_client", lambda: client)
    values, _ = await forecast_market_prices_with_metadata("NL", 24)
    assert values == [100.0 + i for i in range(24)]
    assert client.calls == [("NL", None, None)]
