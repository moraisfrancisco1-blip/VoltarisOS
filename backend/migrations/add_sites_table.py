"""
Migration script: Create the `sites` table and migrate the seed sites (IDs 1 and 2).

Idempotent: safe to run repeatedly. Creates the `sites` table if missing,
ensures the SUPER_ADMIN tenant ("VoltarisOS Admin", slug "voltarisos-admin")
exists, and inserts the two seed sites (IDs 1 and 2) without duplicating them.

Usage:
    python -m backend.migrations.add_sites_table
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine, SessionLocal
from backend.models import Site, Tenant
from sqlalchemy import inspect, text

SEED_SITES = [
    {
        "id": 1,
        "name": "Rotterdam Noord ",
        "location": "Rotterdam, NL",
        "lat": 51.9225,
        "lng": 4.4792,
        "solar_kw": 12.5,
        "battery_kwh": 20.0,
        "ev_chargers": 2,
        "owner": "Francisco Morais",
        "status": "active",
    },
    {
        "id": 2,
        "name": "Rebordelo",
        "location": "REbordelo",
        "lat": 41.7304837,
        "lng": -7.1639982,
        "solar_kw": 150.0,
        "battery_kwh": 150.0,
        "ev_chargers": 2,
        "owner": "Francisco Morais",
        "status": "active",
    },
]

ADMIN_TENANT_SLUG = "voltarisos-admin"
ADMIN_TENANT_NAME = "VoltarisOS Admin"
ADMIN_TENANT_PLAN = "enterprise"
ADMIN_TENANT_MAX_SITES = 999


def migrate():
    inspector = inspect(engine)
    dialect = engine.dialect.name

    # 1. Create the sites table if missing.
    if "sites" not in inspector.get_table_names():
        Site.__table__.create(bind=engine, checkfirst=True)
        print("✓ Created sites table")
    else:
        print("- sites table already exists")

    # 2. Add FK constraints on existing devices/vpp_site_memberships (Postgres only).
    #    SQLite cannot ADD CONSTRAINT FOREIGN KEY via ALTER TABLE; model-level FKs
    #    apply on fresh create_all() databases.
    if dialect == "postgresql":
        _add_fk_if_missing(
            inspector, "devices", "site_id",
            "fk_devices_site_id_sites", "sites", "id", "SET NULL",
        )
        _add_fk_if_missing(
            inspector, "vpp_site_memberships", "site_id",
            "fk_vpp_site_memberships_site_id_sites", "sites", "id", "CASCADE",
        )

    # 3. Ensure the SUPER_ADMIN tenant exists, then migrate seed sites (IDs 1, 2).
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.slug == ADMIN_TENANT_SLUG).first()
        if not tenant:
            tenant = Tenant(
                name=ADMIN_TENANT_NAME,
                slug=ADMIN_TENANT_SLUG,
                plan=ADMIN_TENANT_PLAN,
                max_sites=ADMIN_TENANT_MAX_SITES,
                max_devices=50,
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"✓ Created tenant '{ADMIN_TENANT_NAME}' (id={tenant.id})")
        else:
            print(f"- tenant '{ADMIN_TENANT_NAME}' already exists (id={tenant.id})")

        for seed in SEED_SITES:
            if db.query(Site).filter(Site.id == seed["id"]).first():
                print(f"- site id={seed['id']} already exists, skipping")
                continue
            db.add(Site(tenant_id=tenant.id, **seed))
            print(f"✓ Migrated site id={seed['id']} ({seed['name']})")
        db.commit()
    finally:
        db.close()


def _add_fk_if_missing(inspector, table, column, constraint_name, ref_table, ref_column, ondelete):
    existing = {c["name"] for c in inspector.get_foreign_keys(table)}
    if constraint_name in existing:
        print(f"- FK {constraint_name} already exists")
        return
    with engine.begin() as conn:
        conn.execute(text(
            f"ALTER TABLE {table} ADD CONSTRAINT {constraint_name} "
            f"FOREIGN KEY ({column}) REFERENCES {ref_table} ({ref_column}) "
            f"ON DELETE {ondelete}"
        ))
    print(f"✓ Added FK {constraint_name}")


if __name__ == "__main__":
    migrate()
