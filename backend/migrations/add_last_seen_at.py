"""
Migration script: Add `last_seen_at` to the users table.

Tracks when a user was last actually active in the app, distinct from
`last_login` (which only records the moment of login). Updated by
get_current_user() in backend/security.py on authenticated requests,
throttled to at most once per 60 seconds per user.

- nullable TIMESTAMP, no default — NULL means "never seen since this
  column existed" (pre-existing accounts, or accounts that haven't made an
  authenticated request since deploy)

Usage:
    python -m backend.migrations.add_last_seen_at
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add the last_seen_at column to users if it doesn't exist."""
    print("Adding last_seen_at column to users table...")

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        print("ERROR: users table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("users")}

    if "last_seen_at" not in existing:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP"
            ))
        print("  ✓ Added column: last_seen_at")
    else:
        print("  - Column already exists: last_seen_at")

    print("\n✓ last_seen_at migration completed successfully")


if __name__ == "__main__":
    migrate()
