"""
Migration script: Add company-profile columns to the tenants table.

Lets Settings > Company actually persist these fields instead of showing
inputs with hardcoded values and no onChange handler. See
backend/routers/company.py's PATCH /api/company.

- nullable VARCHAR, no default -- NULL means "not set"

Usage:
    python -m backend.migrations.add_tenant_company_fields
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add company-profile columns to tenants if they don't exist."""
    print("Adding company-profile columns to tenants table...")

    inspector = inspect(engine)

    if "tenants" not in inspector.get_table_names():
        print("ERROR: tenants table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("tenants")}

    for column in ("vat_number", "address", "country", "website", "support_email", "billing_email"):
        if column not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE tenants ADD COLUMN {column} VARCHAR"))
            print(f"  ✓ Added column: {column}")
        else:
            print(f"  - Column already exists: {column}")

    print("\n✓ tenants company-fields migration completed successfully")


if __name__ == "__main__":
    migrate()
