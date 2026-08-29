"""
Migration script: Add Stripe subscription fields to tenants and create stripe_events.

Idempotent: safe to run repeatedly. Adds nullable Stripe subscription columns to
the `tenants` table (if missing) and creates the `stripe_events` table used for
webhook idempotency.

Usage:
    python -m backend.migrations.add_stripe_subscription_fields
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from backend.models import StripeEvent
from sqlalchemy import inspect, text


TENANT_COLUMNS = [
    ("stripe_customer_id", "VARCHAR"),
    ("stripe_subscription_id", "VARCHAR"),
    ("subscription_status", "VARCHAR"),
    ("subscription_end", "TIMESTAMP"),
]


def migrate():
    inspector = inspect(engine)

    # 1. Add missing Stripe columns to tenants (idempotent).
    if "tenants" in inspector.get_table_names():
        existing = {c["name"] for c in inspector.get_columns("tenants")}
        for col_name, col_type in TENANT_COLUMNS:
            if col_name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE tenants ADD COLUMN {col_name} {col_type}"))
                print(f"✓ Added column: tenants.{col_name}")
            else:
                print(f"- Column already exists: tenants.{col_name}")
    else:
        print("NOTE: tenants table does not exist yet; create_all will include the new columns.")

    # 2. Create stripe_events table (idempotent).
    StripeEvent.__table__.create(bind=engine, checkfirst=True)
    print("✓ stripe_events table ensured")


if __name__ == "__main__":
    migrate()
