"""Data retention: bound the tables that grow forever, without losing history.

What grows (per tenant): device_readings (a row every ~30 s per device: the
largest table by far), forecast_records (every 15 min), vpp_optimization_runs /
vpp_dispatch_records (every optimisation), alerts, report_jobs (+ the PDFs on
disk), audit_logs, stripe_events, leads. None of them was ever pruned, and the
weekly "cleanup" task was a no-op.

Principles
----------
* Telemetry is SUMMARISED BEFORE IT IS DELETED. Each hour of raw readings that
  leaves the raw window becomes one row in device_readings_hourly, in the same
  transaction that deletes the raw rows, so for any hour the data is in exactly
  one of the two tables. Readers that look back further than the raw window add
  both (backend/energy_metrics.py, carbon, telemetry coverage).
* Everything is configurable per dataset (RETENTION_<DATASET>_DAYS; 0 = keep
  forever) and has a floor that protects existing features (e.g. the load
  forecast needs 28 days of raw telemetry), so a typo cannot silently break them.
* Safe to run anytime, repeatedly and concurrently: deletes are batched and
  committed per batch, the run stops at a time budget (below the Celery soft limit
  of 240 s, so the task is never interrupted mid-batch) and resumes where it left off on the next run.
* RETENTION_DRY_RUN=true reports what would be deleted and deletes nothing.

Configuration (all optional)
----------------------------
RETENTION_ENABLED        true|false           default true
RETENTION_DRY_RUN        true|false           default false
RETENTION_MAX_SECONDS    seconds per run      default 180 (Celery: soft limit 240 s, hard 300 s)
RETENTION_BATCH_SIZE     rows per DELETE      default 5000
RETENTION_<DATASET>_DAYS e.g. RETENTION_AUDIT_LOGS_DAYS=1095, see POLICIES.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import models

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Policy:
    key: str            # also the suffix of the env var: RETENTION_<KEY>_DAYS
    default_days: int   # 0 = keep forever
    min_days: int       # configured values below this are raised to it (0 still = forever)
    description: str


POLICIES: Dict[str, Policy] = {p.key: p for p in (
    Policy("DEVICE_READINGS", 90, 35,
           "Raw telemetry. Older hours are summarised into device_readings_hourly (kept forever). "
           "Floor 35: the load forecast reads 28 days of raw readings."),
    Policy("AUDIT_LOGS", 730, 90,
           "Audit trail. The only sanctioned deletion of an otherwise append-only table."),
    Policy("ALERTS", 180, 30, "ACKNOWLEDGED alerts only; unacknowledged alerts are never deleted."),
    Policy("FORECAST_RECORDS", 60, 30, "Persisted forecast snapshots (the optimizer only needs the latest valid one)."),
    Policy("VPP_RUNS", 180, 30, "Optimisation runs and their dispatch records. VPP bids are never touched."),
    Policy("REPORT_JOBS", 90, 7, "Report jobs and the generated PDF files on disk."),
    Policy("STRIPE_EVENTS", 90, 30, "Webhook idempotency keys. Stripe retries for ~3 days, so 30 is a safe floor."),
    Policy("LEADS", 365, 30, "Marketing sign-ups from the landing page (personal data, no account)."),
)}


def _flag(name: str, default: bool) -> bool:
    value = os.getenv(name, "").strip().lower()
    if not value:
        return default
    return value in ("1", "true", "yes", "on")


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        logger.warning("%s=%r is not an integer; using %s", name, raw, default)
        return default
    return value if value > 0 else default


def retention_days(policy: Policy) -> int:
    """Effective retention in days for `policy` (0 = keep forever)."""
    name = f"RETENTION_{policy.key}_DAYS"
    raw = os.getenv(name, "").strip()
    if not raw:
        return policy.default_days
    try:
        days = int(raw)
    except ValueError:
        logger.warning("%s=%r is not an integer; using the default (%s days)", name, raw, policy.default_days)
        return policy.default_days
    if days < 0:
        logger.warning("%s=%s is negative; using the default (%s days)", name, days, policy.default_days)
        return policy.default_days
    if days == 0:
        return 0
    if days < policy.min_days:
        logger.warning("%s=%s is below the safe minimum; using %s days", name, days, policy.min_days)
        return policy.min_days
    return days


def current_config() -> dict:
    """The effective configuration (for the admin endpoint and the logs)."""
    return {
        "enabled": _flag("RETENTION_ENABLED", True),
        "dry_run": _flag("RETENTION_DRY_RUN", False),
        "max_seconds": _int_env("RETENTION_MAX_SECONDS", 180),
        "batch_size": _int_env("RETENTION_BATCH_SIZE", 5000),
        "datasets": {
            p.key.lower(): {
                "days": retention_days(p), "default_days": p.default_days,
                "min_days": p.min_days, "description": p.description,
            }
            for p in POLICIES.values()
        },
    }


# ─── Hourly summary of raw readings ──────────────────────────────────────────

_VALUE_FIELDS = ("power_kw", "soc_pct", "temp_c", "voltage_v", "current_a", "frequency_hz")


def _hour_floor(ts: datetime) -> datetime:
    return ts.replace(minute=0, second=0, microsecond=0)


def _avg(values: List[float]) -> Optional[float]:
    return sum(values) / len(values) if values else None


def summarise_hour(rows: list, hour_start: datetime) -> dict:
    """One hour of raw DeviceReading-like rows (sorted by timestamp) -> summary.

    `rows` need `.timestamp`, `.power_kw`, `.energy_kwh`, `.soc_pct`, `.temp_c`,
    `.voltage_v`, `.current_a`, `.frequency_hz`.
    """
    hour_end = hour_start + timedelta(hours=1)
    col = {f: [getattr(r, f) for r in rows if getattr(r, f) is not None] for f in _VALUE_FIELDS}
    energy = [r.energy_kwh for r in rows if r.energy_kwh is not None]

    # Energy integrated from power, same rule as energy_metrics.solar_energy_kwh:
    # each sample is held until the next one, gaps clamped to 1 h.
    from_power = None
    if col["power_kw"]:
        total = 0.0
        for i, r in enumerate(rows):
            if r.power_kw is None:
                continue
            nxt = rows[i + 1].timestamp if i + 1 < len(rows) else hour_end
            dt = min(max((nxt - r.timestamp).total_seconds(), 0.0), 3600.0)
            total += r.power_kw * dt / 3600.0
        from_power = total

    return {
        "sample_count": len(rows),
        "power_kw_avg": _avg(col["power_kw"]),
        "power_kw_min": min(col["power_kw"]) if col["power_kw"] else None,
        "power_kw_max": max(col["power_kw"]) if col["power_kw"] else None,
        "energy_kwh_sum": sum(energy) if energy else None,
        "energy_from_power_kwh": from_power,
        "soc_pct_avg": _avg(col["soc_pct"]),
        "soc_pct_min": min(col["soc_pct"]) if col["soc_pct"] else None,
        "soc_pct_max": max(col["soc_pct"]) if col["soc_pct"] else None,
        "temp_c_avg": _avg(col["temp_c"]),
        "temp_c_max": max(col["temp_c"]) if col["temp_c"] else None,
        "voltage_v_avg": _avg(col["voltage_v"]),
        "current_a_avg": _avg(col["current_a"]),
        "frequency_hz_avg": _avg(col["frequency_hz"]),
    }


def _none_safe(fn, a, b):
    if a is None:
        return b
    if b is None:
        return a
    return fn(a, b)


def merge_hourly(existing, new: dict) -> None:
    """Fold `new` into an existing hourly row (late data for an already-summarised
    hour). Sums add, min/max combine; averages are weighted by sample_count (an
    approximation: the per-field sample counts are not stored)."""
    n_old, n_new = existing.sample_count or 0, new["sample_count"]
    total = n_old + n_new or 1

    def weighted(old, add):
        if old is None:
            return add
        if add is None:
            return old
        return (old * n_old + add * n_new) / total

    for field in ("power_kw_avg", "soc_pct_avg", "temp_c_avg", "voltage_v_avg", "current_a_avg", "frequency_hz_avg"):
        setattr(existing, field, weighted(getattr(existing, field), new[field]))
    for field in ("power_kw_min", "soc_pct_min"):
        setattr(existing, field, _none_safe(min, getattr(existing, field), new[field]))
    for field in ("power_kw_max", "soc_pct_max", "temp_c_max"):
        setattr(existing, field, _none_safe(max, getattr(existing, field), new[field]))
    for field in ("energy_kwh_sum", "energy_from_power_kwh"):
        setattr(existing, field, _none_safe(lambda a, b: a + b, getattr(existing, field), new[field]))
    existing.sample_count = n_old + n_new


# ─── Run machinery ───────────────────────────────────────────────────────────

@dataclass
class _Ctx:
    dry_run: bool
    batch_size: int
    deadline: float
    exhausted: bool = False

    def out_of_time(self) -> bool:
        if time.monotonic() >= self.deadline:
            self.exhausted = True
        return self.exhausted


@dataclass
class RetentionReport:
    dry_run: bool
    results: Dict[str, dict] = field(default_factory=dict)
    budget_exhausted: bool = False
    elapsed_seconds: float = 0.0

    def as_dict(self) -> dict:
        return {"dry_run": self.dry_run, "budget_exhausted": self.budget_exhausted,
                "elapsed_seconds": round(self.elapsed_seconds, 2), "results": self.results}

    @property
    def total_deleted(self) -> int:
        return sum(r.get("deleted", 0) for r in self.results.values())


def _purge_ids(db: Session, ctx: _Ctx, model, ts_col, cutoff: datetime, *extra_filters,
               before_delete: Optional[Callable[[list], None]] = None) -> int:
    """Delete rows with ts < cutoff in committed batches. Dry run: count only."""
    query = db.query(model.id).filter(ts_col < cutoff, *extra_filters)
    if ctx.dry_run:
        return query.count()
    deleted = 0
    while not ctx.out_of_time():
        ids = [r[0] for r in query.order_by(model.id).limit(ctx.batch_size).all()]
        if not ids:
            break
        if before_delete:
            before_delete(ids)
        db.query(model).filter(model.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        deleted += len(ids)
    return deleted


def _purge_vpp_runs(db: Session, ctx: _Ctx, cutoff: datetime) -> dict:
    run = models.VPPOptimizationRun

    def drop_children(run_ids: list) -> None:
        # vpp_dispatch_records.optimization_run_id is a NOT NULL foreign key.
        db.query(models.VPPDispatchRecord).filter(
            models.VPPDispatchRecord.optimization_run_id.in_(run_ids)
        ).delete(synchronize_session=False)

    return {"deleted": _purge_ids(db, ctx, run, run.started_at, cutoff, before_delete=drop_children)}


def _reports_dir() -> str:
    from backend.routers.reports import REPORTS_DIR
    return os.path.realpath(REPORTS_DIR)


def _purge_report_jobs(db: Session, ctx: _Ctx, cutoff: datetime) -> dict:
    job = models.ReportJob
    files_removed = 0
    base = _reports_dir()

    def drop_files(job_ids: list) -> None:
        nonlocal files_removed
        for (path,) in db.query(job.file_path).filter(job.id.in_(job_ids), job.file_path.isnot(None)).all():
            real = os.path.realpath(path)
            # Only ever delete inside the reports directory, whatever the row says.
            if real.startswith(base + os.sep) and os.path.isfile(real):
                try:
                    os.remove(real)
                    files_removed += 1
                except OSError:
                    logger.warning("Could not delete report file %s", real)

    deleted = _purge_ids(db, ctx, job, job.created_at, cutoff, before_delete=drop_files)
    return {"deleted": deleted, "files_removed": files_removed}


def _purge_device_readings(db: Session, ctx: _Ctx, cutoff: datetime) -> dict:
    """Summarise into device_readings_hourly, then delete raw rows older than `cutoff`.

    `cutoff` is aligned to a whole hour, so no hour is ever split between the two
    tables. Work is done per (device, day): one transaction summarises the day's
    hours, merges them into the hourly table and deletes the raw rows, so a crash
    or a timeout between devices leaves nothing half-done and the next run
    simply continues with the oldest remaining day.
    """
    reading = models.DeviceReading
    hourly = models.DeviceReadingHourly
    if ctx.dry_run:
        n = db.query(func.count(reading.id)).filter(reading.timestamp < cutoff).scalar() or 0
        return {"deleted": n, "hours_summarised": 0}

    deleted = hours = 0
    while not ctx.out_of_time():
        first = db.query(func.min(reading.timestamp)).filter(reading.timestamp < cutoff).scalar()
        if first is None:
            break
        day_start = first.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = min(day_start + timedelta(days=1), cutoff)
        device_ids = [r[0] for r in db.query(reading.device_id).filter(
            reading.timestamp >= day_start, reading.timestamp < day_end).distinct().all()]
        for device_id in device_ids:
            if ctx.out_of_time():
                break
            rows = (db.query(reading)
                    .filter(reading.device_id == device_id, reading.timestamp >= day_start, reading.timestamp < day_end)
                    .order_by(reading.timestamp.asc()).all())
            by_hour: Dict[datetime, list] = {}
            for r in rows:
                by_hour.setdefault(_hour_floor(r.timestamp), []).append(r)
            existing = {h.hour_start: h for h in db.query(hourly).filter(
                hourly.device_id == device_id, hourly.hour_start.in_(list(by_hour))).all()}
            ids = [r.id for r in rows]
            try:
                for hour_start, hour_rows in by_hour.items():
                    summary = summarise_hour(hour_rows, hour_start)
                    if hour_start in existing:
                        merge_hourly(existing[hour_start], summary)
                    else:
                        tenant = next((r.tenant_id for r in hour_rows if r.tenant_id is not None), None)
                        db.add(hourly(tenant_id=tenant, device_id=device_id, hour_start=hour_start, **summary))
                db.flush()
                for i in range(0, len(ids), ctx.batch_size):
                    db.query(reading).filter(reading.id.in_(ids[i:i + ctx.batch_size])).delete(synchronize_session=False)
                db.commit()
            except IntegrityError:
                # Another run summarised the same hour at the same time: nothing was
                # committed here, the raw rows are still there; skip, next run retries.
                db.rollback()
                logger.warning("Concurrent retention run on device %s, day %s: skipped", device_id, day_start.date())
                ctx.exhausted = True
                break
            deleted += len(ids)
            hours += len(by_hour)
        else:
            continue
        break
    return {"deleted": deleted, "hours_summarised": hours}


def _ensure_tables(db: Session) -> None:
    """The hourly table is created by the API at startup (Base.metadata.create_all);
    a Celery worker or `python -m backend.retention` may run before that happened on
    an existing database, so make sure it is there. Idempotent and cheap."""
    models.DeviceReadingHourly.__table__.create(bind=db.get_bind(), checkfirst=True)


def run_retention(
    db: Session,
    now: Optional[datetime] = None,
    *,
    dry_run: Optional[bool] = None,
    max_seconds: Optional[int] = None,
    batch_size: Optional[int] = None,
    only: Optional[List[str]] = None,
) -> RetentionReport:
    """Apply every retention policy once. Returns what was (or would be) deleted."""
    config = current_config()
    dry = config["dry_run"] if dry_run is None else dry_run
    started = time.monotonic()
    ctx = _Ctx(dry_run=dry,
               batch_size=batch_size or config["batch_size"],
               deadline=started + (max_seconds or config["max_seconds"]))
    report = RetentionReport(dry_run=dry)
    _ensure_tables(db)
    if not config["enabled"]:
        report.results["_skipped"] = {"reason": "RETENTION_ENABLED is false"}
        return report

    now = now or models.utcnow_naive()
    wanted = {k.upper() for k in only} if only else None
    A, S = models.Alert, models.StripeEvent

    def cutoff_for(key: str) -> Optional[datetime]:
        days = retention_days(POLICIES[key])
        return now - timedelta(days=days) if days else None

    # Cheap tables first; the big, time-budgeted one (telemetry) last.
    jobs: List[tuple] = [
        ("AUDIT_LOGS", lambda c: {"deleted": _purge_ids(db, ctx, models.AuditLog, models.AuditLog.timestamp, c)}),
        ("ALERTS", lambda c: {"deleted": _purge_ids(db, ctx, A, A.fired_at, c, A.acknowledged.is_(True))}),
        ("FORECAST_RECORDS", lambda c: {"deleted": _purge_ids(db, ctx, models.ForecastRecord, models.ForecastRecord.generated_at, c)}),
        ("VPP_RUNS", lambda c: _purge_vpp_runs(db, ctx, c)),
        ("REPORT_JOBS", lambda c: _purge_report_jobs(db, ctx, c)),
        ("STRIPE_EVENTS", lambda c: {"deleted": _purge_ids(db, ctx, S, S.processed_at, c)}),
        ("LEADS", lambda c: {"deleted": _purge_ids(db, ctx, models.Lead, models.Lead.created_at, c)}),
        ("DEVICE_READINGS", lambda c: _purge_device_readings(db, ctx, _hour_floor(c))),
    ]
    for key, job in jobs:
        if wanted is not None and key not in wanted:
            continue
        cutoff = cutoff_for(key)
        name = key.lower()
        if cutoff is None:
            report.results[name] = {"skipped": "keep forever", "deleted": 0}
            continue
        if ctx.exhausted:
            report.results[name] = {"skipped": "time budget exhausted", "deleted": 0}
            continue
        try:
            result = job(cutoff)
        except Exception:
            logger.exception("Retention failed for %s", name)
            db.rollback()
            result = {"error": True, "deleted": 0}
        result["cutoff"] = cutoff.isoformat()
        report.results[name] = result
        if result.get("deleted"):
            logger.info("Retention%s: %s -> %s rows older than %s",
                        " (dry run)" if dry else "", name, result["deleted"], cutoff.isoformat())

    report.budget_exhausted = ctx.exhausted
    report.elapsed_seconds = time.monotonic() - started

    if not dry and report.total_deleted:
        # Record the run itself (the audit table's own pruning is covered too).
        from backend.audit import log_audit_event
        try:
            log_audit_event(db=db, action="retention.run", tenant_id=None, user_email="system",
                            target_resource="retention", details=report.as_dict(), dispatch_webhooks=False)
        except Exception:
            logger.exception("Could not audit the retention run")
            db.rollback()
    return report


if __name__ == "__main__":  # python -m backend.retention [--dry-run]
    import json
    import sys
    from backend.database import SessionLocal

    logging.basicConfig(level=logging.INFO)
    session = SessionLocal()
    try:
        print(json.dumps(run_retention(session, dry_run=True if "--dry-run" in sys.argv else None).as_dict(), indent=2, default=str))
    finally:
        session.close()
