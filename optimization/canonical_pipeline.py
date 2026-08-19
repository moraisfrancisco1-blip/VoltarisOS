"""Canonical production optimization pipeline.

All scheduled VPP optimization should enter here so provider health and
rolling-horizon orchestration cannot be bypassed by legacy direct MILP calls.
"""
from __future__ import annotations

from datetime import datetime
from typing import Callable

from forecasting.contracts import ForecastBundle
from optimization.assets import VPPPortfolio
from optimization.rolling_horizon import RollingHorizonOptimizer, RollingHorizonResult


PortfolioFactory = Callable[[ForecastBundle], VPPPortfolio]


def optimize_forecast(
    forecast: ForecastBundle,
    portfolio_factory: PortfolioFactory,
    *,
    horizon_hours: int = 24,
    step_hours: int = 1,
    now: datetime | None = None,
) -> RollingHorizonResult:
    """Run the only supported forecast-driven optimization path."""
    optimizer = RollingHorizonOptimizer()
    return optimizer.optimize(
        forecast,
        portfolio_factory,
        horizon_hours=horizon_hours,
        step_hours=step_hours,
        now=now,
    )
