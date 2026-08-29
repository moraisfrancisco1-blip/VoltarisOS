"""
Migration script: Add missing dispatch fields to vpp_dispatch_records table.

The VPPDispatchRecord model and its writers (backend/routers/vpp.py and
optimization/persistence.py) were aligned to a single contract that includes:

- schedule       : JSON snapshot of the first-step optimization schedule
- solver_status  : solver status string ("optimal", "infeasible", "error")
- committed      : whether this dispatch record is a committed dispatch

This script adds those three columns if they are not already present.

PostgreSQL usage:
    python -m backend.migrations.add_vpp_dispatch_fields

SQLite/local usage:
    python -m backend.migrations.add_vpp_dispatch_fields

Do NOT run this migration against production without explicit approval.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add the missing vpp_dispatch_records columns if they don't exist."""
    print("Adding missing columns to vpp_dispatch_records table...")

    inspector = inspect(engine)

    if "vpp_dispatch_records" not in inspector.get_table_names():
        print("ERROR: vpp_dispatch_records table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("vpp_dispatch_records")}

    columns_to_add = [
        ("schedule", "TEXT"),              # JSON snapshot stored as text
        ("solver_status", "VARCHAR"),      # solver status string
        ("committed", "BOOLEAN DEFAULT FALSE"),
    ]

    for col_name, col_type in columns_to_add:
        if col_name not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE vpp_dispatch_records ADD COLUMN {col_name} {col_type}"))
            print(f"  ✓ Added column: {col_name}")
        else:
            print(f"  - Column already exists: {col_name}")

    print("\n✓ vpp_dispatch_records migration completed successfully")
    print("  Dispatch records can now persist schedule, solver_status, and committed.")


if __name__ == "__main__":
    migrate()