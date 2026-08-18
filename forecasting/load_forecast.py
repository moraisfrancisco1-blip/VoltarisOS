"""Telemetry-driven load forecasting for the VPP optimization layer."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Iterable


def forecast_load_from_readings(
    readings: Iterable[object],
    start: datetime,
    hours: int = 24,
    history_days: int = 28,
    fallback_kw: float | None = None,
) -> list[float]:
    """Forecast hourly load from historical telemetry using robust medians."""
    if hours <= 0:
        raise ValueError("hours must be positive")
    if history_days <= 0:
        raise ValueError("history_days must be positive")

    cutoff = start - timedelta(days=history_days)
    buckets: dict[tuple[int, int], list[float]] = defaultdict(list)
    all_values: list[float] = []

    for reading in readings:
        timestamp = getattr(reading, "timestamp", None)
        power_kw = getattr(reading, "power_kw", None)
        if timestamp is None or power_kw is None or timestamp < cutoff or timestamp >= start:
            continue
        try:
            value = max(0.0, float(power_kw))
        except (TypeError, ValueError):
            continue
        buckets[(timestamp.weekday(), timestamp.hour)].append(value)
        all_values.append(value)

    global_median = median(all_values) if all_values else None
    if global_median is None:
        if fallback_kw is None:
            raise ValueError("No usable historical load telemetry and no fallback_kw provided")
        global_median = max(0.0, float(fallback_kw))

    result: list[float] = []
    for offset in range(hours):
        target = start + timedelta(hours=offset)
        values = buckets.get((target.weekday(), target.hour), [])
        value = median(values) if values else global_median
        result.append(round(float(value), 3))
    return result


def forecast_site_loads_from_readings(
    readings_by_site: dict[int, Iterable[object]],
    start: datetime,
    hours: int = 24,
    history_days: int = 28,
) -> list[float]:
    """Aggregate independent site forecasts into a VPP load forecast."""
    forecasts = [
        forecast_load_from_readings(readings, start, hours=hours, history_days=history_days)
        for readings in readings_by_site.values()
    ]
    if not forecasts:
        return [0.0] * hours
    return [round(sum(series[t] for series in forecasts), 3) for t in range(hours)]
