"""
Migration script: Add `tilt_deg` and `azimuth_deg` to the sites table.

Lets the solar forecast use the site's real panel orientation via Open-Meteo's
global_tilted_irradiance, instead of assuming the panel lies flat (GHI). Both
columns use Open-Meteo's own convention directly, with no conversion:
  - tilt_deg: 0-90, 0 = flat/horizontal
  - azimuth_deg: 0 = South, -90 = East, 90 = West, +-180 = North

- nullable FLOAT, no default -- NULL means "not configured yet"; the solar
  forecast falls back to flat-horizontal (GHI) irradiance for that site until
  these are set (see forecasting/solar_forecast.py)

Usage:
    python -m backend.migrations.add_site_tilt_azimuth
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def migrate():
    """Add tilt_deg and azimuth_deg columns to sites if they don't exist."""
    print("Adding tilt_deg/azimuth_deg columns to sites table...")

    inspector = inspect(engine)

    if "sites" not in inspector.get_table_names():
        print("ERROR: sites table does not exist. Run the main application first.")
        return

    existing = {c["name"] for c in inspector.get_columns("sites")}

    for column in ("tilt_deg", "azimuth_deg"):
        if column not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE sites ADD COLUMN {column} FLOAT"))
            print(f"  ✓ Added column: {column}")
        else:
            print(f"  - Column already exists: {column}")

    print("\n✓ tilt_deg/azimuth_deg migration completed successfully")


if __name__ == "__main__":
    migrate()
