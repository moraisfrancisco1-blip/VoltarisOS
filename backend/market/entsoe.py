"""ENTSO-E Transparency Platform API integration."""
import httpx
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PricePoint:
    timestamp: datetime
    price_eur_mwh: float
    currency: str = "EUR"
    unit: str = "MWh"


@dataclass
class EntsoeResponse:
    success: bool
    data: List[PricePoint]
    error: Optional[str] = None
    cached: bool = False
    generated_at: Optional[datetime] = None
    max_age_minutes: int = 120


class EntsoeClient:
    DOC_TYPE_DAY_AHEAD = "A44"
    DOC_TYPE_INTRADAY = "A45"
    DOC_TYPE_GENERATION_FORECAST = "A71"
    DOC_TYPE_LOAD_FORECAST = "A65"
    DOC_TYPE_PHYSICAL_FLOW = "A11"
    COUNTRY_CODES = {
        "PT": "10YPT-REN------W", "ES": "10YES-REE------0", "FR": "10YFR-RTE------C",
        "DE": "10Y1001A1001A83F", "NL": "10YNL----------L", "BE": "10YBE----------2",
        "IT": "10YIT-GRTN-----B", "GB": "10YGB----------A",
    }

    def __init__(self, api_key: str, base_url: str = "https://web-api.tp.entsoe.eu/api"):
        self.api_key = api_key
        self.base_url = base_url
        self._cache: Dict[str, tuple] = {}
        self._cache_ttl = 900

    async def get_day_ahead_prices(self, country_code: str = "PT", start: Optional[datetime] = None, end: Optional[datetime] = None) -> EntsoeResponse:
        if start is None:
            start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        if end is None:
            end = start + timedelta(days=1)
        cache_key = f"dam_{country_code}_{start.isoformat()}_{end.isoformat()}"
        if cache_key in self._cache:
            cached_data, cached_time = self._cache[cache_key]
            if (datetime.now(timezone.utc) - cached_time).total_seconds() < self._cache_ttl:
                return EntsoeResponse(success=True, data=cached_data, cached=True, generated_at=cached_time)
        area_code = self.COUNTRY_CODES.get(country_code.upper())
        if not area_code:
            return EntsoeResponse(success=False, data=[], error=f"Unknown country code: {country_code}")
        params = {"securityToken": self.api_key, "documentType": self.DOC_TYPE_DAY_AHEAD, "in_Domain": area_code, "out_Domain": area_code,
                  "periodStart": start.strftime("%Y%m%d%H%M"), "periodEnd": end.strftime("%Y%m%d%H%M")}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                prices = self._parse_price_response(response.text)
                generated_at = datetime.now(timezone.utc)
                self._cache[cache_key] = (prices, generated_at)
                return EntsoeResponse(success=True, data=prices, generated_at=generated_at)
        except httpx.HTTPStatusError as e:
            logger.error(f"ENTSO-E API error: {e.response.status_code} - {e.response.text}")
            return EntsoeResponse(success=False, data=[], error=f"HTTP {e.response.status_code}")
        except Exception as e:
            logger.error(f"ENTSO-E client error: {e}")
            return EntsoeResponse(success=False, data=[], error=str(e))

    async def get_intraday_prices(self, country_code: str = "PT", start: Optional[datetime] = None, end: Optional[datetime] = None) -> EntsoeResponse:
        if start is None:
            start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        if end is None:
            end = start + timedelta(hours=6)
        area_code = self.COUNTRY_CODES.get(country_code.upper())
        if not area_code:
            return EntsoeResponse(success=False, data=[], error=f"Unknown country code: {country_code}")
        params = {"securityToken": self.api_key, "documentType": self.DOC_TYPE_INTRADAY, "in_Domain": area_code, "out_Domain": area_code,
                  "periodStart": start.strftime("%Y%m%d%H%M"), "periodEnd": end.strftime("%Y%m%d%H%M")}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                generated_at = datetime.now(timezone.utc)
                return EntsoeResponse(success=True, data=self._parse_price_response(response.text), generated_at=generated_at)
        except Exception as e:
            logger.error(f"ENTSO-E intraday error: {e}")
            return EntsoeResponse(success=False, data=[], error=str(e))

    async def get_generation_forecast(self, country_code: str = "PT", start: Optional[datetime] = None, end: Optional[datetime] = None) -> EntsoeResponse:
        if start is None:
            start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        if end is None:
            end = start + timedelta(days=2)
        area_code = self.COUNTRY_CODES.get(country_code.upper())
        if not area_code:
            return EntsoeResponse(success=False, data=[], error=f"Unknown country code: {country_code}")
        params = {"securityToken": self.api_key, "documentType": self.DOC_TYPE_GENERATION_FORECAST, "in_Domain": area_code, "out_Domain": area_code,
                  "periodStart": start.strftime("%Y%m%d%H%M"), "periodEnd": end.strftime("%Y%m%d%H%M")}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                generated_at = datetime.now(timezone.utc)
                return EntsoeResponse(success=True, data=self._parse_price_response(response.text), generated_at=generated_at)
        except Exception as e:
            logger.error(f"ENTSO-E generation forecast error: {e}")
            return EntsoeResponse(success=False, data=[], error=str(e))

    def _parse_price_response(self, xml_text: str) -> List[PricePoint]:
        import xml.etree.ElementTree as ET
        prices = []
        try:
            root = ET.fromstring(xml_text)
            ns = {"pub": "urn:iec62325.351:tc57wg16:451-6:generationloaddocument:3:0"}
            for ts in root.findall(".//pub:TimeSeries", ns):
                for period in ts.findall(".//pub:Period", ns):
                    start_str = period.find("pub:timeInterval/pub:start", ns)
                    if start_str is None:
                        continue
                    period_start = datetime.strptime(start_str.text, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
                    for point in period.findall("pub:Point", ns):
                        position = point.find("pub:position", ns)
                        price = point.find("pub:price.amount", ns)
                        if position is not None and price is not None:
                            timestamp = period_start + timedelta(hours=int(position.text) - 1)
                            prices.append(PricePoint(timestamp=timestamp, price_eur_mwh=float(price.text)))
        except ET.ParseError as e:
            logger.error(f"XML parse error: {e}")
        return prices

    def clear_cache(self):
        self._cache.clear()


_entsoe_client: Optional[EntsoeClient] = None


def get_entsoe_client() -> Optional[EntsoeClient]:
    global _entsoe_client
    if _entsoe_client is None:
        from backend.config import settings
        if settings.ENTSOE_API_KEY:
            _entsoe_client = EntsoeClient(api_key=settings.ENTSOE_API_KEY, base_url=settings.ENTSOE_BASE_URL)
    return _entsoe_client
