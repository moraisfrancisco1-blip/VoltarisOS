"""
timescale_models.py — TimescaleDB models for time-series data.

This module defines hypertables optimized for TimescaleDB (PostgreSQL extension).
These models are designed to replace the existing DeviceReading and BatteryState
tables when migrating to TimescaleDB for better time-series performance.

Key features:
- Hypertables for automatic partitioning by time
- Compression for historical data
- Continuous aggregates for downsampling
- Retention policies

Usage:
    # Run migration:
    python -m backend.migrations.setup_timescaledb
    
    # Or import models directly:
    from backend.timescale_models import DeviceReadingTS, BatteryStateTS
"""
from sqlalchemy import Column, Integer, Float, DateTime, String, JSON, Index
from datetime import datetime
from backend.database import Base


class DeviceReadingTS(Base):
    """TimescaleDB hypertable for device readings.
    
    Optimized for:
    - High-frequency inserts (every 30 seconds per device)
    - Time-range queries (last hour, last day, last month)
    - Aggregations (AVG, SUM, MIN, MAX over time windows)
    
    Migration from DeviceReading:
    - Same schema, but with TimescaleDB hypertable
    - Automatic partitioning by 'timestamp'
    - Compression enabled for chunks older than 7 days
    """
    __tablename__ = "device_readings_ts"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    device_id = Column(Integer, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Metrics
    power_kw = Column(Float, nullable=True)
    energy_kwh = Column(Float, nullable=True)
    soc_pct = Column(Float, nullable=True)
    temp_c = Column(Float, nullable=True)
    voltage_v = Column(Float, nullable=True)
    current_a = Column(Float, nullable=True)
    frequency_hz = Column(Float, nullable=True)
    
    # Raw data
    raw = Column(JSON, nullable=True)
    
    # TimescaleDB-specific indexes
    __table_args__ = (
        # Composite index for device + time queries
        Index("ix_device_readings_ts_device_time", "device_id", "timestamp"),
        # Composite index for tenant + time queries
        Index("ix_device_readings_ts_tenant_time", "tenant_id", "timestamp"),
    )
    
    @classmethod
    def get_hypertable_config(cls):
        """Return TimescaleDB hypertable configuration."""
        return {
            "table_name": cls.__tablename__,
            "time_column": "timestamp",
            "chunk_time_interval": "1 day",  # Daily partitions
            "compression": {
                "enabled": True,
                "compress_after": "7 days",
                "segment_by": "device_id",
                "order_by": "timestamp DESC",
            },
            "retention": {
                "enabled": True,
                "drop_after": "2 years",
            },
        }


class BatteryStateTS(Base):
    """TimescaleDB hypertable for battery state tracking.
    
    Optimized for:
    - High-frequency state updates
    - State-of-charge (SOC) trend analysis
    - Power flow tracking
    """
    __tablename__ = "battery_state_ts"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    device_id = Column(Integer, nullable=True, index=True)  # Battery device ID
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Battery metrics
    soc = Column(Float, nullable=False)  # State of charge (0-1)
    power_kw = Column(Float, nullable=False)  # Positive = charging, negative = discharging
    
    # Derived metrics
    energy_kwh = Column(Float, nullable=True)  # Cumulative energy
    temp_c = Column(Float, nullable=True)  # Battery temperature
    voltage_v = Column(Float, nullable=True)  # Battery voltage
    current_a = Column(Float, nullable=True)  # Battery current
    
    # Status
    status = Column(String, nullable=True)  # charging, discharging, idle, fault
    
    # TimescaleDB-specific indexes
    __table_args__ = (
        Index("ix_battery_state_ts_time", "timestamp"),
        Index("ix_battery_state_ts_device_time", "device_id", "timestamp"),
    )
    
    @classmethod
    def get_hypertable_config(cls):
        """Return TimescaleDB hypertable configuration."""
        return {
            "table_name": cls.__tablename__,
            "time_column": "timestamp",
            "chunk_time_interval": "1 day",
            "compression": {
                "enabled": True,
                "compress_after": "7 days",
                "segment_by": "device_id",
                "order_by": "timestamp DESC",
            },
            "retention": {
                "enabled": True,
                "drop_after": "2 years",
            },
        }


class EnergyPriceTS(Base):
    """TimescaleDB hypertable for energy price tracking.
    
    Stores historical and forecasted energy prices from various markets.
    """
    __tablename__ = "energy_prices_ts"
    
    id = Column(Integer, primary_key=True, index=True)
    market = Column(String, nullable=False, index=True)  # MIBEL, EPEX, N2EX, OMIE
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Price data
    price_eur_mwh = Column(Float, nullable=False)
    price_source = Column(String, nullable=True)  # ENTSO-E, EEX, etc.
    
    # Price type
    price_type = Column(String, default="spot")  # spot, forecast, day_ahead, intraday
    
    # Additional data
    currency = Column(String, default="EUR")
    unit = Column(String, default="MWh")
    
    __table_args__ = (
        Index("ix_energy_prices_ts_market_time", "market", "timestamp"),
    )
    
    @classmethod
    def get_hypertable_config(cls):
        """Return TimescaleDB hypertable configuration."""
        return {
            "table_name": cls.__tablename__,
            "time_column": "timestamp",
            "chunk_time_interval": "1 month",  # Monthly partitions for prices
            "compression": {
                "enabled": True,
                "compress_after": "30 days",
                "segment_by": "market",
                "order_by": "timestamp DESC",
            },
            "retention": {
                "enabled": True,
                "drop_after": "5 years",  # Keep price history longer
            },
        }


# ─── Continuous Aggregates (Views) ──────────────────────────────────────────

CONTINUOUS_AGGREGATES = {
    "device_readings_hourly": {
        "source_table": "device_readings_ts",
        "time_bucket": "1 hour",
        "aggregations": {
            "avg_power_kw": "AVG(power_kw)",
            "sum_energy_kwh": "SUM(energy_kwh)",
            "avg_soc_pct": "AVG(soc_pct)",
            "max_power_kw": "MAX(power_kw)",
            "min_power_kw": "MIN(power_kw)",
            "reading_count": "COUNT(*)",
        },
        "group_by": ["tenant_id", "device_id"],
    },
    "device_readings_daily": {
        "source_table": "device_readings_ts",
        "time_bucket": "1 day",
        "aggregations": {
            "avg_power_kw": "AVG(power_kw)",
            "sum_energy_kwh": "SUM(energy_kwh)",
            "avg_soc_pct": "AVG(soc_pct)",
            "max_power_kw": "MAX(power_kw)",
            "min_power_kw": "MIN(power_kw)",
            "reading_count": "COUNT(*)",
        },
        "group_by": ["tenant_id", "device_id"],
    },
    "battery_state_hourly": {
        "source_table": "battery_state_ts",
        "time_bucket": "1 hour",
        "aggregations": {
            "avg_soc": "AVG(soc)",
            "avg_power_kw": "AVG(power_kw)",
            "max_soc": "MAX(soc)",
            "min_soc": "MIN(soc)",
            "charge_energy_kwh": "SUM(CASE WHEN power_kw > 0 THEN power_kw ELSE 0 END)",
            "discharge_energy_kwh": "SUM(CASE WHEN power_kw < 0 THEN ABS(power_kw) ELSE 0 END)",
        },
        "group_by": ["tenant_id", "device_id"],
    },
}