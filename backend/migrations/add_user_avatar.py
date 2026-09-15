"""
Migration script: Add `avatar_data_url` to the users table.

Profile picture stored as a base64 data: URL directly on the row, not a
file path -- avoids needing a provisioned volume/object store for what's
typically a small (<=300KB) image. See backend/routers/auth.py's
POST/DELETE /api/auth/me/avatar.

- nullable TEXT, no default -- NULL means "no avatar uploaded"

Usage:
    python -m backend.migrations.add_user_avatar
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add the avatar_data_url column to users if it doesn't exist."""
    print("Adding avatar_data_url column to users table...")

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        print("ERROR: users table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("users")}

    if "avatar_data_url" not in existing:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN avatar_data_url TEXT"
            ))
        print("  ✓ Added column: avatar_data_url")
    else:
        print("  - Column already exists: avatar_data_url")

    print("\n✓ avatar_data_url migration completed successfully")


if __name__ == "__main__":
    migrate()
