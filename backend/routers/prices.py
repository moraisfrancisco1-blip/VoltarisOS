from fastapi import APIRouter
from datetime import datetime, timedelta
import httpx
import os
from xml.etree import ElementTree as ET

router = APIRouter()

ENTSOE_TOKEN = "ebdcc2e4-482b-4e28-9ec7-67097b3875d6"
NL_ZONE = "10YNL----------L"
PT_ZONE = "10YPT-REN------W"

def parse_prices(xml_text: str) -> list:
    root = ET.fromstring(xml_text)
    ns = {"ns": "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:3"}
    prices = []
    for period in root.findall(".//ns:Period", ns):
        start_elem = period.find("ns:timeInterval/ns:start", ns)
        resolution_elem = period.find("ns:resolution", ns)
        if start_elem is None or resolution_elem is None or start_elem.text is None:
            continue
        start = start_elem.text
        resolution = resolution_elem.text or ""
        minutes = 60 if resolution == "PT60M" else 15
        for i, point in enumerate(period.findall("ns:Point", ns)):
            price_elem = point.find("ns:price.amount", ns)
            if price_elem is None or price_elem.text is None:
                continue
            price = float(price_elem.text)
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
        return {
            "zone": zone,
            "source": "simulated",
            "prices": [
                {"hour": f"{h:02d}:00", "price": round(0.05 + 0.12 * abs((h - 12) / 12), 3)}
                for h in range(24)
            ]
        }

    url = "https://web-api.tp.entsoe.eu/api"
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
        if res.status_code != 200:
            return {"error": res.text[:500]}
        prices = parse_prices(res.text)
        return {"zone": zone, "source": "entsoe", "prices": prices}