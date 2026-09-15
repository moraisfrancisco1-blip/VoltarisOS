"""
Migration script: Add `phone` and `job_title` to the users table.

Lets Settings > Profile actually persist these fields instead of showing
decorative inputs a Save button silently ignored. See
backend/routers/auth.py's PATCH /api/auth/me.

- nullable VARCHAR, no default -- NULL means "not set"

Usage:
    python -m backend.migrations.add_user_profile_fields
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add phone and job_title columns to users if they don't exist."""
    print("Adding phone/job_title columns to users table...")

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        print("ERROR: users table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("users")}

    for column in ("phone", "job_title"):
        if column not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} VARCHAR"))
            print(f"  ✓ Added column: {column}")
        else:
            print(f"  - Column already exists: {column}")

    print("\n✓ users profile-fields migration completed successfully")


if __name__ == "__main__":
    migrate()
