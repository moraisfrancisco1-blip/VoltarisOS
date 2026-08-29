"""Migration script: add a unique index on device_readings(device_id, timestamp).

Enforces reading idempotency: a gateway retry re-sending the same (device_id,
timestamp) is treated as a duplicate and never double-persisted (so interval-delta
energy is never summed twice).

Idempotent: deduplicates any existing exact duplicates (keeping the earliest row)
and creates the unique index with IF NOT EXISTS.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Deduplicate existing duplicates and add the unique (device_id, timestamp) index."""
    inspector = inspect(engine)

    if "device_readings" not in inspector.get_table_names():
        print("ERROR: device_readings table does not exist. Run the main application first.")
        return

    with engine.begin() as conn:
        # Collapse any existing exact duplicates, keeping the earliest row (min id).
        conn.execute(text(
            "DELETE FROM device_readings WHERE id NOT IN "
            "(SELECT MIN(id) FROM device_readings GROUP BY device_id, timestamp)"
        ))
        # Unique index (safe to re-run).
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_device_reading_device_timestamp "
            "ON device_readings (device_id, timestamp)"
        ))

    print("✓ device_readings unique index (device_id, timestamp) applied")
    print("  Gateway retries with the same device_id+timestamp are now idempotent.")


if __name__ == "__main__":
    migrate()
