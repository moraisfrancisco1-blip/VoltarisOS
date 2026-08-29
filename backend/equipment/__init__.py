"""Voltaris equipment adapter foundation.

This package defines the boundary between physical equipment and the Voltaris
ingestion pipeline:

    EQUIPMENT -> MANUFACTURER ADAPTER -> NormalizedReading -> INGEST API

No manufacturer API is implemented here — only the reusable contract, the base
interface, a clearly-named reference/test adapter, and the gateway service that
converges on the existing ingest pipeline.
"""
from .contract import NormalizedReading, NormalizationError
from .base import EquipmentAdapter
from .generic import GenericEquipmentAdapter
from .service import ingest_adapter_payload

__all__ = [
    "NormalizedReading",
    "NormalizationError",
    "EquipmentAdapter",
    "GenericEquipmentAdapter",
    "ingest_adapter_payload",
]
