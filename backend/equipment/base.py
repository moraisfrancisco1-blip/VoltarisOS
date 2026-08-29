"""Equipment adapter interface."""
from abc import ABC, abstractmethod
from typing import List

from .contract import NormalizedReading


class EquipmentAdapter(ABC):
    """Base interface for a physical-equipment adapter.

    An adapter converts a vendor-specific payload into one or more
    ``NormalizedReading`` objects. It MUST NOT contain vendor API/client logic,
    network calls or physical control — that belongs to the concrete vendor
    adapter implementation (added later, with real documentation).

    Implementations raise :class:`NormalizationError` when a payload cannot be
    normalized; ambiguous data is never converted silently.
    """
    name: str = "base"

    @abstractmethod
    def normalize(self, raw_payload) -> List[NormalizedReading]:
        """Convert a vendor payload into normalized readings."""
