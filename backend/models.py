from sqlalchemy import Column, Integer, Float, DateTime
from datetime import datetime
from backend.database import Base

class BatteryState(Base):

    __tablename__ = "battery_state"

    id = Column(Integer, primary_key=True, index=True)
    soc = Column(Float)
    power_kw = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)