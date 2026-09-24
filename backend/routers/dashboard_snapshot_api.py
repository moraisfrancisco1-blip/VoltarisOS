"""dashboard_snapshot_api.py — GET /api/dashboard/snapshot.

A single REST call combining live power/SOC (fetch_dashboard_snapshot,
also used by /ws/dashboard) and today's savings (compute_savings_today,
also used by /api/savings/today). Exists for the mobile app's Android
home-screen widget and "live" ongoing notification: both run from a
background task (expo-background-task/WorkManager) while the app may be
backgrounded or killed, so they can't hold the /ws/dashboard websocket open
and instead poll this endpoint every ~15-30 minutes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.security import get_current_user
from backend.dashboard_snapshot import fetch_dashboard_snapshot
from backend.routers.savings import compute_savings_today, _effective_tenant

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/api/dashboard/snapshot")
async def dashboard_snapshot(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    tenant = _effective_tenant(user)
    metrics = fetch_dashboard_snapshot(db, tenant)
    savings = await compute_savings_today(db, user)
    return {**metrics, "savings": savings}
