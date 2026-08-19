"""Persistence adapter for canonical forecast snapshots."""
from __future__ import annotations

from datetime import datetime, timezone

from forecasting.contracts import ForecastBundle, ProviderMetadata


def record_from_bundle(models, tenant_id: int, bundle: ForecastBundle, *, now: datetime | None = None):
    generated = bundle.generated_at or (now or datetime.now(timezone.utc)).isoformat()
    generated_dt = datetime.fromisoformat(generated.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
    providers = [
        {"name": provider.name, "generated_at": provider.generated_at, "max_age_minutes": provider.max_age_minutes}
        for provider in bundle.providers
    ]
    return models.ForecastRecord(
        tenant_id=tenant_id,
        horizon_hours=len(bundle.prices_eur_mwh),
        timestamps=bundle.timestamps,
        prices_eur_mwh=bundle.prices_eur_mwh,
        load_kw=bundle.load_kw,
        solar_kw=bundle.solar_kw,
        providers=providers,
        generated_at=generated_dt,
        status="valid",
    )


def bundle_from_record(record) -> ForecastBundle:
    providers = tuple(
        ProviderMetadata(
            name=item["name"],
            generated_at=item["generated_at"],
            max_age_minutes=int(item["max_age_minutes"]),
        )
        for item in (record.providers or [])
    )
    return ForecastBundle(
        prices_eur_mwh=list(record.prices_eur_mwh),
        load_kw=list(record.load_kw),
        solar_kw=list(record.solar_kw),
        timestamps=list(record.timestamps),
        providers=providers,
    )


def latest_forecast(db, models, tenant_id: int):
    return (
        db.query(models.ForecastRecord)
        .filter(models.ForecastRecord.tenant_id == tenant_id, models.ForecastRecord.status == "valid")
        .order_by(models.ForecastRecord.generated_at.desc())
        .first()
    )
