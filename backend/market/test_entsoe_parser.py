"""ENTSO-E price documents: any document version, hourly or quarter-hourly, one price per hour."""
from datetime import datetime, timezone

import pytest

from backend.market.entsoe import EntsoeClient

PUBLICATION_NS = "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3"


def _doc(periods, ns=PUBLICATION_NS):
    """periods: [(start 'YYYY-MM-DDTHH:MMZ', resolution or None, [prices])]"""
    body = ""
    for start, resolution, prices in periods:
        res = f"<resolution>{resolution}</resolution>" if resolution else ""
        points = "".join(f"<Point><position>{i}</position><price.amount>{p}</price.amount></Point>"
                         for i, p in enumerate(prices, start=1))
        body += f"<Period><timeInterval><start>{start}</start><end>x</end></timeInterval>{res}{points}</Period>"
    return (f'<Publication_MarketDocument xmlns="{ns}"><mRID>m</mRID>'
            f"<TimeSeries><mRID>1</mRID><currency_Unit.name>EUR</currency_Unit.name>{body}</TimeSeries>"
            "</Publication_MarketDocument>")


@pytest.fixture()
def client():
    return EntsoeClient(api_key="test")


def test_a_price_document_in_the_publication_namespace_is_read(client):
    """Regression: the parser hardcoded the generation/load namespace and found no price at all."""
    points = client._parse_price_response(_doc([("2026-10-04T22:00Z", "PT60M", [80.5 + i for i in range(24)])]))
    assert len(points) == 24
    assert points[0].timestamp == datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
    assert points[0].price_eur_mwh == 80.5 and points[-1].price_eur_mwh == 103.5
    assert points[-1].timestamp == datetime(2026, 10, 5, 21, 0, tzinfo=timezone.utc)


@pytest.mark.parametrize("ns", [
    "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:0",
    "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3",
    "urn:iec62325.351:tc57wg16:451-6:generationloaddocument:3:0",
])
def test_any_document_version_is_accepted(client, ns):
    assert len(client._parse_price_response(_doc([("2026-10-05T10:00Z", "PT60M", [1, 2, 3])], ns=ns))) == 3


def test_quarter_hour_prices_become_one_hourly_average(client):
    # 10:00-10:45 -> 40, 50, 60, 70 (mean 55); 11:00-11:45 -> 10, 20, 30, 40 (mean 25)
    points = client._parse_price_response(_doc([("2026-10-05T10:00Z", "PT15M", [40, 50, 60, 70, 10, 20, 30, 40])]))
    assert [(p.timestamp.hour, p.price_eur_mwh) for p in points] == [(10, 55.0), (11, 25.0)]


def test_quarter_hours_are_not_stretched_into_hours(client):
    # 96 quarter-hour prices for a day are 24 hourly points over 24 hours, not 96 hours of data.
    points = client._parse_price_response(_doc([("2026-10-05T00:00Z", "PT15M", [100.0] * 96)]))
    assert len(points) == 24 and points[-1].timestamp == datetime(2026, 10, 5, 23, 0, tzinfo=timezone.utc)


def test_a_period_without_resolution_is_hourly(client):
    points = client._parse_price_response(_doc([("2026-10-05T10:00Z", None, [5, 6])]))
    assert [p.timestamp.hour for p in points] == [10, 11]


def test_an_unknown_resolution_is_skipped_not_guessed(client):
    points = client._parse_price_response(_doc([("2026-10-05T00:00Z", "P1D", [9.0]),
                                               ("2026-10-05T10:00Z", "PT60M", [7.0])]))
    assert [(p.timestamp.hour, p.price_eur_mwh) for p in points] == [(10, 7.0)]


def test_several_periods_in_one_document_are_merged_in_time_order(client):
    points = client._parse_price_response(_doc([("2026-10-05T12:00Z", "PT60M", [3, 4]),
                                               ("2026-10-05T10:00Z", "PT60M", [1, 2])]))
    assert [(p.timestamp.hour, p.price_eur_mwh) for p in points] == [(10, 1), (11, 2), (12, 3), (13, 4)]


def test_a_document_without_prices_gives_an_empty_list(client):
    ack = ('<Acknowledgement_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-1:acknowledgementdocument:7:0">'
           "<Reason><code>999</code><text>No matching data found</text></Reason></Acknowledgement_MarketDocument>")
    assert client._parse_price_response(ack) == []


def test_malformed_xml_gives_an_empty_list_not_an_exception(client):
    assert client._parse_price_response("<not xml") == []
