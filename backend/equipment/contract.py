"""Normalized telemetry contract shared by all equipment adapters.

This is the single internal contract between a manufacturer adapter and the
Voltaris ingestion pipeline. It reuses the existing reading field definitions
(backend.schemas.DeviceReadingBase) so no model is duplicated.
"""
from datetime import datetime
from typing import Optional

from pydantic import ConfigDict, Field, field_validator

from backend.schemas import DeviceReadingBase


class NormalizationError(Exception):
    """Raised when a vendor payload cannot be converted to normalized readings.

    Deliberately distinct from ingest-time errors (device not found, duplicate,
    tenant mismatch, etc.) so an adapter failure can be isolated from the
    ingestion pipeline outcome.
    """


class NormalizedReading(DeviceReadingBase):
    """A single normalized telemetry reading after adapter conversion.

    - `external_id` is the physical identifier (resolved to a tenant's device).
    - `device_id` may be used instead when the internal id is already known.
    - `timestamp` is normalized to UTC by the ingest pipeline (aware inputs are
      converted; naive values are treated as UTC).
    - `raw` is optional and sanitized (credentials/tokens are never stored).
    - Unknown fields are rejected so incompatible payloads fail explicitly.
    """
    device_id: Optional[int] = Field(None, gt=0, description="Internal device ID")
    external_id: Optional[str] = Field(None, description="Physical external identifier (serial)")
    timestamp: Optional[datetime] = Field(None, description="Reading timestamp (normalized to UTC)")

    @field_validator("energy_mode")
    @classmethod
    def validate_energy_mode(cls, v):
        if v is None or v == "":
            return v
        if v == "cumulative_total":
            raise ValueError("energy_mode='cumulative_total' is not supported; convert to interval_delta")
        if v != "interval_delta":
            raise ValueError(f"unsupported energy_mode: {v!r}")
        return v

    model_config = ConfigDict(extra="forbid")
