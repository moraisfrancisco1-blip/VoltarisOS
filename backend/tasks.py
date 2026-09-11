"""Celery tasks for the VoltarisOS production pipeline."""
import logging
import os

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("voltaris", broker=REDIS_URL, backend=REDIS_URL, include=["backend.tasks", "backend.tasks_forecast_backtest"])
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json", timezone="Europe/Lisbon", enable_utc=True, task_track_started=True, task_time_limit=300, task_soft_time_limit=240, result_expires=3600, worker_prefetch_multiplier=1, worker_max_tasks_per_child=100, task_acks_late=True, task_reject_on_worker_lost=True, beat_schedule={"run-forecasting-every-15min": {"task": "backend.tasks.run_forecasting", "schedule": crontab(minute="*/15")}, "run-milp-optimization-every-5min": {"task": "backend.tasks.run_milp_optimization", "schedule": crontab(minute="*/5")}, "aggregate-device-data-every-5min": {"task": "backend.tasks.aggregate_device_data", "schedule": crontab(minute="*/5")}, "generate-daily-report": {"task": "backend.tasks.generate_daily_report", "schedule": crontab(hour=0, minute=0)}, "cleanup-old-audit-logs": {"task": "backend.tasks.cleanup_old_audit_logs", "schedule": crontab(hour=3, minute=0, day_of_week=0)}, "detect-offline-devices": {"task": "backend.tasks.detect_offline_devices", "schedule": crontab(minute="*/5")}})


@celery_app.task(name="backend.tasks.run_forecasting", bind=True, max_retries=3, default_retry_delay=60)
def run_forecasting(self):
    """Persist a complete forecast snapshot from real providers."""
    from datetime import datetime, timedelta, timezone
    from backend.database import SessionLocal
    from backend import models
    from forecasting.contracts import ForecastBundle
    from forecasting.load_forecast import forecast_load_with_metadata
    from forecasting.persistence import record_from_bundle
    from forecasting.price_forecast import forecast_market_prices_with_metadata
    from forecasting.solar_forecast import forecast_solar_production

    db = SessionLocal()
    try:
        results = []
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        for tenant in tenants:
            try:
                start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
                cutoff = start - timedelta(days=28)
                readings = db.query(models.DeviceReading).filter(models.DeviceReading.tenant_id == tenant.id, models.DeviceReading.timestamp >= cutoff, models.DeviceReading.timestamp < start, models.DeviceReading.power_kw.isnot(None)).order_by(models.DeviceReading.timestamp.asc()).limit(10000).all()
                if len(readings) < 24:
                    results.append({"tenant_id": tenant.id, "status": "skipped", "reason": "insufficient_data", "readings_count": len(readings)})
                    continue
                load, load_provider = forecast_load_with_metadata(readings, start, hours=24, history_days=28)
                prices, price_provider = __import__("asyncio").run(forecast_market_prices_with_metadata(country_code=getattr(tenant, "country_code", "PT") or "PT", hours=24, allow_fallback=False))
                lat = getattr(tenant, "latitude", None)
                lon = getattr(tenant, "longitude", None)
                solar_kw = float(getattr(tenant, "solar_capacity_kw", 0.0) or 0.0)
                if lat is None or lon is None or solar_kw <= 0:
                    raise RuntimeError("solar provider requires tenant latitude, longitude and solar_capacity_kw")
                solar_response = forecast_solar_production(float(lat), float(lon), solar_kw, hours=24, include_metadata=True)
                solar = [float(item["estimated_kwh"]) for item in solar_response["forecast"][:24]]
                from forecasting.contracts import ProviderMetadata
                solar_provider = ProviderMetadata("Open-Meteo", solar_response["generated_at"], solar_response["max_age_minutes"])
                bundle = ForecastBundle(prices_eur_mwh=prices, load_kw=load, solar_kw=solar, timestamps=[(start + timedelta(hours=i)).isoformat() for i in range(24)], providers=(price_provider, load_provider, solar_provider))
                bundle.validate(24, now=start)
                record = record_from_bundle(models, tenant.id, bundle, now=start)
                db.add(record)
                db.commit()
                results.append({"tenant_id": tenant.id, "status": "completed", "record_id": record.id, "generated_at": record.generated_at.isoformat()})
            except Exception as exc:
                db.rollback()
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
    """Consume the latest persisted canonical forecast and run the rolling optimizer."""
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timezone
    from forecasting.persistence import latest_forecast, bundle_from_record
    from optimization.rolling_horizon import RollingHorizonOptimizer
    db = SessionLocal()
    try:
        results = []
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        for tenant in tenants:
            try:
                record = latest_forecast(db, models, tenant.id)
                if record is None:
                    results.append({"tenant_id": tenant.id, "status": "skipped", "reason": "forecast_unavailable"})
                    continue
                bundle = bundle_from_record(record)
                result = RollingHorizonOptimizer().optimize(bundle, _portfolio_factory_for_tenant(tenant), horizon_hours=24, step_hours=1, now=datetime.now(timezone.utc))
                results.append({"tenant_id": tenant.id, "status": result.status, "forecast_record_id": record.id, "solves": result.solves, "intervals": len(result.intervals)})
            except Exception as exc:
                logger.exception("Canonical optimization failed for tenant %s", tenant.id)
                results.append({"tenant_id": tenant.id, "status": "error", "error": str(exc)})
        return {"tenants_processed": len(results), "results": results}
    except Exception as exc:
        logger.exception("MILP optimization task failed")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    finally:
        db.close()


def _portfolio_factory_for_tenant(tenant):
    from optimization.assets import VPPPortfolio
    return lambda forecast: VPPPortfolio.from_tenant(tenant, forecast)


@celery_app.task(name="backend.tasks.run_ai_optimization")
def run_ai_optimization(price: float, battery_soc: float, tenant_id: int):
    raise RuntimeError("run_ai_optimization is deprecated; use run_milp_optimization")


@celery_app.task(name="backend.tasks.aggregate_device_data", bind=True, max_retries=3, default_retry_delay=30)
def aggregate_device_data(self):
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
    except Exception as exc:
        logger.exception("aggregate_device_data failed")
        raise self.retry(exc=exc)
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


@celery_app.task(name="backend.tasks.detect_offline_devices")
def detect_offline_devices():
    """Mark monitored devices offline when they stop reporting and raise a single
    communication alert per device. Idempotent: devices already offline are skipped
    and no duplicate communication alert is created while the device stays offline.
    Devices that never reported (last_seen is null) are left untouched."""
    from datetime import timedelta
    from backend.database import SessionLocal
    from backend import models
    from backend.config import settings
    db = SessionLocal()
    try:
        threshold_min = settings.DEVICE_OFFLINE_AFTER_MINUTES
        cutoff = models.utcnow_naive() - timedelta(minutes=threshold_min)
        candidates = db.query(models.Device).filter(
            models.Device.enabled.is_(True),
            models.Device.last_seen.isnot(None),
            models.Device.last_seen < cutoff,
        ).all()
        flipped = 0
        created = 0
        for dev in candidates:
            if dev.status == "offline":
                continue  # already offline — avoid status churn / duplicate alert
            dev.status = "offline"
            flipped += 1
            existing = db.query(models.Alert).filter(
                models.Alert.tenant_id == dev.tenant_id,
                models.Alert.device_id == dev.id,
                models.Alert.metric == "communication",
                models.Alert.acknowledged.is_(False),
            ).first()
            if existing:
                continue
            db.add(models.Alert(
                tenant_id=dev.tenant_id,
                device_id=dev.id,
                device_name=dev.name,
                severity="warning",
                title="Perda de comunicação — dispositivo offline",
                message=f"{dev.name} não reportou leituras nos últimos {threshold_min} min",
                metric="communication",
            ))
            created += 1
        db.commit()
        return {"checked": len(candidates), "flipped_offline": flipped, "communication_alerts_created": created}
    finally:
        db.close()


@celery_app.task(name="backend.tasks.backtest_tenant_load")
def backtest_tenant_load(tenant_id: int):
    from backend.database import SessionLocal
    from backend import models
    from forecasting.device_backtest import backtest_tenant_load as run_backtest
    db = SessionLocal()
    try:
        return run_backtest(db, models, tenant_id)
    finally:
        db.close()


@celery_app.task(name="backend.tasks.backtest_all_tenants")
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
