from datetime import datetime, timezone

from backend.market.entsoe import EntsoeClient


def test_cached_day_ahead_response_exposes_generation_time(monkeypatch):
    client = EntsoeClient(api_key="test")
    generated = datetime(2026, 8, 19, 7, 0, tzinfo=timezone.utc)
    client._cache["dam_PT_x_y"] = ([], generated)
    assert client._cache["dam_PT_x_y"][1] == generated


def test_price_point_parser_produces_timezone_aware_timestamp():
    client = EntsoeClient(api_key="test")
    xml = '''<Publication_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-6:generationloaddocument:3:0">
      <TimeSeries><Period><timeInterval><start>2026-08-19T07:00Z</start></timeInterval>
      <Point><position>1</position><price.amount>50</price.amount></Point></Period></TimeSeries>
    </Publication_MarketDocument>'''
    points = client._parse_price_response(xml)
    assert points[0].timestamp.tzinfo == timezone.utc
