"""Celery tasks for the VoltarisOS production pipeline."""
import logging
import os

from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("voltaris", broker=REDIS_URL, backend=REDIS_URL, include=["backend.tasks", "backend.tasks_forecast_backtest"])
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json", timezone="Europe/Lisbon", enable_utc=True, task_track_started=True, task_time_limit=300, task_soft_time_limit=240, result_expires=3600, worker_prefetch_multiplier=1, worker_max_tasks_per_child=100, task_acks_late=True, task_reject_on_worker_lost=True, beat_schedule={"run-forecasting-every-15min": {"task": "backend.tasks.run_forecasting", "schedule": crontab(minute="*/15")}, "run-milp-optimization-every-5min": {"task": "backend.tasks.run_milp_optimization", "schedule": crontab(minute="*/5")}, "aggregate-device-data-every-5min": {"task": "backend.tasks.aggregate_device_data", "schedule": crontab(minute="*/5")}, "generate-daily-report": {"task": "backend.tasks.generate_daily_report", "schedule": crontab(hour=0, minute=0)}, "run-data-retention-daily": {"task": "backend.tasks.run_retention", "schedule": crontab(hour=3, minute=30)}, "detect-offline-devices": {"task": "backend.tasks.detect_offline_devices", "schedule": crontab(minute="*/5")}, "sync-solaredge-oauth-every-5min": {"task": "backend.tasks.sync_solaredge_oauth", "schedule": crontab(minute="*/5")}})


@celery_app.task(name="backend.tasks.run_forecasting", bind=True, max_retries=3, default_retry_delay=60)
def run_forecasting(self):
    """Persist a complete forecast snapshot from real providers."""
    from datetime import datetime, timedelta, timezone
    from backend.database import SessionLocal
    from backend import models
    from forecasting.contracts import ForecastBundle
    from forecasting.load_forecast import forecast_load_with_metadata
    from forecasting.persistence import record_from_bundle
    from forecasting.price_forecast import forecast_market_prices_with_metadata, DayAheadNotPublished
    from backend.config import settings
    from backend.forecast_inputs import solar_forecast_from_sites

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
                country = getattr(tenant, "country_code", None) or settings.FORECAST_COUNTRY_CODE
                try:
                    prices, price_provider = __import__("asyncio").run(forecast_market_prices_with_metadata(country_code=country, hours=24, allow_fallback=False, start=start))
                except DayAheadNotPublished as exc:
                    # Expected for part of every day (tomorrow's prices are not out yet): wait, do not alarm.
                    results.append({"tenant_id": tenant.id, "status": "skipped", "reason": "day_ahead_prices_incomplete", "detail": str(exc)})
                    continue
                # Location, capacity and panel orientation live on the tenant's sites, not on the tenant.
                solar, solar_provider = solar_forecast_from_sites(db, tenant.id, hours=24)
                bundle = ForecastBundle(prices_eur_mwh=prices, load_kw=load, solar_kw=solar, timestamps=[(start + timedelta(hours=i)).isoformat() for i in range(24)], providers=(price_provider, load_provider, solar_provider))
                # `start` is the forecast's first hour (floored), but the providers were queried just now,
                # later in that hour. Freshness and the record's generated_at use the real current time:
                # using `start` made every provider look "generated in the future".
                now = datetime.now(timezone.utc)
                bundle.validate(24, now=now)
                record = record_from_bundle(models, tenant.id, bundle, now=now)
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


@celery_app.task(name="backend.tasks.run_retention")
def run_retention():
    """Daily data-retention pass (see backend/retention.py): summarise old telemetry
    into hourly rows, then delete data past each dataset's retention window.
    Bounded by RETENTION_MAX_SECONDS (< the 300 s task limit) and resumable."""
    from backend.database import SessionLocal
    from backend import retention
    db = SessionLocal()
    try:
        return retention.run_retention(db).as_dict()
    except Exception:
        logger.exception("Data retention task failed")
        raise
    finally:
        db.close()


@celery_app.task(name="backend.tasks.cleanup_old_audit_logs")
def cleanup_old_audit_logs():
    """Legacy task name (it used to be a no-op scheduled weekly): kept so a queued
    or externally scheduled call still works. Same as run_retention."""
    return run_retention()


@celery_app.task(name="backend.tasks.process_vpp_bid")
def process_vpp_bid(bid_id: int, tenant_id: int):
    return {"status": "not_implemented", "bid_id": bid_id, "tenant_id": tenant_id}


@celery_app.task(name="backend.tasks.sync_solaredge_oauth")
def sync_solaredge_oauth():
    """Turn every tenant's SolarEdge OAuth connection into device readings
    (see backend/solaredge_sync.py). A failing tenant never blocks the others."""
    from backend.database import SessionLocal
    from backend import solaredge_sync
    db = SessionLocal()
    try:
        return solaredge_sync.sync_all(db)
    finally:
        db.close()


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


@celery_app.task(name="backend.tasks.deliver_webhook", bind=True, max_retries=3, default_retry_delay=30)
def deliver_webhook(self, webhook_id: int, event: str, payload: dict):
    """Deliver one webhook event. Runs entirely off the request path (enqueued
    fire-and-forget by backend/audit.py's log_audit_event) so a slow or
    unreachable receiver can never block the action that triggered it.
    Retries with backoff on network errors or a non-2xx response."""
    import hashlib
    import hmac
    import json
    import time

    import httpx

    from backend.database import SessionLocal
    from backend import models

    db = SessionLocal()
    try:
        wh = db.query(models.Webhook).filter(
            models.Webhook.id == webhook_id, models.Webhook.active.is_(True)
        ).first()
        if wh is None:
            return {"status": "skipped", "reason": "not_found_or_inactive"}

        body = json.dumps(
            {"event": event, "data": payload, "timestamp": time.time()}, default=str
        ).encode("utf-8")
        signature = hmac.new(wh.secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

        # SSRF guard at delivery time: re-check (with DNS) because the name may
        # resolve to an internal address now even if it did not at registration.
        # Not retried: a blocked destination will not become allowed.
        from backend import netguard
        try:
            netguard.check_url(wh.url)
        except netguard.BlockedDestination as exc:
            wh.last_triggered_at = models.utcnow_naive()
            wh.last_error = f"blocked: {exc}"[:500]
            wh.failure_count += 1
            db.commit()
            return {"status": "blocked", "reason": str(exc)}

        try:
            resp = httpx.post(
                wh.url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-VoltarisOS-Event": event,
                    "X-VoltarisOS-Signature": f"sha256={signature}",
                },
                timeout=10.0,
                follow_redirects=False,
            )
            wh.last_triggered_at = models.utcnow_naive()
            wh.last_status_code = resp.status_code
            if resp.is_success:
                wh.last_error = None
                wh.failure_count = 0
                db.commit()
                return {"status": "delivered", "http_status": resp.status_code}
            wh.last_error = f"HTTP {resp.status_code}"
            wh.failure_count += 1
            db.commit()
            raise self.retry(countdown=30 * (2 ** self.request.retries))
        except httpx.RequestError as exc:
            wh.last_triggered_at = models.utcnow_naive()
            wh.last_error = str(exc)[:500]
            wh.failure_count += 1
            db.commit()
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
    finally:
        db.close()
