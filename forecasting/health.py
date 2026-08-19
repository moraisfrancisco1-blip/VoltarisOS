"""Forecast provider health and freshness policy."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from forecasting.contracts import ForecastBundle


@dataclass(frozen=True)
class ProviderHealth:
    name: str
    healthy: bool
    reason: str
    age_minutes: float | None = None


def assess_bundle_health(bundle: ForecastBundle, *, now: datetime | None = None) -> ProviderHealth:
    """Return a fail-closed health assessment for a forecast bundle."""
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    try:
        if not bundle.generated_at:
            return ProviderHealth(bundle.source, False, "missing generated_at")
        generated = bundle._parse_timestamp(bundle.generated_at)
        age_minutes = (current - generated).total_seconds() / 60
        if age_minutes < 0:
            return ProviderHealth(bundle.source, False, "generated_at is in the future", age_minutes)
        if bundle.max_age_minutes is None:
            return ProviderHealth(bundle.source, False, "missing max_age_minutes", age_minutes)
        if age_minutes > bundle.max_age_minutes:
            return ProviderHealth(bundle.source, False, "forecast is stale", age_minutes)
        return ProviderHealth(bundle.source, True, "fresh", age_minutes)
    except (TypeError, ValueError) as exc:
        return ProviderHealth(bundle.source, False, str(exc))


def require_healthy_bundle(bundle: ForecastBundle, *, now: datetime | None = None) -> None:
    """Fail closed before optimization when forecast data is not trustworthy."""
    health = assess_bundle_health(bundle, now=now)
    if not health.healthy:
        raise ValueError(f"forecast provider unhealthy: {health.reason}")
