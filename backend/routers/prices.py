from fastapi import APIRouter
from datetime import datetime, timedelta
import httpx
import os
from xml.etree import ElementTree as ET

router = APIRouter()

ENTSOE_TOKEN = os.getenv("ENTSOE_TOKEN", "PENDING")
NL_ZONE = "10YNL----------L"
PT_ZONE = "10YPT-REN------W"

def parse_prices(xml_text: str) -> list:
    root = ET.fromstring(xml_text)
    ns = {"ns": "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3"}
    prices = []
    for period in root.findall(".//ns:Period", ns):
        start = period.find("ns:timeInterval/ns:start", ns).text
        resolution = period.find("ns:resolution", ns).text
        minutes = 60 if resolution == "PT60M" else 15
        for i, point in enumerate(period.findall("ns:Point", ns)):
            price = float(point.find("ns:price.amount", ns).text)
            hour = datetime.fromisoformat(start.replace("Z", "+00:00")) + timedelta(minutes=i * minutes)
            prices.append({"hour": hour.strftime("%H:%M"), "price": round(price, 3)})
    return prices

@router.get("/prices/day-ahead")
async def get_day_ahead_prices(zone: str = "NL"):
    area = NL_ZONE if zone == "NL" else PT_ZONE
    now = datetime.utcnow()
    start = now.strftime("%Y%m%d0000")
    end = (now + timedelta(days=1)).strftime("%Y%m%d0000")

    if ENTSOE_TOKEN == "PENDING":
        # Dados simulados até token chegar
        return {
            "zone": zone,
            "source": "simulated",
            "prices": [
                {"hour": f"{h:02d}:00", "price": round(0.05 + 0.12 * abs((h - 12) / 12), 3)}
                for h in range(24)
            ]
        }

    url = "https://transparency.entsoe.eu/api"
    params = {
        "securityToken": ENTSOE_TOKEN,
        "documentType": "A44",
        "in_Domain": area,
        "out_Domain": area,
        "periodStart": start,
        "periodEnd": end,
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params=params, timeout=10)
        prices = parse_prices(res.text)
        return {"zone": zone, "source": "entsoe", "prices": prices}