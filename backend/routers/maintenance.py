from fastapi import APIRouter
import random, datetime

router = APIRouter()

ASSETS = [
    {"id": "BAT-R01", "name": "Bateria Principal", "site": "Rotterdam", "type": "battery", "age_months": 18},
    {"id": "BAT-R02", "name": "Bateria Secundária", "site": "Rotterdam", "type": "battery", "age_months": 18},
    {"id": "INV-R01", "name": "Inversor 1", "site": "Rotterdam", "type": "inverter", "age_months": 24},
    {"id": "INV-R02", "name": "Inversor 2", "site": "Rotterdam", "type": "inverter", "age_months": 36},
    {"id": "SOL-R01", "name": "Painel Solar A", "site": "Rotterdam", "type": "solar", "age_months": 18},
    {"id": "BAT-P01", "name": "Bateria Principal", "site": "Rebordelo", "type": "battery", "age_months": 12},
    {"id": "INV-P01", "name": "Inversor 1", "site": "Rebordelo", "type": "inverter", "age_months": 12},
    {"id": "SOL-P01", "name": "Painel Solar A", "site": "Rebordelo", "type": "solar", "age_months": 12},
]

HEALTH_SCORES = {
    "BAT-R01": 94, "BAT-R02": 88, "INV-R01": 97, "INV-R02": 71,
    "SOL-R01": 96, "BAT-P01": 98, "INV-P01": 95, "SOL-P01": 93
}
FAILURE_PROB_30D = {
    "BAT-R01": 4, "BAT-R02": 12, "INV-R01": 2, "INV-R02": 72,
    "SOL-R01": 3, "BAT-P01": 1, "INV-P01": 5, "SOL-P01": 4
}
NEXT_SERVICE = {
    "BAT-R01": 23, "BAT-R02": 8, "INV-R01": 45, "INV-R02": 3,
    "SOL-R01": 60, "BAT-P01": 90, "INV-P01": 45, "SOL-P01": 60
}

@router.get("/api/maintenance/assets")
def get_assets():
    assets = []
    for a in ASSETS:
        health = HEALTH_SCORES[a["id"]]
        fail30 = FAILURE_PROB_30D[a["id"]]
        days = NEXT_SERVICE[a["id"]]
        severity = "critical" if fail30 > 60 else "warning" if fail30 > 25 else "ok"
        assets.append({
            **a,
            "health": health,
            "failure_prob_30d": fail30,
            "failure_prob_90d": min(fail30 * 2.4, 95),
            "next_service_days": days,
            "severity": severity,
            "last_checked": (datetime.datetime.utcnow() - datetime.timedelta(hours=random.randint(1,48))).isoformat(),
            "anomalies": random.randint(0, 3) if severity != "ok" else 0,
        })
    return {"assets": assets}

@router.get("/api/maintenance/degradation/{asset_id}")
def get_degradation(asset_id: str):
    points = []
    base = 100
    for i in range(24):
        base -= random.uniform(0.1, 0.4)
        points.append({"month": i, "health": round(base, 1)})
    return {"asset_id": asset_id, "degradation": points}

@router.get("/api/maintenance/schedule")
def get_schedule():
    today = datetime.datetime.utcnow()
    schedule = []
    for a in ASSETS:
        days = NEXT_SERVICE[a["id"]]
        dt = today + datetime.timedelta(days=days)
        severity = "critical" if days <= 7 else "warning" if days <= 30 else "planned"
        schedule.append({
            "asset_id": a["id"],
            "asset_name": a["name"],
            "site": a["site"],
            "due_date": dt.strftime("%d/%m/%Y"),
            "days_remaining": days,
            "severity": severity,
            "estimated_cost": random.randint(200, 1200),
            "type": "preventive" if FAILURE_PROB_30D[a["id"]] > 40 else "scheduled"
        })
    return {"schedule": sorted(schedule, key=lambda x: x["days_remaining"])}
