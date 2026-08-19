"""Backtest orchestration over persisted DeviceReading telemetry."""
from __future__ import annotations

from forecasting.backtest import backtest_load_quantiles


def load_history_for_tenant(db, models, tenant_id: int, limit: int = 10000) -> list[float]:
    rows = (
        db.query(models.DeviceReading.power_kw)
        .filter(
            models.DeviceReading.tenant_id == tenant_id,
            models.DeviceReading.power_kw.isnot(None),
        )
        .order_by(models.DeviceReading.timestamp.asc())
        .limit(limit)
        .all()
    )
    return [float(row[0]) for row in rows]


def backtest_tenant_load(db, models, tenant_id: int, horizon: int = 24, min_history: int = 24 * 14):
    history = load_history_for_tenant(db, models, tenant_id)
    if len(history) <= min_history + horizon:
        return {
            "tenant_id": tenant_id,
            "status": "insufficient_data",
            "readings_count": len(history),
        }
    metrics = backtest_load_quantiles(history, horizon=horizon, min_history=min_history)
    return {
        "tenant_id": tenant_id,
        "status": "completed",
        "readings_count": len(history),
        **metrics,
    }
