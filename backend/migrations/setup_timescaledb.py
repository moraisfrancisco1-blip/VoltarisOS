"""
Migration script: Setup TimescaleDB hypertables.

This script creates TimescaleDB hypertables for time-series data.
Requires TimescaleDB extension to be installed on PostgreSQL.

Usage:
    python -m backend.migrations.setup_timescaledb

Prerequisites:
    - PostgreSQL with TimescaleDB extension
    - Run: CREATE EXTENSION IF NOT EXISTS timescaledb;
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import engine
from sqlalchemy import inspect, text


def check_timescaledb():
    """Check if TimescaleDB extension is installed."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')"
            ))
            return result.scalar()
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}")
        return False


def setup_hypertable(table_name: str, time_column: str, chunk_interval: str = "1 day"):
    """Convert a table to a TimescaleDB hypertable."""
    try:
        with engine.begin() as conn:
            # Create hypertable
            conn.execute(text(f"""
                SELECT create_hypertable(
                    '{table_name}', 
                    '{time_column}',
                    chunk_time_interval => INTERVAL '{chunk_interval}',
                    if_not_exists => TRUE
                )
            """))
            print(f"  ✓ Hypertable created: {table_name}")
    except Exception as e:
        print(f"  ✗ Error creating hypertable {table_name}: {e}")


def setup_compression(table_name: str, compress_after: str, segment_by: str, order_by: str):
    """Enable compression for a hypertable."""
    try:
        with engine.begin() as conn:
            # Set compression settings
            conn.execute(text(f"""
                ALTER TABLE {table_name} SET (
                    timescaledb.compress,
                    timescaledb.compress_segmentby = '{segment_by}',
                    timescaledb.compress_orderby = '{order_by}'
                )
            """))
            
            # Add compression policy
            conn.execute(text(f"""
                SELECT add_compression_policy(
                    '{table_name}',
                    compress_after => INTERVAL '{compress_after}',
                    if_not_exists => TRUE
                )
            """))
            print(f"  ✓ Compression enabled for: {table_name}")
    except Exception as e:
        print(f"  ✗ Error setting up compression for {table_name}: {e}")


def setup_retention(table_name: str, drop_after: str):
    """Setup retention policy for a hypertable."""
    try:
        with engine.begin() as conn:
            conn.execute(text(f"""
                SELECT add_retention_policy(
                    '{table_name}',
                    drop_after => INTERVAL '{drop_after}',
                    if_not_exists => TRUE
                )
            """))
            print(f"  ✓ Retention policy set for: {table_name}")
    except Exception as e:
        print(f"  ✗ Error setting up retention for {table_name}: {e}")


def create_continuous_aggregate(view_name: str, config: dict):
    """Create a continuous aggregate view."""
    source_table = config["source_table"]
    time_bucket = config["time_bucket"]
    aggregations = config["aggregations"]
    group_by = config["group_by"]
    
    # Build aggregation SQL
    agg_sql = ", ".join([f"{expr} AS {name}" for name, expr in aggregations.items()])
    group_sql = ", ".join([f"time_bucket('{time_bucket}', timestamp)"] + group_by)
    
    try:
        with engine.begin() as conn:
            conn.execute(text(f"""
                CREATE MATERIALIZED VIEW IF NOT EXISTS {view_name}
                WITH (timescaledb.continuous) AS
                SELECT 
                    time_bucket('{time_bucket}', timestamp) AS bucket,
                    {", ".join(group_by)},
                    {agg_sql}
                FROM {source_table}
                GROUP BY {group_sql}
                WITH NO DATA
            """))
            
            # Add refresh policy
            conn.execute(text(f"""
                SELECT add_continuous_aggregate_policy('{view_name}',
                    start_offset => INTERVAL '3 {time_bucket.split()[1]}',
                    end_offset => INTERVAL '1 {time_bucket.split()[1]}',
                    schedule_interval => INTERVAL '1 {time_bucket.split()[1]}',
                    if_not_exists => TRUE
                )
            """))
            print(f"  ✓ Continuous aggregate created: {view_name}")
    except Exception as e:
        print(f"  ✗ Error creating continuous aggregate {view_name}: {e}")


def migrate():
    """Run TimescaleDB migration."""
    print("Setting up TimescaleDB hypertables...")
    
    # Check if TimescaleDB is installed
    if not check_timescaledb():
        print("\nERROR: TimescaleDB extension is not installed.")
        print("Please run: CREATE EXTENSION IF NOT EXISTS timescaledb;")
        print("Or install TimescaleDB: https://docs.timescale.com/install/latest/")
        return
    
    print("✓ TimescaleDB extension detected\n")
    
    # Import models
    from backend.timescale_models import (
        DeviceReadingTS, BatteryStateTS, EnergyPriceTS,
        CONTINUOUS_AGGREGATES
    )
    
    # Create tables
    from backend.database import Base
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created\n")
    
    # Setup hypertables
    print("Creating hypertables...")
    
    device_config = DeviceReadingTS.get_hypertable_config()
    setup_hypertable(device_config["table_name"], device_config["time_column"], device_config["chunk_time_interval"])
    
    battery_config = BatteryStateTS.get_hypertable_config()
    setup_hypertable(battery_config["table_name"], battery_config["time_column"], battery_config["chunk_time_interval"])
    
    price_config = EnergyPriceTS.get_hypertable_config()
    setup_hypertable(price_config["table_name"], price_config["time_column"], price_config["chunk_time_interval"])
    
    print()
    
    # Setup compression
    print("Setting up compression...")
    
    setup_compression(
        device_config["table_name"],
        device_config["compression"]["compress_after"],
        device_config["compression"]["segment_by"],
        device_config["compression"]["order_by"]
    )
    
    setup_compression(
        battery_config["table_name"],
        battery_config["compression"]["compress_after"],
        battery_config["compression"]["segment_by"],
        battery_config["compression"]["order_by"]
    )
    
    setup_compression(
        price_config["table_name"],
        price_config["compression"]["compress_after"],
        price_config["compression"]["segment_by"],
        price_config["compression"]["order_by"]
    )
    
    print()
    
    # Setup retention
    print("Setting up retention policies...")
    
    setup_retention(device_config["table_name"], device_config["retention"]["drop_after"])
    setup_retention(battery_config["table_name"], battery_config["retention"]["drop_after"])
    setup_retention(price_config["table_name"], price_config["retention"]["drop_after"])
    
    print()
    
    # Create continuous aggregates
    print("Creating continuous aggregates...")
    
    for view_name, config in CONTINUOUS_AGGREGATES.items():
        create_continuous_aggregate(view_name, config)
    
    print("\n✓ TimescaleDB migration completed successfully!")
    print("\nNext steps:")
    print("  1. Update DATABASE_URL to point to TimescaleDB instance")
    print("  2. Run data migration from old tables to hypertables")
    print("  3. Update application code to use new models")


if __name__ == "__main__":
    migrate()