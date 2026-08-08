"""
tasks.py — Celery async task queue for VoltarisOS.

Configures Celery with Redis broker for background task processing.
Tasks include:
- AI optimization calculations (MILP)
- Forecasting jobs (real forecasting with fallback)
- Report generation
- VPP bid processing
- Device data aggregation

Usage:
    # Start worker:
    celery -A backend.tasks worker --loglevel=info
    
    # Or with beat for periodic tasks:
    celery -A backend.tasks worker --loglevel=info --beat
"""
import os
import logging
from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

# Redis URL for broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "voltaris",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["backend.tasks"]
)

# Celery configuration
celery_app.conf.update(
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Timezone
    timezone="Europe/Lisbon",
    enable_utc=True,
    
    # Task execution
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    task_soft_time_limit=240,  # Soft limit at 4 minutes
    
    # Result backend
    result_expires=3600,  # Results expire after 1 hour
    
    # Worker
    worker_prefetch_multiplier=1,  # Fair task distribution
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks
    
    # Retry configuration (global defaults)
    task_acks_late=True,  # Acknowledge after completion (not before)
    task_reject_on_worker_lost=True,  # Requeue if worker dies
    
    # Beat schedule (periodic tasks)
    beat_schedule={
        # Run forecasting every 15 minutes
        "run-forecasting-every-15min": {
            "task": "backend.tasks.run_forecasting",
            "schedule": crontab(minute="*/15"),
        },
        # Run MILP optimization every 5 minutes
        "run-milp-optimization-every-5min": {
            "task": "backend.tasks.run_milp_optimization",
            "schedule": crontab(minute="*/5"),
        },
        # Aggregate device data every 5 minutes
        "aggregate-device-data-every-5min": {
            "task": "backend.tasks.aggregate_device_data",
            "schedule": crontab(minute="*/5"),
        },
        # Generate daily reports at midnight
        "generate-daily-report": {
            "task": "backend.tasks.generate_daily_report",
            "schedule": crontab(hour=0, minute=0),
        },
        # Clean up old audit logs weekly (Sunday at 3 AM)
        "cleanup-old-audit-logs": {
            "task": "backend.tasks.cleanup_old_audit_logs",
            "schedule": crontab(hour=3, minute=0, day_of_week=0),
        },
    },
)


# ─── Task Definitions ────────────────────────────────────────────────────────

@celery_app.task(
    name="backend.tasks.run_ai_optimization",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def run_ai_optimization(self, price: float, battery_soc: float, tenant_id: int):
    """Run AI optimization calculation asynchronously.
    
    Uses MILP optimizer for advanced optimization, falls back to simple
    rule-based optimizer if MILP is not available.
    
    Args:
        price: Current energy price (EUR/MWh)
        battery_soc: Battery state of charge (0-1)
        tenant_id: Tenant ID for multi-tenancy
    
    Returns:
        Optimization decision with details
    """
    try:
        from optimization.milp_optimizer import MILPOptimizer, BatteryConstraints
        
        optimizer = MILPOptimizer()
        battery = BatteryConstraints(capacity_kwh=500, max_charge_kw=250, max_discharge_kw=250)
        
        # Run optimization with current price as single-hour horizon
        result = optimizer.optimize(
            horizon_hours=1,
            battery=battery,
            prices=[price],
            load_forecast=[0.0],
            solar_forecast=[0.0],
            initial_soc=battery_soc,
        )
        
        if result.status == "optimal" and result.schedule:
            action = result.schedule[0].get("action", "hold")
        else:
            # Fallback to simple rule-based
            from optimization.ai_optimizer import optimize_energy
            action = optimize_energy(price, battery_soc)
        
        # Log to audit trail
        from backend.audit import log_audit_event
        from backend.database import SessionLocal
        db = SessionLocal()
        try:
            log_audit_event(
                db=db,
                action="optimization.milp.run",
                tenant_id=tenant_id,
                details={
                    "price": price,
                    "battery_soc": battery_soc,
                    "decision": action,
                    "optimizer": "milp" if result.status == "optimal" else "rule_based",
                },
            )
        finally:
            db.close()
        
        return {
            "decision": action,
            "price": price,
            "battery_soc": battery_soc,
            "optimizer": "milp" if result.status == "optimal" else "rule_based",
        }
    
    except Exception as exc:
        logger.error(f"AI optimization failed: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(
    name="backend.tasks.run_forecasting",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def run_forecasting(self):
    """Run forecasting for all active tenants.
    
    This task is scheduled to run every 15 minutes.
    Uses the forecasting module for real predictions with fallback
    to simple moving average if forecasting fails.
    """
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timedelta
    
    db = SessionLocal()
    try:
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        
        results = []
        for tenant in tenants:
            try:
                # Get recent readings for this tenant
                cutoff = datetime.utcnow() - timedelta(days=7)
                readings = db.query(models.DeviceReading).filter(
                    models.DeviceReading.tenant_id == tenant.id,
                    models.DeviceReading.timestamp >= cutoff,
                    models.DeviceReading.power_kw.isnot(None),
                ).order_by(models.DeviceReading.timestamp.desc()).limit(1000).all()
                
                if len(readings) < 24:
                    # Not enough data for forecasting
                    results.append({
                        "tenant_id": tenant.id,
                        "status": "skipped",
                        "reason": "insufficient_data",
                        "readings_count": len(readings),
                    })
                    continue
                
                # Extract power values (reverse to chronological order)
                power_values = [r.power_kw for r in reversed(readings) if r.power_kw is not None]
                
                # Try to use forecasting module
                try:
                    from forecasting.combined_forecast import run_combined_forecast
                    forecast_result = run_combined_forecast(power_values)
                    results.append({
                        "tenant_id": tenant.id,
                        "status": "completed",
                        "method": "combined_forecast",
                        "forecast_horizon": forecast_result.get("horizon_hours", 24),
                    })
                except (ImportError, Exception) as e:
                    # Fallback: simple moving average
                    avg_power = sum(power_values[-24:]) / min(24, len(power_values))
                    results.append({
                        "tenant_id": tenant.id,
                        "status": "completed",
                        "method": "moving_average_fallback",
                        "avg_power_kw": round(avg_power, 2),
                        "note": str(e) if not isinstance(e, ImportError) else "forecasting module not available",
                    })
            
            except Exception as e:
                logger.error(f"Forecasting failed for tenant {tenant.id}: {e}")
                results.append({
                    "tenant_id": tenant.id,
                    "status": "error",
                    "error": str(e),
                })
        
        return {"tenants_processed": len(results), "results": results}
    
    except Exception as exc:
        logger.error(f"Forecasting task failed: {exc}")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    
    finally:
        db.close()


@celery_app.task(
    name="backend.tasks.run_milp_optimization",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def run_milp_optimization(self):
    """Run MILP optimization for all active tenants with batteries.
    
    This task is scheduled to run every 5 minutes.
    Uses the MILP optimizer to calculate optimal dispatch schedule.
    """
    from backend.database import SessionLocal
    from backend import models
    from optimization.milp_optimizer import MILPOptimizer, BatteryConstraints
    from datetime import datetime, timedelta
    
    db = SessionLocal()
    try:
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        
        optimizer = MILPOptimizer()
        results = []
        
        for tenant in tenants:
            try:
                # Get latest battery state
                battery_state = db.query(models.BatteryState).filter(
                    models.BatteryState.tenant_id == tenant.id
                ).order_by(models.BatteryState.timestamp.desc()).first()
                
                initial_soc = battery_state.soc if battery_state else 0.5
                
                # Get recent price data (or use default)
                cutoff = datetime.utcnow() - timedelta(hours=24)
                # In production, fetch from EnergyPriceTS or market API
                prices = [50.0 + (i % 6) * 10 for i in range(24)]  # Simulated price pattern
                
                # Get load forecast (from forecasting or recent readings)
                readings = db.query(models.DeviceReading).filter(
                    models.DeviceReading.tenant_id == tenant.id,
                    models.DeviceReading.timestamp >= cutoff,
                ).order_by(models.DeviceReading.timestamp.desc()).limit(24).all()
                
                load_forecast = [r.power_kw or 0 for r in reversed(readings)] if readings else [100.0] * 24
                solar_forecast = [0.0] * 24  # Would come from solar forecast
                
                # Run MILP optimization
                battery = BatteryConstraints(
                    capacity_kwh=500,
                    max_charge_kw=250,
                    max_discharge_kw=250,
                )
                
                result = optimizer.optimize(
                    horizon_hours=24,
                    battery=battery,
                    prices=prices,
                    load_forecast=load_forecast,
                    solar_forecast=solar_forecast,
                    initial_soc=initial_soc,
                )
                
                results.append({
                    "tenant_id": tenant.id,
                    "status": result.status,
                    "profit_eur": result.total_profit_eur,
                    "cycles": result.battery_cycles,
                    "solver_time_ms": result.solver_time_ms,
                    "next_action": result.get_action_for_hour(0).get("action", "hold"),
                })
                
                # Log to audit trail
                from backend.audit import log_audit_event
                log_audit_event(
                    db=db,
                    action="optimization.milp.scheduled",
                    tenant_id=tenant.id,
                    details={
                        "status": result.status,
                        "profit_eur": result.total_profit_eur,
                        "next_action": result.get_action_for_hour(0).get("action", "hold"),
                    },
                )
            
            except Exception as e:
                logger.error(f"MILP optimization failed for tenant {tenant.id}: {e}")
                results.append({
                    "tenant_id": tenant.id,
                    "status": "error",
                    "error": str(e),
                })
        
        return {"tenants_processed": len(results), "results": results}
    
    except Exception as exc:
        logger.error(f"MILP optimization task failed: {exc}")
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    
    finally:
        db.close()


@celery_app.task(name="backend.tasks.aggregate_device_data")
def aggregate_device_data():
    """Aggregate device readings for all tenants.
    
    This task is scheduled to run every 5 minutes.
    """
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timedelta
    
    db = SessionLocal()
    try:
        # Get readings from the last 5 minutes
        cutoff = datetime.utcnow() - timedelta(minutes=5)
        readings = db.query(models.DeviceReading).filter(
            models.DeviceReading.timestamp >= cutoff
        ).all()
        
        # Aggregate by tenant
        tenant_aggregates = {}
        for reading in readings:
            tid = reading.tenant_id
            if tid not in tenant_aggregates:
                tenant_aggregates[tid] = {
                    "count": 0,
                    "total_power_kw": 0,
                    "total_energy_kwh": 0,
                }
            tenant_aggregates[tid]["count"] += 1
            if reading.power_kw:
                tenant_aggregates[tid]["total_power_kw"] += reading.power_kw
            if reading.energy_kwh:
                tenant_aggregates[tid]["total_energy_kwh"] += reading.energy_kwh
        
        return {"aggregates": tenant_aggregates}
    finally:
        db.close()


@celery_app.task(name="backend.tasks.generate_daily_report")
def generate_daily_report():
    """Generate daily summary report for all tenants.
    
    This task is scheduled to run at midnight.
    """
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timedelta
    
    db = SessionLocal()
    try:
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        # Get all active tenants
        tenants = db.query(models.Tenant).filter(models.Tenant.active == True).all()
        
        reports = []
        for tenant in tenants:
            # Count readings from yesterday
            reading_count = db.query(models.DeviceReading).filter(
                models.DeviceReading.tenant_id == tenant.id,
                models.DeviceReading.timestamp >= yesterday,
            ).count()
            
            # Count alerts from yesterday
            alert_count = db.query(models.Alert).filter(
                models.Alert.tenant_id == tenant.id,
                models.Alert.fired_at >= yesterday,
            ).count()
            
            reports.append({
                "tenant_id": tenant.id,
                "tenant_name": tenant.name,
                "reading_count": reading_count,
                "alert_count": alert_count,
            })
        
        return {"reports": reports, "date": yesterday.isoformat()}
    finally:
        db.close()


@celery_app.task(name="backend.tasks.cleanup_old_audit_logs")
def cleanup_old_audit_logs():
    """Clean up audit logs older than 90 days.
    
    This task is scheduled to run weekly.
    """
    from backend.database import SessionLocal
    from backend import models
    from datetime import datetime, timedelta
    
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=90)
        
        # Delete old audit logs
        deleted = db.query(models.AuditLog).filter(
            models.AuditLog.timestamp < cutoff
        ).delete()
        
        db.commit()
        
        return {"deleted_count": deleted, "cutoff": cutoff.isoformat()}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="backend.tasks.process_vpp_bid")
def process_vpp_bid(bid_id: int, tenant_id: int):
    """Process a VPP bid asynchronously.
    
    Args:
        bid_id: ID of the VPP bid to process
        tenant_id: Tenant ID for multi-tenancy
    """
    from backend.database import SessionLocal
    from backend import models
    
    db = SessionLocal()
    try:
        bid = db.query(models.VPPBid).filter(
            models.VPPBid.id == bid_id,
            models.VPPBid.tenant_id == tenant_id,
        ).first()
        
        if not bid:
            return {"error": "Bid not found"}
        
        # Process the bid (placeholder logic)
        bid.status = "submitted"
        db.commit()
        
        # Log to audit trail
        from backend.audit import log_audit_event
        log_audit_event(
            db=db,
            action="vpp.bid.processed",
            tenant_id=tenant_id,
            target_resource="vpp_bid",
            target_id=bid_id,
            details={"status": "submitted"},
        )
        
        return {"bid_id": bid_id, "status": "submitted"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(name="backend.tasks.send_notification")
def send_notification(user_id: int, message: str, notification_type: str = "info"):
    """Send a notification to a user asynchronously.
    
    Args:
        user_id: ID of the user to notify
        message: Notification message
        notification_type: Type of notification (info, warning, critical)
    """
    # Placeholder for actual notification logic
    # Could integrate with email, SMS, push notifications, etc.
    
    from backend.audit import log_audit_event
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        log_audit_event(
            db=db,
            action="notification.sent",
            user_id=user_id,
            details={"message": message, "type": notification_type},
        )
    finally:
        db.close()
    
    return {"user_id": user_id, "status": "sent"}