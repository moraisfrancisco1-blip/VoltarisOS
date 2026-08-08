"""
schemas.py — Pydantic schemas for validation.

Centralized validation schemas for API endpoints.
Used for batch ingest, VPP bids, and trading operations.
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ─── Device Reading Schemas ──────────────────────────────────────────────────

class DeviceReadingBase(BaseModel):
    """Base schema for device readings."""
    power_kw: Optional[float] = Field(None, ge=0, description="Active power in kW")
    energy_kwh: Optional[float] = Field(None, ge=0, description="Energy in kWh")
    soc_pct: Optional[float] = Field(None, ge=0, le=100, description="State of charge %")
    temp_c: Optional[float] = Field(None, ge=-50, le=100, description="Temperature in °C")
    voltage_v: Optional[float] = Field(None, ge=0, le=10000, description="Voltage in V")
    current_a: Optional[float] = Field(None, ge=-10000, le=10000, description="Current in A")
    frequency_hz: Optional[float] = Field(None, ge=0, le=100, description="Frequency in Hz")
    raw: Optional[Dict[str, Any]] = Field(None, description="Raw data from device")


class DeviceReadingCreate(DeviceReadingBase):
    """Schema for creating a single device reading."""
    device_id: int = Field(..., gt=0, description="Device ID")
    timestamp: Optional[datetime] = Field(None, description="Reading timestamp (defaults to now)")


class DeviceReadingBatchItem(DeviceReadingBase):
    """Schema for a single item in batch ingest."""
    device_id: int = Field(..., gt=0, description="Device ID")
    timestamp: Optional[datetime] = Field(None, description="Reading timestamp (defaults to now)")


class DeviceReadingBatchRequest(BaseModel):
    """Schema for batch ingest request."""
    readings: List[DeviceReadingBatchItem] = Field(
        ..., 
        min_items=1, 
        max_items=10000,  # Limit batch size
        description="List of readings to ingest (max 10000)"
    )
    
    @validator('readings')
    def validate_readings_not_empty(cls, v):
        if not v:
            raise ValueError("At least one reading is required")
        return v


class DeviceReadingBatchResponse(BaseModel):
    """Schema for batch ingest response."""
    accepted: int = Field(..., description="Number of readings accepted")
    rejected: int = Field(..., description="Number of readings rejected")
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Validation errors")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ─── VPP Bid Schemas ─────────────────────────────────────────────────────────

class BidDirection(str, Enum):
    """Valid bid directions."""
    SELL = "sell"
    BUY = "buy"
    FCR_UP = "fcr_up"
    FCR_DOWN = "fcr_down"
    AFRR_UP = "afrr_up"
    AFRR_DOWN = "afrr_down"


class VPPBidCreate(BaseModel):
    """Schema for creating a VPP bid."""
    quantity_kw: float = Field(..., gt=0, description="Bid quantity in kW")
    price_eur_mwh: Optional[float] = Field(None, ge=0, description="Price in EUR/MWh")
    direction: BidDirection = Field(..., description="Bid direction")
    delivery_period: Optional[str] = Field(None, description="Delivery period (ISO datetime or 'H+1')")
    
    @validator('quantity_kw')
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        if v > 100000:  # 100 MW max
            raise ValueError("Quantity exceeds maximum allowed (100 MW)")
        return v
    
    @validator('price_eur_mwh')
    def validate_price(cls, v):
        if v is not None and v > 10000:  # 10000 EUR/MWh max (sanity check)
            raise ValueError("Price exceeds reasonable maximum")
        return v


class VPPBidOut(BaseModel):
    """Schema for VPP bid output."""
    id: int
    vpp_id: int
    market: str
    quantity_kw: float
    price_eur_mwh: Optional[float]
    direction: str
    status: str
    pnl_eur: Optional[float]
    submitted_at: datetime
    
    class Config:
        from_attributes = True


# ─── Trading Schemas ─────────────────────────────────────────────────────────

class PricePoint(BaseModel):
    """Schema for price point in arbitrage signals."""
    h: str = Field(..., description="Hour identifier")
    price: float = Field(..., ge=0, description="Price in EUR/MWh")
    forecast: Optional[float] = Field(None, ge=0, description="Forecasted price")


class SignalsRequest(BaseModel):
    """Schema for arbitrage signals request."""
    prices: List[PricePoint] = Field(..., min_items=1, description="List of price points")
    bess_kwh: float = Field(500, gt=0, le=10000, description="Battery capacity in kWh")
    efficiency: float = Field(0.92, gt=0, le=1, description="Round-trip efficiency")


class SignalOut(BaseModel):
    """Schema for arbitrage signal output."""
    h: str
    price: float
    forecast: Optional[float]
    action: str  # "charge", "discharge", "hold"
    score: int = Field(..., ge=0, le=100)
    spread: float
    potential: float


class SignalsResponse(BaseModel):
    """Schema for arbitrage signals response."""
    signals: List[SignalOut]
    summary: Optional[Dict[str, Any]] = None


# ─── Validation Schemas ──────────────────────────────────────────────────────

class ValidationResult(BaseModel):
    """Schema for validation result."""
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)