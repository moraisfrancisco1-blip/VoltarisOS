"""Stable forecast contracts consumed by optimization orchestration."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class ForecastBundle:
    """Time-aligned forecast inputs for one optimization horizon."""

    prices_eur_mwh: List[float]
    load_kw: List[float]
    solar_kw: List[float]
    timestamps: List[str] = field(default_factory=list)
    source: str = "unknown"

    def validate(self, horizon_hours: int) -> None:
        if horizon_hours <= 0:
            raise ValueError("horizon_hours must be positive")
        for name, values in (
            ("prices_eur_mwh", self.prices_eur_mwh),
            ("load_kw", self.load_kw),
            ("solar_kw", self.solar_kw),
        ):
            if len(values) < horizon_hours:
                raise ValueError(f"{name} requires at least {horizon_hours} values")
        if self.timestamps and len(self.timestamps) < horizon_hours:
            raise ValueError(f"timestamps requires at least {horizon_hours} values")

    def window(self, start: int, horizon_hours: int) -> "ForecastBundle":
        self.validate(start + horizon_hours)
        end = start + horizon_hours
        return ForecastBundle(
            prices_eur_mwh=self.prices_eur_mwh[start:end],
            load_kw=self.load_kw[start:end],
            solar_kw=self.solar_kw[start:end],
            timestamps=self.timestamps[start:end] if self.timestamps else [],
            source=self.source,
        )
