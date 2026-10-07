"""Data retention: configuration, the hourly summary, every dataset's purge, the
guarantee that nothing is lost when telemetry ages out, the readers that look
back past the raw window, the admin endpoints and the scheduled task."""
from __future__ import annotations

import os
import types
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import energy_metrics, models, retention
from backend.database import Base
from backend.main import app
from backend.routers import carbon as carbon_module
from backend.routers import operations as operations_module
from backend.routers import sites as sites_module
from backend.security import ALGORITHM, SECRET_KEY, get_current_user
import backend.tasks as tasks_module

NOW = datetime(2026, 6, 15, 12, 30, 0)
TENANT = 1


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for key in list(os.environ):
        if key.startswith("RETENTION_"):
            monkeypatch.delenv(key, raising=False)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    session.add(models.Tenant(id=TENANT, name="A", slug="a", plan="pro", max_sites=20))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def days_ago(n, hour=12, minute=0, second=0):
    return (NOW - timedelta(days=n)).replace(hour=hour, minute=minute, second=second, microsecond=0)


def add_device(db, device_type="inverter", site_id=None):
    dev = models.Device(tenant_id=TENANT, name="D", protocol="simulated", device_type=device_type, site_id=site_id, config={})
    db.add(dev)
    db.commit()
    return dev


def add_reading(db, device, ts, power=None, energy=None, soc=None, temp=None):
    db.add(models.DeviceReading(tenant_id=TENANT, device_id=device.id, timestamp=ts, power_kw=power, energy_kwh=energy, soc_pct=soc, temp_c=temp))


def raw_count(db):
    return db.query(func.count(models.DeviceReading.id)).scalar()


def hourly_rows(db):
    db.expire_all()
    return db.query(models.DeviceReadingHourly).order_by(models.DeviceReadingHourly.hour_start).all()


# ── configuration ────────────────────────────────────────────────────────────
class TestConfiguration:
    def test_defaults(self):
        days = {k.lower(): retention.retention_days(p) for k, p in retention.POLICIES.items()}
        assert days == {"device_readings": 90, "audit_logs": 730, "alerts": 180, "forecast_records": 60,
                        "vpp_runs": 180, "report_jobs": 90, "stripe_events": 90, "leads": 365,
                        "user_sessions": 30, "device_readings_hourly": 0}

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("RETENTION_AUDIT_LOGS_DAYS", "1095")
        assert retention.retention_days(retention.POLICIES["AUDIT_LOGS"]) == 1095

    def test_zero_means_keep_forever(self, monkeypatch):
        monkeypatch.setenv("RETENTION_AUDIT_LOGS_DAYS", "0")
        assert retention.retention_days(retention.POLICIES["AUDIT_LOGS"]) == 0

    @pytest.mark.parametrize("value", ["abc", "-5", "1.5", " "])
    def test_garbage_falls_back_to_the_default(self, monkeypatch, value):
        monkeypatch.setenv("RETENTION_AUDIT_LOGS_DAYS", value)
        assert retention.retention_days(retention.POLICIES["AUDIT_LOGS"]) == 730

    def test_values_below_the_floor_are_raised(self, monkeypatch):
        # the load forecast reads 28 days of raw telemetry: 5 days would silently break it
        monkeypatch.setenv("RETENTION_DEVICE_READINGS_DAYS", "5")
        assert retention.retention_days(retention.POLICIES["DEVICE_READINGS"]) == 35

    def test_current_config_shape(self, monkeypatch):
        monkeypatch.setenv("RETENTION_DRY_RUN", "true")
        monkeypatch.setenv("RETENTION_BATCH_SIZE", "nope")
        cfg = retention.current_config()
        assert cfg["dry_run"] is True and cfg["enabled"] is True and cfg["batch_size"] == 5000 and cfg["max_seconds"] == 180
        assert cfg["datasets"]["device_readings"]["days"] == 90 and cfg["datasets"]["device_readings"]["min_days"] == 35

    def test_disabled_does_nothing(self, db, monkeypatch):
        monkeypatch.setenv("RETENTION_ENABLED", "false")
        dev = add_device(db)
        add_reading(db, dev, days_ago(200), power=1.0)
        db.commit()
        report = retention.run_retention(db, NOW)
        assert report.results == {"_skipped": {"reason": "RETENTION_ENABLED is false"}}
        assert raw_count(db) == 1


# ── hourly summary (pure) ────────────────────────────────────────────────────
def R(ts, **kw):
    base = dict(power_kw=None, energy_kwh=None, soc_pct=None, temp_c=None, voltage_v=None, current_a=None, frequency_hz=None)
    base.update(kw)
    return types.SimpleNamespace(timestamp=ts, **base)


H0 = datetime(2026, 1, 1, 10, 0, 0)


class TestSummariseHour:
    def test_statistics(self):
        rows = [R(H0 + timedelta(minutes=m), power_kw=p, energy_kwh=e, soc_pct=s, temp_c=t)
                for m, p, e, s, t in ((0, 2.0, 0.1, 50, 30), (20, 4.0, 0.2, 60, 40), (40, 6.0, 0.3, 70, 35))]
        s = retention.summarise_hour(rows, H0)
        assert s["sample_count"] == 3
        assert (s["power_kw_avg"], s["power_kw_min"], s["power_kw_max"]) == (4.0, 2.0, 6.0)
        assert s["energy_kwh_sum"] == pytest.approx(0.6)
        assert (s["soc_pct_avg"], s["soc_pct_min"], s["soc_pct_max"]) == (60.0, 50, 70)
        assert (s["temp_c_avg"], s["temp_c_max"]) == (35.0, 40)

    def test_energy_integrated_from_power_holds_each_sample_until_the_next(self):
        rows = [R(H0, power_kw=6.0), R(H0 + timedelta(minutes=30), power_kw=2.0)]
        # 6 kW for 30 min + 2 kW for the remaining 30 min = 3 + 1 kWh
        assert retention.summarise_hour(rows, H0)["energy_from_power_kwh"] == pytest.approx(4.0)

    def test_gaps_are_clamped_to_one_hour(self):
        rows = [R(H0, power_kw=10.0), R(H0 + timedelta(hours=5), power_kw=0.0)]
        assert retention.summarise_hour(rows, H0)["energy_from_power_kwh"] == pytest.approx(10.0)  # not 50

    def test_missing_fields_stay_none(self):
        s = retention.summarise_hour([R(H0, soc_pct=80)], H0)
        assert s["energy_kwh_sum"] is None and s["energy_from_power_kwh"] is None and s["power_kw_avg"] is None
        assert s["soc_pct_avg"] == 80

    def test_partially_filled_columns_ignore_nulls(self):
        s = retention.summarise_hour([R(H0, power_kw=2.0), R(H0 + timedelta(minutes=10), power_kw=None, energy_kwh=0.5)], H0)
        assert s["power_kw_avg"] == 2.0 and s["energy_kwh_sum"] == 0.5 and s["sample_count"] == 2


class TestMergeHourly:
    def _row(self, **kw):
        base = dict(sample_count=0, power_kw_avg=None, power_kw_min=None, power_kw_max=None, energy_kwh_sum=None,
                    energy_from_power_kwh=None, soc_pct_avg=None, soc_pct_min=None, soc_pct_max=None, temp_c_avg=None,
                    temp_c_max=None, voltage_v_avg=None, current_a_avg=None, frequency_hz_avg=None)
        base.update(kw)
        return types.SimpleNamespace(**base)

    def test_sums_add_extremes_combine_averages_are_weighted(self):
        old = self._row(sample_count=3, power_kw_avg=4.0, power_kw_min=2.0, power_kw_max=6.0, energy_kwh_sum=1.0)
        new = retention.summarise_hour([R(H0, power_kw=10.0, energy_kwh=0.5)], H0)
        retention.merge_hourly(old, new)
        assert old.sample_count == 4
        assert old.power_kw_avg == pytest.approx((4.0 * 3 + 10.0) / 4)
        assert (old.power_kw_min, old.power_kw_max) == (2.0, 10.0)
        assert old.energy_kwh_sum == pytest.approx(1.5)

    def test_none_on_one_side_keeps_the_other(self):
        old = self._row(sample_count=2, energy_kwh_sum=None, soc_pct_avg=None)
        new = retention.summarise_hour([R(H0, energy_kwh=2.0, soc_pct=40)], H0)
        retention.merge_hourly(old, new)
        assert old.energy_kwh_sum == 2.0 and old.soc_pct_avg == 40


# ── device readings: summarise, then delete ──────────────────────────────────
class TestDeviceReadings:
    def test_old_readings_become_hourly_rows_and_recent_ones_stay(self, db):
        dev = add_device(db)
        for m in (0, 30):                      # 2 old samples in one hour
            add_reading(db, dev, days_ago(100, 8, m), power=2.0, energy=0.5)
        add_reading(db, dev, days_ago(100, 9, 0), power=4.0, energy=1.0)   # next hour
        add_reading(db, dev, days_ago(10), power=9.0, energy=9.0)          # recent
        db.commit()

        report = retention.run_retention(db, NOW)
        assert report.results["device_readings"]["deleted"] == 3
        assert report.results["device_readings"]["hours_summarised"] == 2
        assert raw_count(db) == 1
        h = hourly_rows(db)
        assert [(r.hour_start.hour, r.sample_count, r.energy_kwh_sum) for r in h] == [(8, 2, 1.0), (9, 1, 1.0)]
        assert h[0].tenant_id == TENANT and h[0].device_id == dev.id and h[0].power_kw_avg == 2.0

    def test_energy_is_conserved_across_the_boundary(self, db):
        dev = add_device(db)
        total = 0.0
        for d in range(5, 130, 7):
            for hr in (6, 7, 13):
                add_reading(db, dev, days_ago(d, hr, 15), power=3.0, energy=0.25)
                total += 0.25
        db.commit()
        before = db.query(func.sum(models.DeviceReading.energy_kwh)).scalar()
        assert before == pytest.approx(total)

        retention.run_retention(db, NOW)
        raw = db.query(func.coalesce(func.sum(models.DeviceReading.energy_kwh), 0)).scalar()
        summarised = db.query(func.coalesce(func.sum(models.DeviceReadingHourly.energy_kwh_sum), 0)).scalar()
        assert raw + summarised == pytest.approx(total)
        assert raw_count(db) + db.query(func.sum(models.DeviceReadingHourly.sample_count)).scalar() == 3 * len(range(5, 130, 7))

    def test_is_idempotent(self, db):
        dev = add_device(db)
        add_reading(db, dev, days_ago(120), power=1.0, energy=1.0)
        db.commit()
        retention.run_retention(db, NOW)
        again = retention.run_retention(db, NOW)
        assert again.results["device_readings"]["deleted"] == 0
        assert len(hourly_rows(db)) == 1 and hourly_rows(db)[0].sample_count == 1

    def test_an_hour_is_never_split_between_raw_and_hourly(self, db):
        dev = add_device(db)
        cutoff = NOW - timedelta(days=90)                       # 2026-03-17 12:30
        add_reading(db, dev, cutoff.replace(minute=5), energy=1.0)    # same hour as the cutoff, before it
        add_reading(db, dev, cutoff.replace(minute=50), energy=1.0)   # same hour, after it
        add_reading(db, dev, cutoff.replace(hour=11, minute=55), energy=1.0)  # previous hour: expired
        db.commit()
        retention.run_retention(db, NOW)
        # the cutoff is floored to 12:00, so only the 11:xx hour expired
        assert raw_count(db) == 2
        assert [(r.hour_start.hour, r.sample_count) for r in hourly_rows(db)] == [(11, 1)]

    def test_late_data_for_an_already_summarised_hour_is_merged(self, db):
        dev = add_device(db)
        add_reading(db, dev, days_ago(120, 8, 0), power=2.0, energy=1.0)
        db.commit()
        retention.run_retention(db, NOW)
        add_reading(db, dev, days_ago(120, 8, 30), power=4.0, energy=2.0)   # a gateway back-fills old data
        db.commit()
        retention.run_retention(db, NOW)
        rows = hourly_rows(db)
        assert len(rows) == 1
        assert (rows[0].sample_count, rows[0].energy_kwh_sum, rows[0].power_kw_max) == (2, 3.0, 4.0)
        assert raw_count(db) == 0

    def test_each_device_gets_its_own_hourly_row(self, db):
        a, b = add_device(db), add_device(db)
        add_reading(db, a, days_ago(100, 8, 0), energy=1.0)
        add_reading(db, b, days_ago(100, 8, 0), energy=5.0)
        db.commit()
        retention.run_retention(db, NOW)
        assert {(r.device_id, r.energy_kwh_sum) for r in hourly_rows(db)} == {(a.id, 1.0), (b.id, 5.0)}

    def test_the_floor_protects_the_forecast_window(self, db, monkeypatch):
        monkeypatch.setenv("RETENTION_DEVICE_READINGS_DAYS", "1")
        dev = add_device(db)
        add_reading(db, dev, days_ago(20), power=1.0)     # inside the 28-day forecast window
        add_reading(db, dev, days_ago(60), power=1.0)     # outside the 35-day floor
        db.commit()
        retention.run_retention(db, NOW)
        assert raw_count(db) == 1

    def test_keep_forever(self, db, monkeypatch):
        monkeypatch.setenv("RETENTION_DEVICE_READINGS_DAYS", "0")
        dev = add_device(db)
        add_reading(db, dev, days_ago(900), power=1.0)
        db.commit()
        report = retention.run_retention(db, NOW)
        assert report.results["device_readings"] == {"skipped": "keep forever", "deleted": 0}
        assert raw_count(db) == 1 and hourly_rows(db) == []

    def test_small_batches_still_delete_everything(self, db):
        dev = add_device(db)
        for m in range(0, 60, 2):
            add_reading(db, dev, days_ago(100, 8, m), energy=0.1)
        db.commit()
        retention.run_retention(db, NOW, batch_size=4)
        assert raw_count(db) == 0
        assert hourly_rows(db)[0].sample_count == 30


class TestTimeBudgetAndDryRun:
    def test_budget_exhaustion_stops_cleanly_and_the_next_run_finishes(self, db, monkeypatch):
        dev = add_device(db)
        for d in (100, 101, 102):
            add_reading(db, dev, days_ago(d, 8, 0), energy=1.0)
        db.commit()
        clock = iter([0.0] + [10_000.0] * 1000)          # the deadline passes right after the start
        monkeypatch.setattr(retention.time, "monotonic", lambda: next(clock))
        first = retention.run_retention(db, NOW)
        assert first.budget_exhausted is True and raw_count(db) == 3

        monkeypatch.undo()
        second = retention.run_retention(db, NOW)
        assert second.budget_exhausted is False and raw_count(db) == 0 and len(hourly_rows(db)) == 3

    def test_dry_run_reports_but_deletes_nothing(self, db):
        dev = add_device(db)
        add_reading(db, dev, days_ago(100), energy=1.0)
        db.add(models.AuditLog(action="x", timestamp=days_ago(900)))
        db.commit()
        report = retention.run_retention(db, NOW, dry_run=True)
        assert report.dry_run is True
        assert report.results["device_readings"]["deleted"] == 1 and report.results["audit_logs"]["deleted"] == 1
        assert raw_count(db) == 1 and hourly_rows(db) == []
        assert db.query(models.AuditLog).filter(models.AuditLog.action == "retention.run").count() == 0

    def test_dry_run_from_the_environment(self, db, monkeypatch):
        monkeypatch.setenv("RETENTION_DRY_RUN", "true")
        db.add(models.AuditLog(action="x", timestamp=days_ago(900)))
        db.commit()
        assert retention.run_retention(db, NOW).dry_run is True
        assert db.query(models.AuditLog).count() == 1

    def test_only_limits_the_datasets(self, db):
        db.add(models.AuditLog(action="x", timestamp=days_ago(900)))
        db.add(models.Lead(name="n", email="e@x.com", created_at=days_ago(900)))
        db.commit()
        report = retention.run_retention(db, NOW, only=["leads"])
        assert set(report.results) == {"leads"}
        assert db.query(models.AuditLog).filter(models.AuditLog.action == "x").count() == 1


# ── other datasets ───────────────────────────────────────────────────────────
class TestOtherDatasets:
    def test_audit_logs(self, db):
        db.add_all([models.AuditLog(action="old", timestamp=days_ago(800)), models.AuditLog(action="new", timestamp=days_ago(100))])
        db.commit()
        retention.run_retention(db, NOW)
        assert [a.action for a in db.query(models.AuditLog).filter(models.AuditLog.action != "retention.run")] == ["new"]

    def test_only_acknowledged_alerts_are_deleted(self, db):
        def alert(title, ack, age):
            return models.Alert(tenant_id=TENANT, title=title, acknowledged=ack, fired_at=days_ago(age))
        db.add_all([alert("old-acked", True, 400), alert("old-open", False, 400), alert("new-acked", True, 10)])
        db.commit()
        retention.run_retention(db, NOW)
        assert sorted(a.title for a in db.query(models.Alert)) == ["new-acked", "old-open"]

    def test_forecast_records(self, db):
        def fc(age):
            return models.ForecastRecord(tenant_id=TENANT, horizon_hours=24, timestamps=[], prices_eur_mwh=[], load_kw=[], solar_kw=[],
                                         providers=[], generated_at=days_ago(age))
        db.add_all([fc(200), fc(5)])
        db.commit()
        retention.run_retention(db, NOW)
        assert db.query(models.ForecastRecord).count() == 1

    def test_vpp_runs_take_their_dispatch_records_but_never_the_bids(self, db):
        group = models.VPPGroup(tenant_id=TENANT, name="G", market="MIBEL", strategy="arbitrage", target_kw=1, min_bid_kw=1, active=True)
        db.add(group)
        db.flush()
        old = models.VPPOptimizationRun(tenant_id=TENANT, vpp_id=group.id, horizon_hours=24, started_at=days_ago(400))
        new = models.VPPOptimizationRun(tenant_id=TENANT, vpp_id=group.id, horizon_hours=24, started_at=days_ago(5))
        db.add_all([old, new])
        db.flush()
        db.add_all([
            models.VPPDispatchRecord(optimization_run_id=old.id, tenant_id=TENANT, vpp_id=group.id, interval_start=days_ago(400), dispatch_kw=1.0),
            models.VPPDispatchRecord(optimization_run_id=new.id, tenant_id=TENANT, vpp_id=group.id, interval_start=days_ago(5), dispatch_kw=1.0),
            models.VPPBid(tenant_id=TENANT, vpp_id=group.id, market="MIBEL", quantity_kw=5.0),
        ])
        db.commit()
        retention.run_retention(db, NOW)
        assert [r.id for r in db.query(models.VPPOptimizationRun)] == [new.id]
        assert [r.optimization_run_id for r in db.query(models.VPPDispatchRecord)] == [new.id]
        assert db.query(models.VPPBid).count() == 1     # financial records are never pruned

    def test_report_jobs_and_their_files(self, db, tmp_path, monkeypatch):
        reports = tmp_path / "reports"
        reports.mkdir()
        outside = tmp_path / "precious.txt"
        outside.write_text("do not delete")
        old_pdf, new_pdf = reports / "old.pdf", reports / "new.pdf"
        old_pdf.write_text("x")
        new_pdf.write_text("x")
        monkeypatch.setattr("backend.routers.reports.REPORTS_DIR", str(reports))
        db.add_all([
            models.ReportJob(tenant_id=TENANT, report_type="t", file_path=str(old_pdf), created_at=days_ago(200)),
            models.ReportJob(tenant_id=TENANT, report_type="t", file_path=str(new_pdf), created_at=days_ago(5)),
            # a row pointing outside the reports directory must never lead to a file deletion
            models.ReportJob(tenant_id=TENANT, report_type="t", file_path=str(outside), created_at=days_ago(200)),
            models.ReportJob(tenant_id=TENANT, report_type="t", file_path="../../etc/passwd", created_at=days_ago(200)),
            models.ReportJob(tenant_id=TENANT, report_type="t", file_path=None, created_at=days_ago(200)),
        ])
        db.commit()
        report = retention.run_retention(db, NOW)
        assert report.results["report_jobs"]["deleted"] == 4 and report.results["report_jobs"]["files_removed"] == 1
        assert not old_pdf.exists() and new_pdf.exists() and outside.exists()
        assert db.query(models.ReportJob).count() == 1

    def test_stripe_events_and_leads(self, db):
        db.add_all([models.StripeEvent(event_id="evt_old", processed_at=days_ago(200)), models.StripeEvent(event_id="evt_new", processed_at=days_ago(5)),
                    models.Lead(name="a", email="a@x.com", created_at=days_ago(500)), models.Lead(name="b", email="b@x.com", created_at=days_ago(5))])
        db.commit()
        retention.run_retention(db, NOW)
        assert [e.event_id for e in db.query(models.StripeEvent)] == ["evt_new"]
        assert [l.name for l in db.query(models.Lead)] == ["b"]

    def test_a_dataset_set_to_zero_is_left_alone(self, db, monkeypatch):
        monkeypatch.setenv("RETENTION_AUDIT_LOGS_DAYS", "0")
        db.add(models.AuditLog(action="ancient", timestamp=days_ago(5000)))
        db.commit()
        report = retention.run_retention(db, NOW)
        assert report.results["audit_logs"]["skipped"] == "keep forever"
        assert db.query(models.AuditLog).filter(models.AuditLog.action == "ancient").count() == 1

    def test_one_failing_dataset_does_not_stop_the_others(self, db, monkeypatch):
        db.add(models.Lead(name="a", email="a@x.com", created_at=days_ago(500)))
        db.commit()

        def boom(*a, **kw):
            raise RuntimeError("db hiccup")
        monkeypatch.setattr(retention, "_purge_vpp_runs", boom)
        report = retention.run_retention(db, NOW)
        assert report.results["vpp_runs"]["error"] is True
        assert report.results["leads"]["deleted"] == 1


class TestTableBootstrap:
    def test_the_hourly_table_is_created_if_a_worker_runs_before_the_api(self, db):
        dev = add_device(db)
        add_reading(db, dev, days_ago(100), energy=1.0)
        db.commit()
        models.DeviceReadingHourly.__table__.drop(bind=db.get_bind())   # an existing DB from before this feature
        report = retention.run_retention(db, NOW)
        assert report.results["device_readings"]["deleted"] == 1 and len(hourly_rows(db)) == 1


class TestRunAudit:
    def test_a_run_that_deleted_something_is_recorded(self, db):
        db.add(models.Lead(name="a", email="a@x.com", created_at=days_ago(500)))
        db.commit()
        retention.run_retention(db, NOW)
        row = db.query(models.AuditLog).filter(models.AuditLog.action == "retention.run").one()
        assert row.tenant_id is None and row.user_email == "system"
        assert row.details["results"]["leads"]["deleted"] == 1

    def test_an_empty_run_leaves_no_noise(self, db):
        retention.run_retention(db, NOW)
        assert db.query(models.AuditLog).count() == 0


# ── readers that look past the raw window ────────────────────────────────────
class TestReadersSeeHistoryAfterRetention:
    def _populate(self, db, dev):
        # 3 old months of solar data, one recent day; all with energy_kwh
        for month, day in ((1, 10), (2, 10), (3, 10), (6, 14)):
            for hr in (9, 10, 11):
                add_reading(db, dev, datetime(2026, month, day, hr, 15), power=3.0, energy=1.0)
        db.commit()

    def test_solar_energy_is_identical_before_and_after_retention(self, db):
        dev = add_device(db)
        self._populate(db, dev)
        window = (datetime(2026, 1, 1), datetime(2026, 7, 1))
        before = energy_metrics.solar_energy_kwh(db, TENANT, *window)
        assert before == 12.0

        retention.run_retention(db, NOW)
        assert db.query(models.DeviceReading).count() == 3     # only the recent day is still raw
        assert energy_metrics.solar_energy_kwh(db, TENANT, *window) == before
        assert energy_metrics.solar_energy_kwh(db, TENANT, datetime(2026, 2, 1), datetime(2026, 3, 1)) == 3.0

    def test_hours_without_reported_energy_fall_back_to_integrated_power(self, db):
        dev = add_device(db)
        add_reading(db, dev, datetime(2026, 2, 10, 9, 0), power=6.0)
        add_reading(db, dev, datetime(2026, 2, 10, 9, 30), power=2.0)
        db.commit()
        window = (datetime(2026, 2, 1), datetime(2026, 3, 1))
        # Raw rule: the LAST sample of the window is held for up to 1 h (clamped), so the
        # 2 kW sample counts a full hour: 6x0.5 + 2x1.0 = 5.0 kWh.
        assert energy_metrics.solar_energy_kwh(db, TENANT, *window) == pytest.approx(5.0)
        retention.run_retention(db, NOW)
        # Hourly rule: each sample is held until the next one or the END OF ITS HOUR:
        # 6x0.5 + 2x0.5 = 4.0 kWh, the physically correct figure for that hour.
        assert energy_metrics.solar_energy_kwh(db, TENANT, *window) == pytest.approx(4.0)

    def test_non_solar_devices_are_not_counted(self, db):
        battery = add_device(db, device_type="battery")
        add_reading(db, battery, datetime(2026, 2, 10, 9, 0), energy=50.0)
        db.commit()
        retention.run_retention(db, NOW)
        assert energy_metrics.solar_energy_kwh(db, TENANT, datetime(2026, 2, 1), datetime(2026, 3, 1)) == 0.0

    def test_other_tenants_hourly_data_is_not_mixed_in(self, db):
        db.add(models.Tenant(id=2, name="B", slug="b", plan="pro", max_sites=1))
        other = models.Device(tenant_id=2, name="X", protocol="simulated", device_type="inverter", config={})
        db.add(other)
        db.commit()
        db.add(models.DeviceReading(tenant_id=2, device_id=other.id, timestamp=datetime(2026, 2, 10, 9, 0), energy_kwh=99.0))
        db.commit()
        retention.run_retention(db, NOW)
        assert energy_metrics.solar_energy_kwh(db, TENANT, datetime(2026, 2, 1), datetime(2026, 3, 1)) == 0.0
        assert energy_metrics.solar_energy_kwh(db, 2, datetime(2026, 2, 1), datetime(2026, 3, 1)) == 99.0

    def test_carbon_monthly_chart_keeps_old_months(self, db, monkeypatch):
        dev = add_device(db)
        self._populate(db, dev)
        retention.run_retention(db, NOW)

        class FrozenDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return NOW
        monkeypatch.setattr(carbon_module, "datetime", FrozenDatetime)
        # the module reads "now" to decide which months to list
        data = carbon_module.carbon_overview(db=db, user={"role": "TENANT_ADMIN", "tenant_id": TENANT})
        by_month = {m["month"]: m["kwh"] for m in data["monthly"]}
        assert [by_month[k] for k in list(by_month)[:3]] == [3.0, 3.0, 3.0]    # Jan, Feb, Mar survive

    def test_telemetry_coverage_counts_hourly_history(self, db):
        dev = add_device(db)
        self._populate(db, dev)
        user = {"role": "TENANT_ADMIN", "tenant_id": TENANT}
        before = sites_module.get_telemetry_coverage(tenant_id=None, user=user, db=db)
        retention.run_retention(db, NOW)
        after = sites_module.get_telemetry_coverage(tenant_id=None, user=user, db=db)
        assert after.readings_count == before.readings_count == 12
        assert after.first_reading is not None and after.first_reading.month == 1       # an hour in January
        assert after.last_reading == before.last_reading                                # raw is newer than any hourly row


# ── admin endpoints ──────────────────────────────────────────────────────────
def H(role="SUPER_ADMIN"):
    return {"Authorization": "Bearer " + jwt.encode({"sub": "root@x.com", "role": role, "tenant_id": TENANT}, SECRET_KEY, algorithm=ALGORITHM)}


@pytest.fixture()
def client(db):
    def _get_db():
        yield db
    app.dependency_overrides[operations_module.get_db] = _get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


class TestAdminEndpoints:
    def test_only_super_admin(self, client):
        assert client.get("/api/admin/retention", headers=H("TENANT_ADMIN")).status_code == 403
        assert client.post("/api/admin/retention/run", headers=H("TENANT_ADMIN")).status_code == 403
        assert client.get("/api/admin/retention").status_code == 401

    def test_status_shows_policy_and_oldest_data(self, client, db):
        dev = add_device(db)
        add_reading(db, dev, datetime(2026, 1, 2, 3, 0), power=1.0)
        db.commit()
        body = client.get("/api/admin/retention", headers=H()).json()
        assert body["config"]["datasets"]["audit_logs"]["days"] == 730
        assert body["oldest"]["device_readings"].startswith("2026-01-02")
        assert body["oldest"]["device_readings_hourly"] is None

    def test_run_defaults_to_a_dry_run(self, client, db):
        db.add(models.Lead(name="a", email="a@x.com", created_at=datetime(2020, 1, 1)))
        db.commit()
        body = client.post("/api/admin/retention/run", headers=H()).json()
        assert body["dry_run"] is True and body["results"]["leads"]["deleted"] == 1
        assert db.query(models.Lead).count() == 1

    def test_run_for_real_and_it_is_audited(self, client, db):
        db.add(models.Lead(name="a", email="a@x.com", created_at=datetime(2020, 1, 1)))
        db.commit()
        body = client.post("/api/admin/retention/run?dry_run=false&dataset=leads", headers=H()).json()
        assert body["dry_run"] is False and set(body["results"]) == {"leads"}
        assert db.query(models.Lead).count() == 0
        triggered = db.query(models.AuditLog).filter(models.AuditLog.action == "retention.triggered").one()
        assert triggered.user_email == "root@x.com" and triggered.details == {"dry_run": False, "dataset": "leads", "deleted": 1}

    def test_unknown_dataset_is_422(self, client):
        assert client.post("/api/admin/retention/run?dataset=users", headers=H()).status_code == 422


# ── scheduled task ───────────────────────────────────────────────────────────
class TestScheduledTask:
    def test_runs_daily_and_the_noop_weekly_cleanup_is_gone(self):
        schedule = tasks_module.celery_app.conf.beat_schedule
        assert schedule["run-data-retention-daily"]["task"] == "backend.tasks.run_retention"
        assert "cleanup-old-audit-logs" not in schedule

    def test_task_runs_the_retention_pass(self, db, monkeypatch):
        import backend.database as database
        monkeypatch.setattr(database, "SessionLocal", lambda: db)
        db.add(models.Lead(name="a", email="a@x.com", created_at=datetime(2020, 1, 1)))
        db.commit()
        result = tasks_module.run_retention()
        assert result["results"]["leads"]["deleted"] == 1

    def test_the_legacy_task_name_delegates(self, db, monkeypatch):
        import backend.database as database
        monkeypatch.setattr(database, "SessionLocal", lambda: db)
        assert "results" in tasks_module.cleanup_old_audit_logs()
