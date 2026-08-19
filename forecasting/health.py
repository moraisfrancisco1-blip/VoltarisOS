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


def assess_bundle_health(bundle: ForecastBundle, *, now: datetime | None = None) -> list[ProviderHealth]:
    """Return individual fail-closed health assessments for every provider."""
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    if bundle.providers:
        results = []
        for provider in bundle.providers:
            try:
                age = provider.age_minutes(now=current)
                provider.validate(now=current)
                results.append(ProviderHealth(provider.name, True, "fresh", age))
            except (TypeError, ValueError) as exc:
                age = None
                try:
                    age = provider.age_minutes(now=current)
                except (TypeError, ValueError):
                    pass
                results.append(ProviderHealth(provider.name, False, str(exc), age))
        return results

    if not bundle.generated_at:
        return [ProviderHealth(bundle.source, False, "missing generated_at")]
    try:
        age_minutes = (current - bundle._parse_timestamp(bundle.generated_at)).total_seconds() / 60
        if age_minutes < 0:
            return [ProviderHealth(bundle.source, False, "generated_at is in the future", age_minutes)]
        if bundle.max_age_minutes is None:
            return [ProviderHealth(bundle.source, False, "missing max_age_minutes", age_minutes)]
        if age_minutes > bundle.max_age_minutes:
            return [ProviderHealth(bundle.source, False, "forecast is stale", age_minutes)]
        return [ProviderHealth(bundle.source, True, "fresh", age_minutes)]
    except (TypeError, ValueError) as exc:
        return [ProviderHealth(bundle.source, False, str(exc))]


def require_healthy_bundle(bundle: ForecastBundle, *, now: datetime | None = None) -> None:
    """Fail closed before optimization when any forecast provider is unhealthy."""
    health = assess_bundle_health(bundle, now=now)
    unhealthy = [item for item in health if not item.healthy]
    if unhealthy:
        reasons = "; ".join(f"{item.name}: {item.reason}" for item in unhealthy)
        raise ValueError(f"forecast provider unhealthy: {reasons}")
