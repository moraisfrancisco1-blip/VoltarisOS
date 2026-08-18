"""Validated forecast container shared by forecasting and optimization layers."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Sequence


@dataclass(frozen=True)
class ForecastBundle:
    """Aligned hourly forecasts consumed by the rolling-horizon layer."""

    timestamps: tuple[datetime, ...]
    prices_eur_mwh: tuple[float, ...]
    load_kw: tuple[float, ...]
    solar_kw: tuple[float, ...]

    def __post_init__(self) -> None:
        size = len(self.timestamps)
        if size == 0:
            raise ValueError("ForecastBundle requires at least one hourly point")
        lengths = {
            "prices_eur_mwh": len(self.prices_eur_mwh),
            "load_kw": len(self.load_kw),
            "solar_kw": len(self.solar_kw),
        }
        invalid = {name: length for name, length in lengths.items() if length != size}
        if invalid:
            raise ValueError(f"Forecast series must have {size} points: {invalid}")
        if any(self.timestamps[i] >= self.timestamps[i + 1] for i in range(size - 1)):
            raise ValueError("Forecast timestamps must be strictly increasing")
        if any(value < 0 for value in self.load_kw):
            raise ValueError("Forecast load cannot be negative")
        if any(value < 0 for value in self.solar_kw):
            raise ValueError("Forecast solar production cannot be negative")

    @property
    def hours(self) -> int:
        return len(self.timestamps)

    def slice(self, start: int, hours: int) -> "ForecastBundle":
        if start < 0 or hours <= 0 or start + hours > self.hours:
            raise ValueError("Forecast slice is outside the available horizon")
        end = start + hours
        return ForecastBundle(
            timestamps=self.timestamps[start:end],
            prices_eur_mwh=self.prices_eur_mwh[start:end],
            load_kw=self.load_kw[start:end],
            solar_kw=self.solar_kw[start:end],
        )


def build_forecast_bundle(
    timestamps: Sequence[datetime],
    prices_eur_mwh: Sequence[float],
    load_kw: Sequence[float],
    solar_kw: Sequence[float],
) -> ForecastBundle:
    """Combine independently produced forecasts without coupling their providers."""
    return ForecastBundle(
        timestamps=tuple(timestamps),
        prices_eur_mwh=tuple(float(value) for value in prices_eur_mwh),
        load_kw=tuple(float(value) for value in load_kw),
        solar_kw=tuple(float(value) for value in solar_kw),
    )
