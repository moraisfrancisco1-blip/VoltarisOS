from sqlalchemy import Column, Integer, Float, DateTime, String, JSON, Boolean
from datetime import datetime
from backend.database import Base


class BatteryState(Base):
    __tablename__ = "battery_state"
    id = Column(Integer, primary_key=True, index=True)
    soc = Column(Float)
    power_kw = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Device(Base):
    """Registered integration device (inverter, BESS, meter, SCADA)."""
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    site_id = Column(Integer, nullable=True)
    # Protocol: solaredge | fronius | huawei | sma | modbus_tcp | modbus_rtu | opcua
    protocol = Column(String, nullable=False)
    # Device type label
    device_type = Column(String, default="inverter")  # inverter | bess | meter | wind
    # Connection config stored as JSON
    config = Column(JSON, nullable=False, default={})
    enabled = Column(Boolean, default=True)
    status = Column(String, default="unknown")   # online | offline | error | unknown
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceReading(Base):
    """Normalised time-series reading from any device."""
    __tablename__ = "device_readings"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    # Power / energy
    power_kw = Column(Float, nullable=True)
    energy_kwh = Column(Float, nullable=True)
    # Battery specific
    soc_pct = Column(Float, nullable=True)
    # Temperature
    temp_c = Column(Float, nullable=True)
    # Grid / AC
    voltage_v = Column(Float, nullable=True)
    current_a = Column(Float, nullable=True)
    frequency_hz = Column(Float, nullable=True)
    # Raw payload (full vendor response)
    raw = Column(JSON, nullable=True)
