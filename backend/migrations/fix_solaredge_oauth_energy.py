"""
Migration script: convert SolarEdge-OAuth readings from "day counter" to
per-reading energy.

Until now backend/solaredge_sync.py stored the day's energy-so-far counter in
`device_readings.energy_kwh` on every reading (every 5 minutes). All aggregations
SUM that column assuming it is the energy of the reading's interval, so each
day's total was counted once per reading. This rewrites the existing rows of
`protocol = 'solaredge_oauth'` devices in time order:

- the old counter value is kept in raw["voltaris_day_total_kwh"]
- energy_kwh becomes the energy gained since the previous reading
  (backend/energy_counter.interval_kwh)

Idempotent: rows that already carry the marker are left alone.

Usage:
    python -m backend.migrations.fix_solaredge_oauth_energy
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import SessionLocal
from backend import models
from backend.energy_counter import interval_kwh

PROTOCOL = "solaredge_oauth"
DAY_TOTAL_KEY = "voltaris_day_total_kwh"  # same key as backend/solaredge_sync.py


def migrate():
    """Rewrite legacy solaredge_oauth readings to interval energy."""
    print("Converting solaredge_oauth readings to interval energy...")
    db = SessionLocal()
    try:
        device_ids = [d.id for d in db.query(models.Device.id).filter(models.Device.protocol == PROTOCOL).all()]
        converted = 0
        for device_id in device_ids:
            rows = db.query(models.DeviceReading).filter(
                models.DeviceReading.device_id == device_id,
            ).order_by(models.DeviceReading.timestamp.asc(), models.DeviceReading.id.asc()).all()
            prev_total = None
            for row in rows:
                raw = row.raw if isinstance(row.raw, dict) else {}
                if isinstance(raw.get(DAY_TOTAL_KEY), (int, float)):
                    prev_total = raw[DAY_TOTAL_KEY]  # already converted
                    continue
                day_total = row.energy_kwh  # legacy: the counter itself
                row.raw = {**raw, DAY_TOTAL_KEY: day_total}  # new dict: JSON change detection
                row.energy_kwh = interval_kwh(prev_total, day_total)
                prev_total = day_total
                converted += 1
        db.commit()
        print(f"  ✓ converted {converted} reading(s) on {len(device_ids)} device(s)")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
