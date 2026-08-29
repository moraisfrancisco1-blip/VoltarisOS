"""Migration script: add `external_id` (physical serial) to the devices table.

Maps physical equipment to the Voltaris internal device_id. Rules:
- nullable — existing devices keep NULL until configured
- unique ONLY within a tenant and only when the value is present (partial index)
- never replaces the internal device_id
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add nullable `external_id` + per-tenant partial unique index on devices."""
    inspector = inspect(engine)

    if "devices" not in inspector.get_table_names():
        print("ERROR: devices table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("devices")}
    if "external_id" not in existing:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE devices ADD COLUMN external_id VARCHAR"))
        print("  ✓ Added column: devices.external_id")
    else:
        print("  - Column already exists: devices.external_id")

    # Partial unique index: same external_id allowed across tenants, unique per
    # tenant, and only enforced when the value is present (NULLs are not equal).
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_tenant_external "
            "ON devices (tenant_id, external_id) WHERE external_id IS NOT NULL"
        ))

    print("✓ devices.external_id migration completed (per-tenant partial unique index)")


if __name__ == "__main__":
    migrate()
