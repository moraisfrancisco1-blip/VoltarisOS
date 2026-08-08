"""
entsoe.py — ENTSO-E Transparency Platform API integration.

Fetches real-time and historical energy market data from ENTSO-E:
- Day-ahead prices (DAM)
- Intraday prices (IDM)
- Generation forecasts
- Load forecasts
- Cross-border flows

API Documentation: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html

Usage:
    from backend.market.entsoe import EntsoeClient
    
    client = EntsoeClient(api_key="your-api-key")
    prices = await client.get_day_ahead_prices(
        country_code="PT",
        start=datetime(2026, 8, 8),
        end=datetime(2026, 8, 9),
    )
"""
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PricePoint:
    """Hourly price point."""
    timestamp: datetime
    price_eur_mwh: float
    currency: str = "EUR"
    unit: str = "MWh"


@dataclass
class EntsoeResponse:
    """Standardized ENTSO-E API response."""
    success: bool
    data: List[PricePoint]
    error: Optional[str] = None
    cached: bool = False


class EntsoeClient:
    """
    ENTSO-E Transparency Platform API client.
    
    Supports:
    - Day-ahead market prices (A44)
    - Intraday market prices (A45)
    - Generation forecast (A71)
    - Load forecast (A65)
    - Cross-border physical flows (A11)
    """
    
    # ENTSO-E document types
    DOC_TYPE_DAY_AHEAD = "A44"
    DOC_TYPE_INTRADAY = "A45"
    DOC_TYPE_GENERATION_FORECAST = "A71"
    DOC_TYPE_LOAD_FORECAST = "A65"
    DOC_TYPE_PHYSICAL_FLOW = "A11"
    
    # Country mapping (ENTSO-E area codes)
    COUNTRY_CODES = {
        "PT": "10YPT-REN------W",  # Portugal
        "ES": "10YES-REE------0",  # Spain
        "FR": "10YFR-RTE------C",  # France
        "DE": "10Y1001A1001A83F",  # Germany
        "NL": "10YNL----------L",  # Netherlands
        "BE": "10YBE----------2",  # Belgium
        "IT": "10YIT-GRTN-----B",  # Italy
        "GB": "10YGB----------A",  # Great Britain
    }
    
    def __init__(self, api_key: str, base_url: str = "https://web-api.tp.entsoe.eu/api"):
        self.api_key = api_key
        self.base_url = base_url
        self._cache: Dict[str, tuple] = {}  # Simple in-memory cache
        self._cache_ttl = 900  # 15 minutes
    
    async def get_day_ahead_prices(
        self,
        country_code: str = "PT",
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> EntsoeResponse:
        """
        Fetch day-ahead market prices.
        
        Args:
            country_code: ISO 2-letter country code (PT, ES, FR, etc.)
            start: Start datetime (defaults to today 00:00)
            end: End datetime (defaults to tomorrow 00:00)
        
        Returns:
            EntsoeResponse with hourly price points
        """
        if start is None:
            start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        if end is None:
            end = start + timedelta(days=1)
        
        # Check cache
        cache_key = f"dam_{country_code}_{start.isoformat()}_{end.isoformat()}"
        if cache_key in self._cache:
            cached_data, cached_time = self._cache[cache_key]
            if (datetime.utcnow() - cached_time).total_seconds() < self._cache_ttl:
                return EntsoeResponse(success=True, data=cached_data, cached=True)
        
        area_code = self.COUNTRY_CODES.get(country_code.upper())
        if not area_code:
            return EntsoeResponse(success=False, data=[], error=f"Unknown country code: {country_code}")
        
        params = {
            "securityToken": self.api_key,
            "documentType": self.DOC_TYPE_DAY_AHEAD,
            "in_Domain": area_code,
            "out_Domain": area_code,
            "periodStart": start.strftime("%Y%m%d%H%M"),
            "periodEnd": end.strftime("%Y%m%d%H%M"),
        }
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                
                prices = self._parse_price_response(response.text)
                
                # Cache the result
                self._cache[cache_key] = (prices, datetime.utcnow())
                
                return EntsoeResponse(success=True, data=prices)
        
        except httpx.HTTPStatusError as e:
            logger.error(f"ENTSO-E API error: {e.response.status_code} - {e.response.text}")
            return EntsoeResponse(success=False, data=[], error=f"HTTP {e.response.status_code}")
        
        except Exception as e:
            logger.error(f"ENTSO-E client error: {e}")
            return EntsoeResponse(success=False, data=[], error=str(e))
    
    async def get_intraday_prices(
        self,
        country_code: str = "PT",
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> EntsoeResponse:
        """Fetch intraday market prices."""
        if start is None:
            start = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        if end is None:
            end = start + timedelta(hours=6)
        
        area_code = self.COUNTRY_CODES.get(country_code.upper())
        if not area_code:
            return EntsoeResponse(success=False, data=[], error=f"Unknown country code: {country_code}")
        
        params = {
            "securityToken": self.api_key,
            "documentType": self.DOC_TYPE_INTRADAY,
            "in_Domain": area_code,
            "out_Domain": area_code,
            "periodStart": start.strftime("%Y%m%d%H%M"),
            "periodEnd": end.strftime("%Y%m%d%H%M"),
        }
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                prices = self._parse_price_response(response.text)
                return EntsoeResponse(success=True, data=prices)
        
        except Exception as e:
            logger.error(f"ENTSO-E intraday error: {e}")
            return EntsoeResponse(success=False, data=[], error=str(e))
    
    async def get_generation_forecast(
        self,
        country_code: str = "PT",
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> EntsoeResponse:
        """Fetch generation forecast (solar, wind, etc.)."""
        if start is None:
            start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        if end is None:
            end = start + timedelta(days=2)
        
        area_code = self.COUNTRY_CODES.get(country_code.upper())
        if not area_code:
            return EntsoeResponse(success=False, data=[], error=f"Unknown country code: {country_code}")
        
        params = {
            "securityToken": self.api_key,
            "documentType": self.DOC_TYPE_GENERATION_FORECAST,
            "in_Domain": area_code,
            "out_Domain": area_code,
            "periodStart": start.strftime("%Y%m%d%H%M"),
            "periodEnd": end.strftime("%Y%m%d%H%M"),
        }
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                prices = self._parse_price_response(response.text)
                return EntsoeResponse(success=True, data=prices)
        
        except Exception as e:
            logger.error(f"ENTSO-E generation forecast error: {e}")
            return EntsoeResponse(success=False, data=[], error=str(e))
    
    def _parse_price_response(self, xml_text: str) -> List[PricePoint]:
        """Parse ENTSO-E XML response into PricePoint list."""
        import xml.etree.ElementTree as ET
        
        prices = []
        
        try:
            root = ET.fromstring(xml_text)
            
            # Define namespaces
            ns = {
                "pub": "urn:iec62325.351:tc57wg16:451-6:generationloaddocument:3:0"
            }
            
            # Find all time series
            for ts in root.findall(".//pub:TimeSeries", ns):
                for period in ts.findall(".//pub:Period", ns):
                    start_str = period.find("pub:timeInterval/pub:start", ns)
                    if start_str is None:
                        continue
                    
                    period_start = datetime.strptime(start_str.text, "%Y-%m-%dT%H:%MZ")
                    
                    for point in period.findall("pub:Point", ns):
                        position = point.find("pub:position", ns)
                        price = point.find("pub:price.amount", ns)
                        
                        if position is not None and price is not None:
                            hour_offset = int(position.text) - 1
                            timestamp = period_start + timedelta(hours=hour_offset)
                            prices.append(PricePoint(
                                timestamp=timestamp,
                                price_eur_mwh=float(price.text),
                            ))
        
        except ET.ParseError as e:
            logger.error(f"XML parse error: {e}")
        
        return prices
    
    def clear_cache(self):
        """Clear the price cache."""
        self._cache.clear()


# Global client instance (initialized lazily)
_entsoe_client: Optional[EntsoeClient] = None


def get_entsoe_client() -> Optional[EntsoeClient]:
    """Get or create the global ENTSO-E client."""
    global _entsoe_client
    
    if _entsoe_client is None:
        from backend.config import settings
        if settings.ENTSOE_API_KEY:
            _entsoe_client = EntsoeClient(
                api_key=settings.ENTSOE_API_KEY,
                base_url=settings.ENTSOE_BASE_URL,
            )
    
    return _entsoe_client