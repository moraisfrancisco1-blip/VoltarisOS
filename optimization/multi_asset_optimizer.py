"""Portfolio-level MILP optimizer for heterogeneous VoltarisOS assets."""
from dataclasses import dataclass, field
from typing import Any, Dict, List
import time

from optimization.assets import (
    BatteryAsset,
    EVAsset,
    FlexibleLoadAsset,
    HeatPumpAsset,
    IndustrialLoadAsset,
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
    site_dispatch: Dict[str, List[float]] = field(default_factory=dict)
    vpp_dispatch: List[float] = field(default_factory=list)
    solver_time_ms: float = 0.0


class MultiAssetOptimizer:
    """Optimize solar, storage, EVs and flexible loads together."""

    def __init__(self, solver: str = "CBC"):
        self.solver = solver

    def optimize(self, portfolio: VPPPortfolio) -> MultiAssetOptimizationResult:
        started = time.time()
        n = portfolio.horizon()
        if n <= 0:
            return MultiAssetOptimizationResult("error", [], 0.0, 0.0, 0.0)

        prices = self._series(portfolio.prices_eur_mwh, n)
        base_load = self._series(portfolio.base_load_kw, n)
        solar_assets = [a for a in portfolio.assets if isinstance(a, SolarAsset) and a.enabled]
        batteries = [a for a in portfolio.assets if isinstance(a, BatteryAsset) and a.enabled]
        evs = [a for a in portfolio.assets if isinstance(a, EVAsset) and a.enabled]
        flex_loads = [a for a in portfolio.assets if isinstance(a, FlexibleLoadAsset) and a.enabled and not isinstance(a, HeatPumpAsset)]
        heat_pumps = [a for a in portfolio.assets if isinstance(a, HeatPumpAsset) and a.enabled]

        try:
            from pulp import LpMinimize, LpProblem, LpStatus, LpVariable, COIN_CMD, lpSum, value
        except ImportError:
            return MultiAssetOptimizationResult("error", [], 0.0, 0.0, 0.0,
                                                solver_time_ms=(time.time() - started) * 1000)

        prob = LpProblem("VoltarisOS_MultiAsset_VPP", LpMinimize)
        grid_import = [LpVariable(f"grid_import_{t}", 0, portfolio.max_import_kw) for t in range(n)]
        grid_export = [LpVariable(f"grid_export_{t}", 0, portfolio.max_export_kw) for t in range(n)]
        grid_export_mode = [LpVariable(f"grid_export_mode_{t}", cat="Binary") for t in range(n)]

        battery_vars: Dict[str, Dict[str, List[Any]]] = {}
        for a in batteries:
            charge = [LpVariable(f"{a.asset_id}_charge_{t}", 0, a.max_charge_kw) for t in range(n)]
            discharge = [LpVariable(f"{a.asset_id}_discharge_{t}", 0, a.max_discharge_kw) for t in range(n)]
            soc = [LpVariable(f"{a.asset_id}_soc_{t}", a.min_soc * a.capacity_kwh, a.max_soc * a.capacity_kwh) for t in range(n)]
            mode = [LpVariable(f"{a.asset_id}_charge_mode_{t}", cat="Binary") for t in range(n)]
            battery_vars[a.asset_id] = {"charge": charge, "discharge": discharge, "soc": soc, "mode": mode}

        ev_vars: Dict[str, Dict[str, List[Any]]] = {}
        for a in evs:
            charge = [LpVariable(f"{a.asset_id}_charge_{t}", 0, a.max_charge_kw) for t in range(n)]
            soc = [LpVariable(f"{a.asset_id}_soc_{t}", a.min_soc * a.capacity_kwh, a.max_soc * a.capacity_kwh) for t in range(n)]
            ev_vars[a.asset_id] = {"charge": charge, "soc": soc}

        flex_vars: Dict[str, List[Any]] = {}
        curtailment_vars: Dict[str, List[Any]] = {}
        for a in flex_loads:
            baseline = a.baseline_kw if isinstance(a, IndustrialLoadAsset) else 0.0
            lower = a.min_power_kw - baseline
            upper = a.max_power_kw - baseline
            flex_vars[a.asset_id] = [LpVariable(
                f"{a.asset_id}_flex_{t}",
                lower if a.start_hour <= t < min(a.end_hour, n) else 0.0,
                upper if a.start_hour <= t < min(a.end_hour, n) else 0.0,
            ) for t in range(n)]
            curtailment_vars[a.asset_id] = [LpVariable(f"{a.asset_id}_curtail_{t}", 0) for t in range(n)]
            for t in range(n):
                prob.addConstraint(curtailment_vars[a.asset_id][t] >= -flex_vars[a.asset_id][t])

        heat_pump_vars: Dict[str, Dict[str, List[Any]]] = {}
        for a in heat_pumps:
            baseline = a.baseline_power_kw
            delta = [LpVariable(
                f"{a.asset_id}_flex_{t}",
                a.min_power_kw - baseline if a.start_hour <= t < min(a.end_hour, n) else 0.0,
                a.nominal_power_kw - baseline if a.start_hour <= t < min(a.end_hour, n) else 0.0,
            ) for t in range(n)]
            thermal = [LpVariable(f"{a.asset_id}_thermal_{t}", a.min_thermal_kwh, a.max_thermal_kwh) for t in range(n)]
            heat_pump_vars[a.asset_id] = {"delta": delta, "thermal": thermal}

        objective = []
        for t in range(n):
            price = prices[t] / 1000.0
            objective.append(grid_import[t] * price - grid_export[t] * price)
        for a in batteries:
            v = battery_vars[a.asset_id]
            for t in range(n):
                objective.append((v["charge"][t] + v["discharge"][t]) * a.degradation_cost_eur_kwh)
        for a in flex_loads:
            if a.curtailment_cost_eur_kwh:
                for t in range(n):
                    objective.append(curtailment_vars[a.asset_id][t] * a.curtailment_cost_eur_kwh)
        for a in heat_pumps:
            if a.operating_cost_eur_kwh:
                for t in range(n):
                    objective.append((a.baseline_power_kw + heat_pump_vars[a.asset_id]["delta"][t]) * a.operating_cost_eur_kwh)
        prob += lpSum(objective)

        for t in range(n):
            prob += grid_import[t] <= portfolio.max_import_kw * (1 - grid_export_mode[t])
            prob += grid_export[t] <= portfolio.max_export_kw * grid_export_mode[t]
            generation = sum(self._series(a.forecast_kw, n)[t] for a in solar_assets)
            battery_net = sum(battery_vars[a.asset_id]["charge"][t] - battery_vars[a.asset_id]["discharge"][t] for a in batteries)
            ev_charge = sum(ev_vars[a.asset_id]["charge"][t] for a in evs)
            flex_load = sum((a.baseline_kw + flex_vars[a.asset_id][t]) if isinstance(a, IndustrialLoadAsset) else flex_vars[a.asset_id][t] for a in flex_loads)
            heat_pump_load = sum(a.baseline_power_kw + heat_pump_vars[a.asset_id]["delta"][t] for a in heat_pumps)
            prob += grid_import[t] - grid_export[t] == base_load[t] + flex_load + ev_charge + heat_pump_load + battery_net - generation

        for a in batteries:
            v = battery_vars[a.asset_id]
            for t in range(n):
                previous = a.initial_soc * a.capacity_kwh if t == 0 else v["soc"][t - 1]
                prob += v["soc"][t] == previous + v["charge"][t] * a.charge_efficiency - v["discharge"][t] / a.discharge_efficiency
                prob += v["charge"][t] <= a.max_charge_kw * v["mode"][t]
                prob += v["discharge"][t] <= a.max_discharge_kw * (1 - v["mode"][t])

        for a in evs:
            v = ev_vars[a.asset_id]
            for t in range(n):
                if t < a.arrival_hour or t >= a.departure_hour:
                    prob += v["charge"][t] == 0
                previous = a.initial_soc * a.capacity_kwh if t == 0 else v["soc"][t - 1]
                prob += v["soc"][t] == previous + v["charge"][t] * a.charge_efficiency
            departure = min(max(a.departure_hour - 1, 0), n - 1)
            prob += v["soc"][departure] >= a.target_soc * a.capacity_kwh

        for a in flex_loads:
            if a.energy_required_kwh > 0:
                actual_load = [(a.baseline_kw + flex_vars[a.asset_id][t]) if isinstance(a, IndustrialLoadAsset) else flex_vars[a.asset_id][t] for t in range(n)]
                prob += sum(actual_load) >= a.energy_required_kwh

        for a in heat_pumps:
            v = heat_pump_vars[a.asset_id]
            for t in range(n):
                actual_power = a.baseline_power_kw + v["delta"][t]
                previous = a.initial_thermal_kwh if t == 0 else v["thermal"][t - 1]
                prob += v["thermal"][t] == previous + actual_power * a.thermal_gain_per_kwh - a.thermal_loss_kwh
            if a.target_thermal_kwh is not None:
                target_hour = min(max(a.end_hour - 1, 0), n - 1)
                prob += v["thermal"][target_hour] >= a.target_thermal_kwh

        prob.solve(COIN_CMD(msg=False))
        status = LpStatus.get(prob.status, "unknown").lower()
        if status != "optimal":
            return MultiAssetOptimizationResult(status, [], 0.0, 0.0, 0.0,
                                                solver_time_ms=(time.time() - started) * 1000)

        schedule: List[Dict[str, Any]] = []
        for t in range(n):
            row = {
                "hour": t,
                "price_eur_mwh": prices[t],
                "grid_import_kw": round(value(grid_import[t]) or 0.0, 3),
                "grid_export_kw": round(value(grid_export[t]) or 0.0, 3),
                "solar_kw": round(sum(self._series(a.forecast_kw, n)[t] for a in solar_assets), 3),
            }
            for a in batteries:
                v = battery_vars[a.asset_id]
                row[f"battery_{a.asset_id}"] = {
                    "charge_kw": round(value(v["charge"][t]) or 0.0, 3),
                    "discharge_kw": round(value(v["discharge"][t]) or 0.0, 3),
                    "soc_pct": round((value(v["soc"][t]) or 0.0) / a.capacity_kwh * 100, 2),
                }
            for a in evs:
                v = ev_vars[a.asset_id]
                row[f"ev_{a.asset_id}"] = {
                    "charge_kw": round(value(v["charge"][t]) or 0.0, 3),
                    "soc_pct": round((value(v["soc"][t]) or 0.0) / a.capacity_kwh * 100, 2),
                }
            for a in flex_loads:
                actual = (a.baseline_kw + value(flex_vars[a.asset_id][t])) if isinstance(a, IndustrialLoadAsset) else value(flex_vars[a.asset_id][t])
                row[f"load_{a.asset_id}_kw"] = round(actual or 0.0, 3)
            for a in heat_pumps:
                v = heat_pump_vars[a.asset_id]
                actual_power = a.baseline_power_kw + (value(v["delta"][t]) or 0.0)
                row[f"heat_pump_{a.asset_id}"] = {
                    "power_kw": round(actual_power, 3),
                    "thermal_kwh": round(value(v["thermal"][t]) or 0.0, 3),
                }
            schedule.append(row)

        dispatch: Dict[str, List[float]] = {}
        for a in batteries:
            v = battery_vars[a.asset_id]
            dispatch[a.asset_id] = [round((value(v["discharge"][t]) or 0.0) - (value(v["charge"][t]) or 0.0), 3) for t in range(n)]
        for a in evs:
            v = ev_vars[a.asset_id]
            dispatch[a.asset_id] = [round(-(value(v["charge"][t]) or 0.0), 3) for t in range(n)]
        for a in flex_loads:
            dispatch[a.asset_id] = [round(value(flex_vars[a.asset_id][t]) or 0.0, 3) for t in range(n)]
        for a in heat_pumps:
            v = heat_pump_vars[a.asset_id]
            dispatch[a.asset_id] = [round(-(value(v["delta"][t]) or 0.0), 3) for t in range(n)]

        site_dispatch: Dict[str, List[float]] = {}
        for asset in batteries + evs + flex_loads + heat_pumps:
            site_key = str(asset.site_id) if asset.site_id is not None else "unassigned"
            values = dispatch.get(asset.asset_id, [0.0] * n)
            site_dispatch.setdefault(site_key, [0.0] * n)
            site_dispatch[site_key] = [round(x + y, 3) for x, y in zip(site_dispatch[site_key], values)]
        vpp_dispatch = [round(sum(values[t] for values in site_dispatch.values()), 3) for t in range(n)]

        return MultiAssetOptimizationResult(
            "optimal", schedule,
            round(float(value(prob.objective) or 0.0), 4),
            round(sum(r["grid_import_kw"] for r in schedule), 3),
            round(sum(r["grid_export_kw"] for r in schedule), 3),
            dispatch,
            site_dispatch,
            vpp_dispatch,
            round((time.time() - started) * 1000, 1),
        )

    @staticmethod
    def _series(values: List[float], n: int) -> List[float]:
        return [float(values[i]) if i < len(values) else 0.0 for i in range(n)]
