"""
Migration runner: deterministic, idempotent execution of the existing ad-hoc
migrations. Tracks applied migrations in the `schema_migrations` table.

Runs AFTER `Base.metadata.create_all()` (which never alters existing tables) so
that schema additions (columns/tables/seeds) in the standalone migration scripts
are applied automatically and in a fixed order.

Usage:
    from backend.migrations.runner import run_migrations
    run_migrations()
"""
import importlib
import sys

from sqlalchemy import text

from backend.database import engine
from backend.models import utcnow_naive

# Fixed, ordered list of migrations to run automatically.
# `setup_timescaledb` is intentionally NOT included (requires the TimescaleDB
# extension and is run manually/opt-in).
#
# NOTE on ordering: `add_sites_table` seeds a `Tenant` through the current ORM
# model, which now includes the Stripe columns. It therefore depends on
# `add_stripe_subscription_fields` having already added those columns, so the
# Stripe migration runs BEFORE the sites migration.
MIGRATIONS = [
    "add_2fa_fields",
    "add_audit_logs",
    "add_vpp_dispatch_fields",
    "add_stripe_subscription_fields",
    "add_sites_table",
    "add_device_reading_unique",
    "add_site_timezone",
    "add_device_external_id",
]


def _create_tracking_table():
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "name VARCHAR PRIMARY KEY, "
            "applied_at TIMESTAMP NOT NULL)"
        ))


def _applied() -> set:
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT name FROM schema_migrations")).fetchall()
    return {r[0] for r in rows}


def _mark_applied(name: str) -> None:
    now = utcnow_naive()
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(
                text("INSERT INTO schema_migrations (name, applied_at) "
                     "VALUES (:n, :t) ON CONFLICT (name) DO NOTHING"),
                {"n": name, "t": now},
            )
        else:
            conn.execute(
                text("INSERT OR IGNORE INTO schema_migrations (name, applied_at) "
                     "VALUES (:n, :t)"),
                {"n": name, "t": now},
            )


def _ensure_utf8_output():
    """Guarantee the migration scripts' progress prints (e.g. '\u2713') do not
    crash on consoles whose default codec is not UTF-8 (e.g. Windows cp1252)."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass


def run_migrations() -> list:
    """Apply pending migrations in order, recording each only after success.

    Returns the list of migration names applied in this invocation (empty if
    all were already applied).
    """
    _ensure_utf8_output()
    _create_tracking_table()
    applied = _applied()
    applied_now = []
    for name in MIGRATIONS:
        if name in applied:
            continue
        mod = importlib.import_module(f"backend.migrations.{name}")
        mod.migrate()  # raises on failure -> not marked applied
        _mark_applied(name)
        applied_now.append(name)
    return applied_now
