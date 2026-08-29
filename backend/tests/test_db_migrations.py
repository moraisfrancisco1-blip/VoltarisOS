"""Tests for the migration runner (deterministic, idempotent schema management).

These tests use an in-memory SQLite engine and redirect the migration modules to
it, so no persistent DB is touched.
"""
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models


def _bind(monkeypatch, engine, Session):
    """Point the runner and all migration modules at the given engine/session."""
    import backend.migrations.runner as runner
    import backend.migrations.add_2fa_fields as m2fa
    import backend.migrations.add_audit_logs as maudit
    import backend.migrations.add_vpp_dispatch_fields as mvpp
    import backend.migrations.add_sites_table as msites
    import backend.migrations.add_stripe_subscription_fields as mstripe
    import backend.migrations.add_device_reading_unique as mread
    import backend.migrations.add_site_timezone as mtz
    import backend.migrations.add_device_external_id as mext

    for mod in (runner, m2fa, maudit, mvpp, msites, mstripe, mread, mtz, mext):
        monkeypatch.setattr(mod, "engine", engine)
    monkeypatch.setattr(msites, "SessionLocal", Session)
    return runner


def _make_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return engine, Session


# ── A. Initial run ──────────────────────────────────────────────────────────
def test_initial_run_records_all_migrations(monkeypatch):
    engine, Session = _make_db()
    runner = _bind(monkeypatch, engine, Session)

    applied = runner.run_migrations()
    assert set(applied) == set(runner.MIGRATIONS)

    db = Session()
    rows = db.execute(text("SELECT name FROM schema_migrations ORDER BY name")).fetchall()
    assert {r[0] for r in rows} == set(runner.MIGRATIONS)
    db.close()


# ── B. Second run idempotent ────────────────────────────────────────────────
def test_second_run_is_idempotent(monkeypatch):
    engine, Session = _make_db()
    runner = _bind(monkeypatch, engine, Session)

    runner.run_migrations()
    applied_again = runner.run_migrations()
    assert applied_again == []

    db = Session()
    count = db.execute(text("SELECT COUNT(*) FROM schema_migrations")).scalar()
    assert count == len(runner.MIGRATIONS)
    db.close()


# ── C. Sites seed ───────────────────────────────────────────────────────────
def test_sites_seeded_and_not_duplicated(monkeypatch):
    engine, Session = _make_db()
    runner = _bind(monkeypatch, engine, Session)

    runner.run_migrations()
    runner.run_migrations()

    db = Session()
    sites = {s.id for s in db.query(models.Site).all()}
    assert {1, 2}.issubset(sites)
    assert db.query(models.Site).count() == 2
    db.close()


# ── D. Stripe schema present ─────────────────────────────────────────────────
def test_stripe_schema_present(monkeypatch):
    engine, Session = _make_db()
    runner = _bind(monkeypatch, engine, Session)
    runner.run_migrations()

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert "stripe_events" in tables
    tenant_cols = {c["name"] for c in inspector.get_columns("tenants")}
    assert {
        "stripe_customer_id", "stripe_subscription_id",
        "subscription_status", "subscription_end",
    }.issubset(tenant_cols)


# ── Upgrade of an old schema (real migration path) ──────────────────────────
def test_old_schema_upgraded(monkeypatch):
    """An existing DB missing the new columns/tables gets them applied."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Pre-2FA / pre-Stripe / pre-sites schema (no Base.metadata.create_all).
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE tenants (id INTEGER PRIMARY KEY, name VARCHAR, "
            "slug VARCHAR UNIQUE, plan VARCHAR, max_sites INTEGER, "
            "max_devices INTEGER, logo_url VARCHAR, primary_color VARCHAR, "
            "created_at TIMESTAMP, active BOOLEAN)"
        ))
        conn.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, tenant_id INTEGER, "
            "email VARCHAR, password_hash VARCHAR, name VARCHAR, role VARCHAR, "
            "color VARCHAR, active BOOLEAN, last_login TIMESTAMP, "
            "created_at TIMESTAMP)"
        ))
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    runner = _bind(monkeypatch, engine, Session)

    runner.run_migrations()

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert {"sites", "stripe_events", "audit_logs", "schema_migrations"}.issubset(tables)

    tenant_cols = {c["name"] for c in inspector.get_columns("tenants")}
    assert {
        "stripe_customer_id", "stripe_subscription_id",
        "subscription_status", "subscription_end",
    }.issubset(tenant_cols)

    user_cols = {c["name"] for c in inspector.get_columns("users")}
    assert "totp_secret" in user_cols


# ── E. Failure safety ────────────────────────────────────────────────────────
def test_failing_migration_is_not_recorded(monkeypatch):
    engine, Session = _make_db()
    runner = _bind(monkeypatch, engine, Session)

    # Force the first migration to fail.
    import backend.migrations.add_2fa_fields as m2fa

    def boom():
        raise RuntimeError("boom")

    monkeypatch.setattr(m2fa, "migrate", boom)

    with pytest.raises(RuntimeError):
        runner.run_migrations()

    # Nothing was recorded as applied.
    db = Session()
    count = db.execute(text("SELECT COUNT(*) FROM schema_migrations")).scalar()
    assert count == 0
    db.close()

