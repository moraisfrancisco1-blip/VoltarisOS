"""Scheduled/manual evaluation task for tenant load forecasts."""
from __future__ import annotations

from celery import shared_task


@shared_task(name="backend.tasks.backtest_tenant_load")
def backtest_tenant_load(tenant_id: int):
    from backend.database import SessionLocal
    from backend import models
    from forecasting.device_backtest import backtest_tenant_load as run_backtest

    db = SessionLocal()
    try:
        return run_backtest(db, models, tenant_id)
    finally:
        db.close()


@shared_task(name="backend.tasks.backtest_all_tenants")
def backtest_all_tenants():
    from backend.database import SessionLocal
    from backend import models
    from forecasting.device_backtest import backtest_tenant_load as run_backtest

    db = SessionLocal()
    try:
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        return [run_backtest(db, models, tenant.id) for tenant in tenants]
    finally:
        db.close()
