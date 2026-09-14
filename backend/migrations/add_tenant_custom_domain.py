"""
Migration script: Add White-label custom-domain columns to the tenants table.

Lets a tenant request their own domain (e.g. app.acme.com) for the platform,
provisioned for real via Railway's public API (backend/railway_client.py)
when RAILWAY_API_TOKEN is configured -- see backend/routers/white_label.py.

All columns nullable, no defaults -- NULL/None means "no custom domain
requested yet", which is every existing tenant's correct state.

Usage:
    python -m backend.migrations.add_tenant_custom_domain
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


COLUMNS = {
    "custom_domain": "VARCHAR",
    "custom_domain_status": "VARCHAR",
    "custom_domain_railway_id": "VARCHAR",
    "custom_domain_cname_target": "VARCHAR",
    "custom_domain_verification_host": "VARCHAR",
    "custom_domain_verification_value": "VARCHAR",
    "custom_domain_requested_at": "TIMESTAMP",
    "custom_domain_error": "VARCHAR",
}


def migrate():
    """Add the White-label custom-domain columns to tenants if missing."""
    print("Adding custom-domain columns to tenants table...")

    inspector = inspect(engine)

    if "tenants" not in inspector.get_table_names():
        print("ERROR: tenants table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("tenants")}

    for column, coltype in COLUMNS.items():
        if column not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE tenants ADD COLUMN {column} {coltype}"))
            print(f"  ✓ Added column: {column}")
        else:
            print(f"  - Column already exists: {column}")

    # Partial unique index (NULLs allowed, one row per non-null domain) --
    # ADD COLUMN alone doesn't carry the ORM's unique=True over for an
    # already-existing table, so enforce it explicitly here.
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_tenants_custom_domain_unique "
            "ON tenants (custom_domain) WHERE custom_domain IS NOT NULL"
        ))
    print("  ✓ Ensured unique index on custom_domain")

    print("\n✓ tenants custom-domain migration completed successfully")


if __name__ == "__main__":
    migrate()
