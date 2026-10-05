"""
Migration script: resync the PostgreSQL id sequence of `sites`.

`add_sites_table` seeds sites with explicit ids (1, 2). On PostgreSQL an
INSERT with an explicit id does not advance the serial sequence, so the first
real `POST /api/sites` got id=1 and failed with
`duplicate key value violates unique constraint "sites_pkey"` (HTTP 500).

Sets the sequence so the next generated id is MAX(id)+1. Idempotent; a no-op on
SQLite (which derives ids from MAX(rowid) itself).

Usage:
    python -m backend.migrations.fix_sites_id_sequence
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Point sites' id sequence past the highest existing id (PostgreSQL only)."""
    print("Resyncing sites id sequence...")

    if engine.dialect.name != "postgresql":
        print("  - Not PostgreSQL, nothing to do")
        return

    if "sites" not in inspect(engine).get_table_names():
        print("ERROR: sites table does not exist. Run the main application first.")
        return

    with engine.begin() as conn:
        # pg_get_serial_sequence is NULL when the column has no owned sequence;
        # setval is strict, so that case is a harmless NULL no-op.
        conn.execute(text(
            "SELECT setval(pg_get_serial_sequence('sites', 'id'), "
            "COALESCE((SELECT MAX(id) FROM sites), 0) + 1, false)"
        ))
    print("  ✓ sites id sequence resynced")


if __name__ == "__main__":
    migrate()
