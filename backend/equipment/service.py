"""Gateway flow: raw vendor payload -> adapter -> normalized -> existing ingest.

The normalized readings converge on the exact same pipeline as the HTTP ingest
endpoint (validation, tenant isolation, idempotency, persistence, alerts,
last_seen, carbon, maintenance) — nothing is duplicated.
"""
from sqlalchemy.orm import Session

from backend.schemas import DeviceReadingBatchItem, DeviceReadingBatchRequest
from backend.routers.devices import _ingest_readings_batch

from .base import EquipmentAdapter
from .contract import NormalizedReading, NormalizationError


def ingest_adapter_payload(adapter: EquipmentAdapter, raw_payload, identity: dict, db: Session) -> dict:
    """Run a raw vendor payload through an adapter and converge on the existing
    ingest pipeline.

    Returns the same shape as DeviceReadingBatchResponse
    ({accepted, duplicated, rejected, errors, timestamp}).
    """
    readings = adapter.normalize(raw_payload)

    batch_items = []
    for nr in readings:
        if not isinstance(nr, NormalizedReading):
            raise NormalizationError("adapter returned a non-NormalizedReading value")
        if nr.external_id is None and nr.device_id is None:
            raise NormalizationError("normalized reading must carry external_id or device_id")
        batch_items.append(DeviceReadingBatchItem(**nr.model_dump()))

    if not batch_items:
        raise NormalizationError("adapter produced no readings")

    batch = DeviceReadingBatchRequest(readings=batch_items)
    # Converge on the shared pipeline (no duplicated validation/dedup/alerts).
    return _ingest_readings_batch(db, batch, identity)
