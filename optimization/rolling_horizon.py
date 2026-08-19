"""Rolling-horizon orchestration around the portfolio optimizer."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List
from datetime import datetime

from forecasting.contracts import ForecastBundle
from forecasting.health import require_healthy_bundle
from optimization.assets import VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizationResult, MultiAssetOptimizer


@dataclass
class RollingHorizonResult:
    intervals: List[dict]
    solves: int
    status: str


PortfolioFactory = Callable[[ForecastBundle], VPPPortfolio]


class RollingHorizonOptimizer:
    def __init__(self, optimizer: MultiAssetOptimizer | None = None):
        self.optimizer = optimizer or MultiAssetOptimizer()

    def optimize(
        self,
        forecast: ForecastBundle,
        portfolio_factory: PortfolioFactory,
        *,
        horizon_hours: int = 24,
        step_hours: int = 1,
        now: datetime | None = None,
    ) -> RollingHorizonResult:
        if horizon_hours <= 0 or step_hours <= 0:
            raise ValueError("horizon_hours and step_hours must be positive")

        require_healthy_bundle(forecast, now=now)
        forecast.validate(horizon_hours, now=now)

        intervals: List[dict] = []
        solves = 0
        for start in range(0, len(forecast.prices_eur_mwh) - horizon_hours + 1, step_hours):
            window = forecast.window(start, horizon_hours)
            portfolio = portfolio_factory(window)
            result: MultiAssetOptimizationResult = self.optimizer.optimize(portfolio)
            solves += 1
            if result.status != "optimal":
                return RollingHorizonResult(intervals=intervals, solves=solves, status=result.status)
            intervals.append({
                "forecast_index": start,
                "timestamp": window.timestamps[0] if window.timestamps else None,
                "dispatch_kw": result.vpp_dispatch[0] if result.vpp_dispatch else 0.0,
                "schedule": result.schedule[0] if result.schedule else {},
                "asset_dispatch": {asset_id: values[0] if values else 0.0 for asset_id, values in result.asset_dispatch.items()},
                "solver_time_ms": result.solver_time_ms,
            })
        return RollingHorizonResult(intervals=intervals, solves=solves, status="optimal")
