"""Distribution-free probabilistic load forecasting from historical telemetry."""
from __future__ import annotations

from statistics import quantiles
from typing import Sequence


def forecast_load_quantiles(history_kw: Sequence[float], horizon: int = 24, window: int = 168) -> dict[str, list[float]]:
    """Return P10/P50/P90 using recent same-hour historical residuals.

    The median remains the deterministic forecast used by the current pipeline;
    quantiles expose uncertainty without changing the existing ForecastBundle contract.
    """
    if horizon <= 0 or window <= 0:
        raise ValueError("horizon and window must be positive")
    values = [float(value) for value in history_kw]
    if len(values) < 24:
        raise ValueError("at least 24 historical load values are required")
    recent = values[-min(len(values), window):]
    baseline = [recent[(len(recent) - 24 + hour) % len(recent)] for hour in range(24)]
    residuals = [recent[i] - baseline[i % 24] for i in range(len(recent))]
    if len(residuals) < 8:
        spread = [0.0] * 24
    else:
        spread = [max(0.0, q) for q in quantiles(residuals, n=10, method="inclusive")]
    p10 = []
    p50 = []
    p90 = []
    for hour in range(horizon):
        median = baseline[hour % 24]
        lower = spread[0] if spread else 0.0
        upper = spread[8] if len(spread) > 8 else 0.0
        p10.append(max(0.0, median - upper))
        p50.append(max(0.0, median))
        p90.append(max(0.0, median + upper))
    return {"p10": p10, "p50": p50, "p90": p90}
