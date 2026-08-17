"""Portfolio-level MILP optimizer for VoltarisOS.

This is the next layer above the existing battery optimizer. It keeps the
legacy battery optimizer intact while introducing a common model for solar,
batteries, EVs and flexible loads.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List
import time

from optimization.assets import (
    BatteryAsset,
    EVAsset,
    FlexibleLoadAsset,
    SolarAsset,
    VPPPortfolio,
)


@dataclass
class MultiAssetOptimizationResult:
    status: str
    schedule: List[Dict[str, Any]]
    total_cost_eur: float
    total_import_kwh: float
    total_export_kwh: float
    asset_dispatch: Dict[str, List[float]] = field(default_factory=dict)
    solver_time_ms: float = 0.0


class MultiAssetOptimizer:
    """Optimize a heterogeneous VPP portfolio over a common time horizon."""

    def __init__(self, solver: str = "CBC"):
        self.solver = solver

    def optimize(self, portfolio: VPPPortfolio) -> MultiAssetOptimizationResult:
        started = time.time()
        n = portfolio.horizon()
        if n <= 0:
            return MultiAssetOptimizationResult("error", [], 0.0, 0.0, 0.0)

        prices = self._series(portfolio.prices_eur_mwh, n, 0.0)
        base_load = self._series(portfolio.base_load_kw, n, 0.0)
        solar_assets = [a for a in portfolio.assets if isinstance(a, SolarAsset) and a.enabled]
        batteries = [a for a in portfolio.assets if isinstance(a, BatteryAsset) and a.enabled]
        evs = [a for a in portfolio.assets if isinstance(a, EVAsset) and a.enabled]
        flex_loads = [a for a in portfolio.assets if isinstance(a, FlexibleLoadAsset) and a.enabled]

        try:
            from pulp import (
                LpMinimize,
                LpProblem,
                LpStatus,
                LpVariable,
                PULP_CBC_CMD,
                lpSum,
                value,
            )
        except ImportError as exc:
            return MultiAssetOptimizationResult(
                "error", [], 0.0, 0.0, 0.0,
                solver_time_ms=(time.time() - started) * 1000,
            )

        prob = LpProblem("VoltarisOS_MultiAsset_VPP", LpMinimize)

        grid_import = [LpVariable(f"grid_import_{t}", 0, portfolio.max_import_kw) for t in range(n)]
        grid_export = [LpVariable(f"grid_export_{t}", 0, portfolio.max_export_kw) for t in range(n)]
        export_mode = [LpVariable(f"export_mode_{t}", cat="Binary") for t in range(n)]

        battery_vars: Dict[str, Dict[str, List[Any]]] = {}
        for asset in batteries:
            charge = [LpVariable(f"{asset.asset_id}_charge_{t}", 0, asset.max_charge_kw) for t in range(n)]
            discharge = [LpVariable(f"{asset.asset_id}_discharge_{t}", 0, asset.max_discharge_kw) for t in range(n)]
            soc = [LpVariable(f"{asset.asset_id}_soc_{t}", asset.min_soc * asset.capacity_kwh,
                              asset.max_soc * asset.capacity_kwh) for t in range(n)]
            mode = [LpVariable(f"{asset.asset_id}_charge_mode_{t}", cat="Binary") for t in range(n)]
            battery_vars[asset.asset_id] = {"charge": charge, "discharge": discharge, "soc": soc, "mode": mode}

        ev_vars: Dict[str, Dict[str, List[Any]]] = {}
        for asset in evs:
            charge = [LpVariable(f"{asset.asset_id}_charge_{t}", 0, asset.max_charge_kw) for t in range(n)]
            soc = [LpVariable(f"{asset.asset_id}_soc_{t}", asset.min_soc * asset.capacity_kwh,
                              asset.max_soc * asset.capacity_kwh) for t in range(n)]
            ev_vars[asset.asset_id] = {"charge": charge, "soc": soc}

        flex_vars: Dict[str, List[Any]] = {}
        for asset in flex_loads:
            values = []
            for t in range(n):
                active = asset.start_hour <= t < min(asset.end_hour, n)
                upper = asset.max_power_kw if active else 0.0
                lower = asset.min_power_kw if active else 0.0
                values.append(LpVariable(f"{asset.asset_id}_load_{t}", lower, upper))
            flex_vars[asset.asset_id] = values

        objective = []
        for t in range(n):
            price = prices[t] / 1000.0
            objective.append(grid_import[t] * price - grid_export[t] * price)

        for asset in batteries:
            vars_ = battery_vars[asset.asset_id]
            for t in range(n):
                objective.append((vars_["charge"][t] + vars_["discharge"][t]) * asset.degradation_cost_eur_kwh)

        for asset in flex_loads:
            vars_ = flex_vars[asset.asset_id]
            for t in range(n):
                if asset.curtailment_cost_eur_kwh:
                    objective.append((asset.max_power_kw - vars_[t]) * asset.curtailment_cost_eur_kwh)

        prob += lpSum(objective)

        for t in range(n):
            prob += grid_import[t] <= portfolio.max_import_kw * (1 - export_mode[t])
            prob += grid_export[t] <= portfolio.max_export_kw * export_mode[t]

            generation = lpSum(
                self._series(asset.forecast_kw, n, 0.0)[t] for asset in solar_assets
            )
            battery_net = 0
            for asset in batteries:
                vars_ = battery_vars[asset.asset_id]
                battery_net += vars_["charge"][t] - vars_["discharge"][t]
            ev_charge = lpSum(ev_vars[a.asset_id]["charge"][t] for a in evs)
            flex_load = lpSum(flex_vars[a.asset_id][t] for a in flex_loads)

            prob += grid_import[t] - grid_export[t] == base_load[t] + flex_load + ev_charge + battery_net - generation

        for asset in batteries:
            vars_ = battery_vars[asset.asset_id]
            for t in range(n):
                previous = asset.initial_soc * asset.capacity_kwh if t == 0 else vars_["soc"][t - 1]
                prob += vars_["soc"][t] == previous + (
                    vars_["charge"][t] * asset.charge_efficiency
                    - vars_["discharge"][t] / asset.discharge_efficiency
                )
                prob += vars_["charge"][t] <= asset.max_charge_kw * vars_["mode"][t]
                prob += vars_["discharge"][t] <= asset.max_discharge_kw * (1 - vars_["mode"][t])

        for asset in evs:
            vars_ = ev_vars[asset.asset_id]
            for t in range(n):
                if t < asset.arrival_hour or t >= asset.departure_hour:
                    prob += vars_["charge"][t] == 0
                previous = asset.initial_soc * asset.capacity_kwh if t == 0 else vars_["soc"][t - 1]
                prob += vars_["soc"][t] == previous + vars_["charge"][t] * asset.charge_efficiency
            departure_index = min(max(asset.departure_hour - 1, 0), n - 1)
            prob += vars_["soc"][departure_index] >= asset.target_soc * asset.capacity_kwh

        for asset in flex_loads:
            if asset.energy_required_kwh > 0:
                prob += lpSum(flex_vars[asset.asset_id]) >= asset.energy_required_kwh

        solver = PULP_CBC_CMD(msg=False)
        prob.solve(solver)
        status = LpStatus.get(prob.status, "unknown").lower()
        if status != "optimal":
            return MultiAssetOptimizationResult(
                status, [], 0.0, 0.0, 0.0,
                solver_time_ms=(time.time() - started) * 1000,
            )

        schedule: List[Dict[str, Any]] = []
        for t in range(n):
            item: Dict[str, Any] = {
                "hour": t,
                "price_eur_mwh": prices[t],
                "grid_import_kw": round(value(grid_import[t]) or 0.0, 3),
                "grid_export_kw": round(value(grid_export[t]) or 0.0, 3),
                "solar_kw": round(sum(self._series(a.forecast_kw, n, 0.0)[t] for a in solar_assets), 3),
            }
            for asset in batteries:
                vars_ = battery_vars[asset.asset_id]
                item[f"battery_{asset.asset_id}"] = {
                    "charge_kw": round(value(vars_["charge"][t]) or 0.0, 3),
                    "discharge_kw": round(value(vars_["discharge"][t]) or 0.0, 3),
                    "soc_pct": round((value(vars_["soc"][t]) or 0.0) / asset.capacity_kwh * 100, 2),
                }
            for asset in evs:
                vars_ = ev_vars[asset.asset_id]
                item[f"ev_{asset.asset_id}"] = {
                    "charge_kw": round(value(vars_["charge"][t]) or 0.0, 3),
                    "soc_pct": round((value(vars_["soc"][t]) or 0.0) / asset.capacity_kwh * 100, 2),
                }
            for asset in flex_loads:
                item[f"load_{asset.asset_id}_kw"] = round(value(flex_vars[asset.asset_id][t]) or 0.0, 3)
            schedule.append(item)

        dispatch: Dict[str, List[float]] = {}
        for asset in batteries:
            dispatch[asset.asset_id] = [round((value(battery_vars[asset.asset_id]["discharge"][t]) or 0.0)
                                               - (value(battery_vars[asset.asset_id]["charge"][t]) or 0.0), 3)
                                        for t in range(n)]
        for asset in evs:
            dispatch[asset.asset_id] = [round(-(value(ev_vars[asset.asset_id]["charge"][t]) or 0.0), 3) for t in range(n)]
        for asset in flex_loads:
            dispatch[asset.asset_id] = [round(value(flex_vars[asset.asset_id][t]) or 0.0, 3) for t in range(n)]

        total_import = sum(row["grid_import_kw"] for row in schedule)
        total_export = sum(row["grid_export_kw"] for row in schedule)
        total_cost = float(value(prob.objective) or 0.0)
        return MultiAssetOptimizationResult(
            status="optimal",
            schedule=schedule,
            total_cost_eur=round(total_cost, 4),
            total_import_kwh=round(total_import, 3),
            total_export_kwh=round(total_export, 3),
            asset_dispatch=dispatch,
            solver_time_ms=round((time.time() - started) * 1000, 1),
        )

    @staticmethod
    def _series(values: List[float], n: int, default: float) -> List[float]:
        values = values or []
        return [float(values[i]) if i < len(values) else default for i in range(n)]
