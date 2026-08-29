"""Migration script: add `timezone` (IANA) to the sites table.

Used for the first physical park onboarding — the timezone drives local solar
forecast / daily reporting / operations later. Nullable (no invented backfill):
existing sites simply have no timezone configured until one is set.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add the nullable `timezone` column to sites if not present."""
    inspector = inspect(engine)

    if "sites" not in inspector.get_table_names():
        print("ERROR: sites table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("sites")}
    if "timezone" not in existing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE sites ADD COLUMN timezone VARCHAR"))
        print("  ✓ Added column: sites.timezone")
    else:
        print("  - Column already exists: sites.timezone")

    print("✓ sites.timezone migration completed (nullable IANA timezone)")


if __name__ == "__main__":
    migrate()
