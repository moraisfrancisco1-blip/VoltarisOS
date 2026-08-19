"""Celery tasks for the VoltarisOS production pipeline."""
import logging
import os

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("voltaris", broker=REDIS_URL, backend=REDIS_URL, include=["backend.tasks"])
celery_app.conf.update(
    task_serializer="json", accept_content=["json"], result_serializer="json",
    timezone="Europe/Lisbon", enable_utc=True, task_track_started=True,
    task_time_limit=300, task_soft_time_limit=240, result_expires=3600,
    worker_prefetch_multiplier=1, worker_max_tasks_per_child=100,
    task_acks_late=True, task_reject_on_worker_lost=True,
    beat_schedule={
        "run-forecasting-every-15min": {"task": "backend.tasks.run_forecasting", "schedule": crontab(minute="*/15")},
        "run-milp-optimization-every-5min": {"task": "backend.tasks.run_milp_optimization", "schedule": crontab(minute="*/5")},
        "aggregate-device-data-every-5min": {"task": "backend.tasks.aggregate_device_data", "schedule": crontab(minute="*/5")},
        "generate-daily-report": {"task": "backend.tasks.generate_daily_report", "schedule": crontab(hour=0, minute=0)},
        "cleanup-old-audit-logs": {"task": "backend.tasks.cleanup_old_audit_logs", "schedule": crontab(hour=3, minute=0, day_of_week=0)},
    },
)


@celery_app.task(name="backend.tasks.run_forecasting", bind=True, max_retries=3, default_retry_delay=60)
def run_forecasting(self):
    """Build canonical forecast bundles; never silently substitute fake forecasts."""
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timedelta, timezone
    from forecasting.load_forecast import forecast_load

    db = SessionLocal()
    try:
        results = []
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        for tenant in tenants:
            try:
                cutoff = datetime.now(timezone.utc) - timedelta(days=28)
                readings = db.query(models.DeviceReading).filter(
                    models.DeviceReading.tenant_id == tenant.id,
                    models.DeviceReading.timestamp >= cutoff,
                    models.DeviceReading.power_kw.isnot(None),
                ).order_by(models.DeviceReading.timestamp.asc()).limit(10000).all()
                if len(readings) < 24:
                    results.append({"tenant_id": tenant.id, "status": "skipped", "reason": "insufficient_data", "readings_count": len(readings)})
                    continue
                forecast = forecast_load([r.power_kw for r in readings])
                results.append({"tenant_id": tenant.id, "status": "completed", "method": forecast.get("method", "load_forecast"), "forecast_horizon": len(forecast.get("forecast", [])), "generated_at": forecast.get("generated_at")})
            except Exception as exc:
                logger.exception("Forecasting failed for tenant %s", tenant.id)
                results.append({"tenant_id": tenant.id, "status": "error", "error": str(exc)})
        return {"tenants_processed": len(results), "results": results}
    except Exception as exc:
        logger.exception("Forecasting task failed")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    finally:
        db.close()


@celery_app.task(name="backend.tasks.run_milp_optimization", bind=True, max_retries=2, default_retry_delay=60)
def run_milp_optimization(self):
    """Run optimization through the canonical forecast/health/rolling-horizon path."""
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timezone
    from forecasting.contracts import ForecastBundle, ProviderMetadata
    from optimization.rolling_horizon import RollingHorizonOptimizer

    db = SessionLocal()
    try:
        results = []
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        for tenant in tenants:
            try:
                forecast_record = _load_canonical_forecast_for_tenant(db, models, tenant.id)
                if forecast_record is None:
                    results.append({"tenant_id": tenant.id, "status": "skipped", "reason": "forecast_unavailable"})
                    continue
                bundle = ForecastBundle(
                    prices_eur_mwh=forecast_record["prices_eur_mwh"],
                    load_kw=forecast_record["load_kw"],
                    solar_kw=forecast_record["solar_kw"],
                    timestamps=forecast_record["timestamps"],
                    providers=tuple(forecast_record["providers"]),
                )
                portfolio_factory = _portfolio_factory_for_tenant(tenant)
                result = RollingHorizonOptimizer().optimize(bundle, portfolio_factory, horizon_hours=24, step_hours=1, now=datetime.now(timezone.utc))
                results.append({"tenant_id": tenant.id, "status": result.status, "solves": result.solves, "intervals": len(result.intervals)})
            except Exception as exc:
                logger.exception("Canonical optimization failed for tenant %s", tenant.id)
                results.append({"tenant_id": tenant.id, "status": "error", "error": str(exc)})
        return {"tenants_processed": len(results), "results": results}
    except Exception as exc:
        logger.exception("MILP optimization task failed")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    finally:
        db.close()


def _load_canonical_forecast_for_tenant(db, models, tenant_id):
    """Adapter boundary for persisted forecast storage.

    Returns None until the persistence layer exposes a canonical forecast record.
    This deliberately does not fabricate prices/load/solar values.
    """
    return None


def _portfolio_factory_for_tenant(tenant):
    """Resolve the tenant portfolio without embedding optimizer logic in Celery."""
    from optimization.assets import VPPPortfolio
    return lambda forecast: VPPPortfolio.from_tenant(tenant, forecast)


@celery_app.task(name="backend.tasks.run_ai_optimization")
def run_ai_optimization(price: float, battery_soc: float, tenant_id: int):
    """Legacy compatibility task. New dispatch must use run_milp_optimization."""
    raise RuntimeError("run_ai_optimization is deprecated; use the canonical VPP optimization pipeline")


@celery_app.task(name="backend.tasks.aggregate_device_data")
def aggregate_device_data():
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timedelta, timezone
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
        readings = db.query(models.DeviceReading).filter(models.DeviceReading.timestamp >= cutoff).all()
        aggregates = {}
        for reading in readings:
            item = aggregates.setdefault(reading.tenant_id, {"count": 0, "total_power_kw": 0, "total_energy_kwh": 0})
            item["count"] += 1
            item["total_power_kw"] += reading.power_kw or 0
            item["total_energy_kwh"] += reading.energy_kwh or 0
        return {"aggregates": aggregates}
    finally:
        db.close()


@celery_app.task(name="backend.tasks.generate_daily_report")
def generate_daily_report():
    return {"status": "not_implemented", "reason": "reporting remains outside the optimization pipeline"}


@celery_app.task(name="backend.tasks.cleanup_old_audit_logs")
def cleanup_old_audit_logs():
    return {"status": "not_implemented", "reason": "cleanup remains outside the optimization pipeline"}


@celery_app.task(name="backend.tasks.process_vpp_bid")
def process_vpp_bid(bid_id: int, tenant_id: int):
    return {"status": "not_implemented", "bid_id": bid_id, "tenant_id": tenant_id}
