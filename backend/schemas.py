"""
schemas.py — Pydantic schemas for validation.

Centralized validation schemas for API endpoints.
Used for batch ingest, VPP bids, trading operations, and auth DTOs.
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List, Dict, Any, Set
from datetime import datetime
from enum import Enum
from backend.models import utcnow_naive


# ─── Auth & RBAC Enums ────────────────────────────────────────────────────────

class SystemRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    TENANT_ADMIN = "TENANT_ADMIN"
    TENANT_MEMBER = "TENANT_MEMBER"


class SubscriptionPlan(str, Enum):
    BETA = "beta"
    HOME = "home"
    SMART = "smart"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str
    totp_code: str | None = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    company: str
    color: str = "#4ade80"
    beta_code: str = ""
    terms_accepted: bool = False
    plan: str = ""  # selected plan during onboarding — required if no promotional beta code
    role: str = "TENANT_MEMBER"


class InviteUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "TENANT_MEMBER"
    color: str = "#4ade80"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: int
    tenant_id: int
    email: str
    name: str | None
    role: str
    color: str | None
    active: bool
    last_login: datetime | None
    created_at: datetime | None
    terms_accepted_at: datetime | None
    totp_enabled: bool = False

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    token: str
    company: str | None
    color: str | None
    role: str
    email: str
    plan: str
    tenant_id: int
    allowed_modules: Set[str] = set()
    twofa_enabled: bool = False


class InviteValidateResponse(BaseModel):
    valid: bool
    code: str
    tier: str
    label: str
    roles: List[str]
    max_sites: int = 1
    modules: List[str] = []


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
    energy_mode: Optional[str] = Field(
        None,
        description="Energy semantic. 'interval_delta' (default) = energy_kwh is the energy in the interval. "
                    "'cumulative_total' is NOT yet supported and is rejected — the gateway must convert a "
                    "cumulative meter to interval delta before sending.",
    )


class DeviceReadingCreate(DeviceReadingBase):
    """Schema for creating a single device reading."""
    device_id: int = Field(..., gt=0, description="Device ID")
    timestamp: Optional[datetime] = Field(None, description="Reading timestamp (defaults to now)")


class DeviceReadingBatchItem(DeviceReadingBase):
    """Schema for a single item in batch ingest.

    The target device can be resolved by internal `device_id` (numeric) OR by the
    physical `external_id` (tenant-scoped). When both are present, `device_id`
    wins. `external_id` is resolved strictly within the authenticated tenant.
    """
    device_id: Optional[int] = Field(None, gt=0, description="Internal device ID (or use external_id)")
    external_id: Optional[str] = Field(None, description="Physical external identifier (serial) scoped to tenant")
    timestamp: Optional[datetime] = Field(None, description="Reading timestamp (defaults to now)")


class DeviceReadingBatchRequest(BaseModel):
    """Schema for batch ingest request."""
    readings: List[DeviceReadingBatchItem] = Field(
        ...,
        min_length=1,
        max_length=10000,  # Limit batch size
        description="List of readings to ingest (max 10000)"
    )

    @field_validator("readings")
    @classmethod
    def validate_readings_not_empty(cls, v):
        if not v:
            raise ValueError("At least one reading is required")
        return v


class DeviceReadingBatchResponse(BaseModel):
    """Schema for batch ingest response."""
    accepted: int = Field(..., description="Number of readings accepted")
    duplicated: int = Field(0, description="Number of duplicate readings (same device_id + timestamp)")
    rejected: int = Field(..., description="Number of readings rejected")
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Validation errors")
    timestamp: datetime = Field(default_factory=utcnow_naive)


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
    
    @field_validator("quantity_kw")
    @classmethod
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        if v > 100000:  # 100 MW max
            raise ValueError("Quantity exceeds maximum allowed (100 MW)")
        return v

    @field_validator("price_eur_mwh")
    @classmethod
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
    
    model_config = ConfigDict(from_attributes=True)


# ─── Trading Schemas ─────────────────────────────────────────────────────────

class PricePoint(BaseModel):
    """Schema for price point in arbitrage signals."""
    h: str = Field(..., description="Hour identifier")
    price: float = Field(..., ge=0, description="Price in EUR/MWh")
    forecast: Optional[float] = Field(None, ge=0, description="Forecasted price")


class SignalsRequest(BaseModel):
    """Schema for arbitrage signals request."""
    prices: List[PricePoint] = Field(..., min_length=1, description="List of price points")
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