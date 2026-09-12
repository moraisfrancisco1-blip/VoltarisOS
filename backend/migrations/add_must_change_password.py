"""
Migration script: Add `must_change_password` to the users table.

Set for accounts created with a temporary password (e.g. the first user of a
new tenant, created together with the tenant). While set, the account can log
in but is forced to change its password before using the platform.

- nullable BOOLEAN, defaults to FALSE — pre-existing accounts are untouched
- SUPER_ADMIN is never part of this flow (enforced in the API, not the schema)

Usage:
    python -m backend.migrations.add_must_change_password
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add the must_change_password column to users if it doesn't exist."""
    print("Adding must_change_password column to users table...")

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        print("ERROR: users table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("users")}

    if "must_change_password" not in existing:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE"
            ))
        print("  ✓ Added column: must_change_password")
    else:
        print("  - Column already exists: must_change_password")

    print("\n✓ must_change_password migration completed successfully")
    print("  Temporary-password accounts must change it on first login")


if __name__ == "__main__":
    migrate()
