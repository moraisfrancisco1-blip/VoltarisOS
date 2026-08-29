"""Reference/test equipment adapter (NOT a manufacturer).

This adapter is used only for tests, development and validating the internal
contract. It does NOT emulate any real manufacturer (no Sungrow, Huawei,
SolarEdge, Fronius, SMA, Modbus, MQTT...). It maps a simple, self-describing
payload shape into NormalizedReading and sanitizes raw payload secrets.
"""
from typing import List

from pydantic import ValidationError

from .base import EquipmentAdapter
from .contract import NormalizedReading, NormalizationError

# Keys never persisted even inside the optional `raw` payload.
_SENSITIVE_RAW_KEYS = {
    "token", "access_token", "refresh_token", "api_key", "apikey", "password",
    "secret", "authorization", "bearer", "credentials", "auth", "client_secret",
}


def _sanitize_raw(raw):
    """Mask known credential keys inside the raw payload (nested or flat)."""
    if not isinstance(raw, dict):
        return raw
    safe = {}
    for k, v in raw.items():
        if str(k).lower() in _SENSITIVE_RAW_KEYS:
            safe[k] = "***REDACTED***"
        elif isinstance(v, dict):
            safe[k] = _sanitize_raw(v)
        else:
            safe[k] = v
    return safe


class GenericEquipmentAdapter(EquipmentAdapter):
    """Reference adapter for tests/development. Not a real manufacturer."""

    name = "generic"

    def normalize(self, raw_payload) -> List[NormalizedReading]:
        if isinstance(raw_payload, dict):
            items = [raw_payload]
        elif isinstance(raw_payload, list):
            items = raw_payload
        else:
            raise NormalizationError("payload must be a dict or a list of dicts")

        readings = []
        for item in items:
            readings.append(self._normalize_one(item))
        return readings

    def _normalize_one(self, item) -> NormalizedReading:
        if not isinstance(item, dict):
            raise NormalizationError("each reading must be an object")
        if not item.get("external_id") and not item.get("device_id"):
            raise NormalizationError("external_id (or device_id) is required")

        data = dict(item)
        if "raw" in data and data["raw"] is not None:
            data["raw"] = _sanitize_raw(data["raw"])

        try:
            return NormalizedReading(**data)
        except ValidationError as exc:
            raise NormalizationError(f"invalid reading: {exc}") from exc
