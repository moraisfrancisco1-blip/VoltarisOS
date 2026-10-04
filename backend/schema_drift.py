"""schema_drift.py — does the live database have everything the models expect?

`create_all()` creates missing tables but never alters existing ones, and the
ad-hoc migrations (backend/migrations) are written by hand, so a model column
that nobody wrote a migration for stays missing in production while tests (fresh
databases) pass. The first symptom is a 500 on every query touching that table.

This is a read-only check for exactly that: tables and columns the models declare
that the database does not have. It deliberately ignores extras in the database
(old columns are harmless) and type/nullability differences (they do not break
queries); it never changes anything.
"""
import logging

from sqlalchemy import inspect

from backend import models

logger = logging.getLogger(__name__)


def find_drift(bind) -> dict:
    """Return {"missing_tables": [...], "missing_columns": {table: [col, ...]}}."""
    inspector = inspect(bind)
    existing = set(inspector.get_table_names())
    missing_tables, missing_columns = [], {}
    for table in models.Base.metadata.sorted_tables:
        if table.name not in existing:
            missing_tables.append(table.name)
            continue
        have = {c["name"] for c in inspector.get_columns(table.name)}
        gone = sorted(c.name for c in table.columns if c.name not in have)
        if gone:
            missing_columns[table.name] = gone
    return {"missing_tables": sorted(missing_tables), "missing_columns": missing_columns}


def drift_status(bind) -> dict:
    """Readiness-style summary; never raises (an unreadable schema is 'unknown')."""
    try:
        drift = find_drift(bind)
    except Exception as exc:
        logger.warning("Schema drift check could not run: %s", exc)
        return {"status": "unknown", "required": True, "detail": "could not inspect the database schema"}
    if not drift["missing_tables"] and not drift["missing_columns"]:
        return {"status": "healthy", "required": True}
    return {"status": "drift", "required": True, **drift,
            "detail": "the database lacks tables/columns the models declare: add a migration in backend/migrations"}


def warn_on_drift(bind) -> None:
    """Startup hook: log loudly, never block the boot."""
    status = drift_status(bind)
    if status["status"] == "drift":
        logger.error("SCHEMA DRIFT: missing tables=%s missing columns=%s",
                     status["missing_tables"], status["missing_columns"])
