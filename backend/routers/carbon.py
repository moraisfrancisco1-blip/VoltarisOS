from fastapi import APIRouter
import random, datetime

router = APIRouter()

CO2_PER_KWH = 0.233  # kg CO2 per kWh (EU grid average)

def gen_monthly():
    months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
    now = datetime.datetime.utcnow().month
    return [
        {
            "month": months[i],
            "co2_avoided": round(random.uniform(3200, 8500), 1),
            "kwh": round(random.uniform(13000, 36000), 0),
            "certificates": round(random.uniform(12, 36), 1),
        }
        for i in range(min(now, 12))
    ]

@router.get("/api/carbon/overview")
def carbon_overview():
    solar_today_kwh = round(random.uniform(1600, 2200), 1)
    co2_today = round(solar_today_kwh * CO2_PER_KWH, 1)
    co2_month = round(co2_today * 22, 1)
    co2_year = round(co2_month * 8.4, 1)
    return {
        "co2_today_kg": co2_today,
        "co2_month_kg": co2_month,
        "co2_year_kg": co2_year,
        "solar_today_kwh": solar_today_kwh,
        "certificates_month": round(solar_today_kwh * 22 / 1000, 2),
        "certificates_year": round(solar_today_kwh * 22 * 8.4 / 1000, 2),
        "trees_equivalent": round(co2_year / 21, 0),
        "car_km_avoided": round(co2_year / 0.12, 0),
        "flights_avoided": round(co2_year / 255, 1),
        "monthly": gen_monthly(),
        "sites": [
            {
                "name": "Rotterdam",
                "score": "A+",
                "co2_avoided_kg": round(co2_today * 0.65, 1),
                "performance_ratio": 91.2,
                "certificates": round(solar_today_kwh * 0.65 / 1000 * 22, 2),
            },
            {
                "name": "Rebordelo",
                "score": "A",
                "co2_avoided_kg": round(co2_today * 0.35, 1),
                "performance_ratio": 87.4,
                "certificates": round(solar_today_kwh * 0.35 / 1000 * 22, 2),
            }
        ]
    }
