"""
Migration script: count the energy the SolarEdge counter already held at the
very first reading of each solaredge_oauth device.

fix_solaredge_oauth_energy stored the first reading of a device as 0 kWh ("no
previous reading, cannot place it in time"). But the counter is "energy so far
TODAY", so what it held at that first reading was produced today and belongs in
today's totals; only its split across the hours is unknown. That made the first
day's production, CO2 and value too low.

For each solaredge_oauth device this sets the earliest reading's energy_kwh to
the day counter it was taken at (kept in raw["voltaris_day_total_kwh"]), only if
it is currently 0. Idempotent: afterwards it is no longer 0.

Usage:
    python -m backend.migrations.fix_solaredge_first_reading
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import SessionLocal
from backend import models

PROTOCOL = "solaredge_oauth"
DAY_TOTAL_KEY = "voltaris_day_total_kwh"  # same key as backend/solaredge_sync.py


def migrate():
    """Give each solaredge_oauth device's first reading the energy it already carried."""
    print("Counting the energy held at the first solaredge_oauth reading...")
    db = SessionLocal()
    try:
        device_ids = [d.id for d in db.query(models.Device.id).filter(models.Device.protocol == PROTOCOL).all()]
        fixed = 0
        for device_id in device_ids:
            first = db.query(models.DeviceReading).filter(
                models.DeviceReading.device_id == device_id,
            ).order_by(models.DeviceReading.timestamp.asc(), models.DeviceReading.id.asc()).first()
            if first is None:
                continue
            raw = first.raw if isinstance(first.raw, dict) else {}
            counter = raw.get(DAY_TOTAL_KEY)
            if isinstance(counter, (int, float)) and counter > 0 and not first.energy_kwh:
                first.energy_kwh = float(counter)
                fixed += 1
        db.commit()
        print(f"  ✓ updated {fixed} first reading(s) on {len(device_ids)} device(s)")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
