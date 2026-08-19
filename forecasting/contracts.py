"""Stable forecast contracts consumed by optimization orchestration."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List


@dataclass(frozen=True)
class ProviderMetadata:
    """Freshness and provenance for one forecast provider."""

    name: str
    generated_at: str
    max_age_minutes: int

    def age_minutes(self, *, now: datetime | None = None) -> float:
        generated = ForecastBundle._parse_timestamp(self.generated_at)
        current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        return (current - generated).total_seconds() / 60

    def validate(self, *, now: datetime | None = None) -> None:
        if self.max_age_minutes < 0:
            raise ValueError("max_age_minutes must be non-negative")
        age = self.age_minutes(now=now)
        if age < 0:
            raise ValueError(f"{self.name} generated_at is in the future")
        if age > self.max_age_minutes:
            raise ValueError(f"{self.name} forecast is stale")


@dataclass(frozen=True)
class ForecastBundle:
    """Time-aligned forecast inputs for one optimization horizon."""

    prices_eur_mwh: List[float]
    load_kw: List[float]
    solar_kw: List[float]
    timestamps: List[str] = field(default_factory=list)
    source: str = "unknown"
    generated_at: str | None = None
    max_age_minutes: int | None = None
    providers: tuple[ProviderMetadata, ...] = ()

    def validate(self, horizon_hours: int, *, now: datetime | None = None) -> None:
        if horizon_hours <= 0:
            raise ValueError("horizon_hours must be positive")
        for name, values in (
            ("prices_eur_mwh", self.prices_eur_mwh),
            ("load_kw", self.load_kw),
            ("solar_kw", self.solar_kw),
        ):
            if len(values) < horizon_hours:
                raise ValueError(f"{name} requires at least {horizon_hours} values")
        if self.timestamps:
            if len(self.timestamps) < horizon_hours:
                raise ValueError(f"timestamps requires at least {horizon_hours} values")
            parsed = [self._parse_timestamp(value) for value in self.timestamps[:horizon_hours]]
            if any(b <= a for a, b in zip(parsed, parsed[1:])):
                raise ValueError("timestamps must be strictly increasing")
            if any((b - a).total_seconds() != 3600 for a, b in zip(parsed, parsed[1:])):
                raise ValueError("timestamps must use an hourly cadence")
        if self.generated_at is not None and self.max_age_minutes is not None:
            if self.max_age_minutes < 0:
                raise ValueError("max_age_minutes must be non-negative")
            generated = self._parse_timestamp(self.generated_at)
            current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
            age_seconds = (current - generated).total_seconds()
            if age_seconds < 0:
                raise ValueError("generated_at cannot be in the future")
            if age_seconds > self.max_age_minutes * 60:
                raise ValueError("forecast bundle is stale")
        for provider in self.providers:
            provider.validate(now=now)

    def window(self, start: int, horizon_hours: int) -> "ForecastBundle":
        self.validate(start + horizon_hours)
        end = start + horizon_hours
        return ForecastBundle(
            prices_eur_mwh=self.prices_eur_mwh[start:end],
            load_kw=self.load_kw[start:end],
            solar_kw=self.solar_kw[start:end],
            timestamps=self.timestamps[start:end] if self.timestamps else [],
            source=self.source,
            generated_at=self.generated_at,
            max_age_minutes=self.max_age_minutes,
            providers=self.providers,
        )

    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return parsed.astimezone(timezone.utc)
