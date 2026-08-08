"""
Migration script: Add 2FA/TOTP fields to users table.

This script adds the following columns to the users table:
- totp_secret: Base32-encoded TOTP secret
- totp_enabled: Boolean flag for 2FA status
- totp_backup_codes: JSON array of hashed backup codes

Run this script once to add the columns to your database.

Usage:
    python -m backend.migrations.add_2fa_fields
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add 2FA columns to users table if they don't exist."""
    print("Adding 2FA columns to users table...")
    
    inspector = inspect(engine)
    
    if "users" not in inspector.get_table_names():
        print("ERROR: users table does not exist. Run the main application first.")
        return
    
    existing = {c["name"] for c in inspector.get_columns("users")}
    
    columns_to_add = [
        ("totp_secret", "VARCHAR"),
        ("totp_enabled", "BOOLEAN DEFAULT FALSE"),
        ("totp_backup_codes", "TEXT"),  # JSON stored as text
    ]
    
    for col_name, col_type in columns_to_add:
        if col_name not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
            print(f"  ✓ Added column: {col_name}")
        else:
            print(f"  - Column already exists: {col_name}")
    
    print("\n✓ 2FA migration completed successfully")
    print("  Users can now enable 2FA via POST /api/2fa/setup")


if __name__ == "__main__":
    migrate()