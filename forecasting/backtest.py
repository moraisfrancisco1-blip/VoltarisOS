"""Rolling-origin evaluation helpers for probabilistic load forecasts."""
from __future__ import annotations

from forecasting.probabilistic_load import forecast_load_quantiles


def backtest_load_quantiles(history_kw, horizon=24, min_history=24 * 14, step=24):
    values = [float(v) for v in history_kw]
    if len(values) <= min_history + horizon:
        raise ValueError("insufficient history for backtest")
    observations = []
    for origin in range(min_history, len(values) - horizon + 1, step):
        forecast = forecast_load_quantiles(values[:origin], horizon=horizon)
        actual = values[origin:origin + horizon]
        for p10, p50, p90, y in zip(forecast["p10"], forecast["p50"], forecast["p90"], actual):
            observations.append({"p10": p10, "p50": p50, "p90": p90, "actual": y})
    if not observations:
        raise ValueError("backtest produced no observations")
    coverage = sum(row["p10"] <= row["actual"] <= row["p90"] for row in observations) / len(observations)
    mae = sum(abs(row["p50"] - row["actual"]) for row in observations) / len(observations)
    return {"observations": len(observations), "coverage_p10_p90": coverage, "mae_p50": mae}
