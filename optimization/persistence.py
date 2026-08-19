"""Persistence boundary for optimization runs and committed dispatch."""
from __future__ import annotations

from datetime import datetime
from sqlalchemy.orm import Session

from backend import models
from optimization.multi_asset_optimizer import MultiAssetOptimizationResult


def persist_optimization_result(
    db: Session,
    *,
    tenant_id: int,
    vpp_id: int,
    horizon_hours: int,
    price_source: str | None,
    result: MultiAssetOptimizationResult,
    forecast_source: str | None = None,
    forecast_generated_at: datetime | None = None,
) -> models.VPPOptimizationRun:
    """Persist one optimization run and its committed first-step dispatch."""
    run = models.VPPOptimizationRun(
        tenant_id=tenant_id,
        vpp_id=vpp_id,
        status=result.status,
        horizon_hours=horizon_hours,
        price_source=price_source,
        forecast_source=forecast_source,
        forecast_generated_at=forecast_generated_at,
        completed_at=datetime.utcnow(),
        solver_time_ms=result.solver_time_ms,
        total_cost_eur=result.total_cost_eur,
        total_import_kwh=result.total_import_kwh,
        total_export_kwh=result.total_export_kwh,
    )
    db.add(run)
    db.flush()

    if result.status == "optimal":
        timestamp = None
        if result.schedule and result.schedule[0].get("timestamp"):
            timestamp = result.schedule[0]["timestamp"]
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).replace(tzinfo=None)
        if timestamp is None:
            timestamp = datetime.utcnow()

        db.add(models.VPPDispatchRecord(
            optimization_run_id=run.id,
            tenant_id=tenant_id,
            vpp_id=vpp_id,
            interval_start=timestamp,
            dispatch_kw=result.vpp_dispatch[0] if result.vpp_dispatch else 0.0,
            asset_dispatch={k: values[0] if values else 0.0 for k, values in result.asset_dispatch.items()},
            site_dispatch={k: values[0] if values else 0.0 for k, values in result.site_dispatch.items()},
            schedule=result.schedule[0] if result.schedule else {},
            solver_status=result.status,
            committed=True,
        ))

    db.commit()
    db.refresh(run)
    return run
