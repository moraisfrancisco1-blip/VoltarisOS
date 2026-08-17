"""Portfolio-level MILP optimizer for heterogeneous VoltarisOS assets."""
from dataclasses import dataclass, field
from typing import Any, Dict, List
import time

from optimization.assets import (
    BatteryAsset, EVAsset, FlexibleLoadAsset, HeatPumpAsset,
    IndustrialLoadAsset, SolarAsset, VPPPortfolio,
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
            return MultiAssetOptimizationResult("error", [], 0.0, 0.0, 0.0, solver_time_ms=(time.time()-started)*1000)

        prob = LpProblem("VoltarisOS_MultiAsset_VPP", LpMinimize)
        grid_import = [LpVariable(f"grid_import_{t}", 0, portfolio.max_import_kw) for t in range(n)]
        grid_export = [LpVariable(f"grid_export_{t}", 0, portfolio.max_export_kw) for t in range(n)]
        export_mode = [LpVariable(f"grid_export_mode_{t}", cat="Binary") for t in range(n)]

        battery_vars = {}
        for a in batteries:
            charge = [LpVariable(f"{a.asset_id}_charge_{t}", 0, a.max_charge_kw) for t in range(n)]
            discharge = [LpVariable(f"{a.asset_id}_discharge_{t}", 0, a.max_discharge_kw) for t in range(n)]
            soc = [LpVariable(f"{a.asset_id}_soc_{t}", a.min_soc*a.capacity_kwh, a.max_soc*a.capacity_kwh) for t in range(n)]
            mode = [LpVariable(f"{a.asset_id}_charge_mode_{t}", cat="Binary") for t in range(n)]
            battery_vars[a.asset_id] = {"charge": charge, "discharge": discharge, "soc": soc, "mode": mode}

        ev_vars = {}
        for a in evs:
            baseline = self._ev_baseline_profile(a, n)
            delta = [LpVariable(f"{a.asset_id}_flex_{t}",
                                -baseline[t] if a.arrival_hour <= t < min(a.departure_hour,n) else 0.0,
                                a.max_charge_kw-baseline[t] if a.arrival_hour <= t < min(a.departure_hour,n) else 0.0)
                     for t in range(n)]
            soc = [LpVariable(f"{a.asset_id}_soc_{t}", a.min_soc*a.capacity_kwh, a.max_soc*a.capacity_kwh) for t in range(n)]
            ev_vars[a.asset_id] = {"delta": delta, "soc": soc, "baseline": baseline}

        flex_vars, curtailment_vars = {}, {}
        for a in flex_loads:
            baseline = a.baseline_kw if isinstance(a, IndustrialLoadAsset) else 0.0
            lo, hi = a.min_power_kw-baseline, a.max_power_kw-baseline
            flex_vars[a.asset_id] = [LpVariable(f"{a.asset_id}_flex_{t}", lo if a.start_hour <= t < min(a.end_hour,n) else 0.0,
                                                hi if a.start_hour <= t < min(a.end_hour,n) else 0.0) for t in range(n)]
            curtailment_vars[a.asset_id] = [LpVariable(f"{a.asset_id}_curtail_{t}", 0) for t in range(n)]
            for t in range(n):
                prob += curtailment_vars[a.asset_id][t] >= -flex_vars[a.asset_id][t]

        hp_vars = {}
        for a in heat_pumps:
            d = [LpVariable(f"{a.asset_id}_flex_{t}", a.min_power_kw-a.baseline_power_kw if a.start_hour <= t < min(a.end_hour,n) else 0.0,
                            a.nominal_power_kw-a.baseline_power_kw if a.start_hour <= t < min(a.end_hour,n) else 0.0) for t in range(n)]
            thermal = [LpVariable(f"{a.asset_id}_thermal_{t}", a.min_thermal_kwh, a.max_thermal_kwh) for t in range(n)]
            hp_vars[a.asset_id] = {"delta": d, "thermal": thermal}

        objective = []
        for t in range(n):
            p = prices[t]/1000.0
            objective.append(grid_import[t]*p-grid_export[t]*p)
        for a in batteries:
            v = battery_vars[a.asset_id]
            objective += [(v["charge"][t]+v["discharge"][t])*a.degradation_cost_eur_kwh for t in range(n)]
        for a in flex_loads:
            objective += [curtailment_vars[a.asset_id][t]*a.curtailment_cost_eur_kwh for t in range(n)]
        for a in heat_pumps:
            objective += [(a.baseline_power_kw+hp_vars[a.asset_id]["delta"][t])*a.operating_cost_eur_kwh for t in range(n)]
        prob += lpSum(objective)

        for t in range(n):
            prob += grid_import[t] <= portfolio.max_import_kw*(1-export_mode[t])
            prob += grid_export[t] <= portfolio.max_export_kw*export_mode[t]
            generation = sum(self._series(a.forecast_kw,n)[t] for a in solar_assets)
            battery_net = sum(battery_vars[a.asset_id]["charge"][t]-battery_vars[a.asset_id]["discharge"][t] for a in batteries)
            ev_load = sum(ev_vars[a.asset_id]["baseline"][t]+ev_vars[a.asset_id]["delta"][t] for a in evs)
            flex_load = sum(
                (a.baseline_kw + flex_vars[a.asset_id][t])
                if isinstance(a, IndustrialLoadAsset) and a.start_hour <= t < min(a.end_hour, n)
                else (flex_vars[a.asset_id][t] if not isinstance(a, IndustrialLoadAsset) else 0.0)
                for a in flex_loads
            )
            hp_load = sum(a.baseline_power_kw+hp_vars[a.asset_id]["delta"][t] for a in heat_pumps)
            prob += grid_import[t]-grid_export[t] == base_load[t]+flex_load+ev_load+hp_load+battery_net-generation

        for a in batteries:
            v=battery_vars[a.asset_id]
            for t in range(n):
                prev=a.initial_soc*a.capacity_kwh if t==0 else v["soc"][t-1]
                prob += v["soc"][t] == prev+v["charge"][t]*a.charge_efficiency-v["discharge"][t]/a.discharge_efficiency
                prob += v["charge"][t] <= a.max_charge_kw*v["mode"][t]
                prob += v["discharge"][t] <= a.max_discharge_kw*(1-v["mode"][t])
            prob += v["soc"][n-1] == a.initial_soc*a.capacity_kwh

        for a in evs:
            v=ev_vars[a.asset_id]
            for t in range(n):
                actual=v["baseline"][t]+v["delta"][t]
                if t<a.arrival_hour or t>=a.departure_hour: prob += actual==0
                prev=a.initial_soc*a.capacity_kwh if t==0 else v["soc"][t-1]
                prob += v["soc"][t] == prev+actual*a.charge_efficiency
            departure=min(max(a.departure_hour-1,0),n-1)
            prob += v["soc"][departure] >= a.target_soc*a.capacity_kwh
            prob += lpSum(v["delta"]) == 0

        for a in flex_loads:
            if a.energy_required_kwh>0:
                actual=[(a.baseline_kw+flex_vars[a.asset_id][t]) if isinstance(a,IndustrialLoadAsset) and a.start_hour <= t < min(a.end_hour,n) else (flex_vars[a.asset_id][t] if not isinstance(a,IndustrialLoadAsset) else 0.0) for t in range(n)]
                prob += sum(actual) >= a.energy_required_kwh
            if isinstance(a,IndustrialLoadAsset): prob += lpSum(flex_vars[a.asset_id]) == 0

        for a in heat_pumps:
            v=hp_vars[a.asset_id]
            for t in range(n):
                actual=a.baseline_power_kw+v["delta"][t]
                prev=a.initial_thermal_kwh if t==0 else v["thermal"][t-1]
                prob += v["thermal"][t] == prev+actual*a.thermal_gain_per_kwh-a.thermal_loss_kwh
            if a.target_thermal_kwh is not None:
                target=min(max(a.end_hour-1,0),n-1)
                prob += v["thermal"][target] >= a.target_thermal_kwh
            prob += lpSum(v["delta"]) == 0

        prob.solve(COIN_CMD(msg=False))
        status=LpStatus.get(prob.status,"unknown").lower()
        if status!="optimal":
            return MultiAssetOptimizationResult(status,[],0.0,0.0,0.0,solver_time_ms=(time.time()-started)*1000)

        schedule=[]
        for t in range(n):
            row={"hour":t,"price_eur_mwh":prices[t],"grid_import_kw":round(value(grid_import[t]) or 0.0,3),"grid_export_kw":round(value(grid_export[t]) or 0.0,3),"solar_kw":round(sum(self._series(a.forecast_kw,n)[t] for a in solar_assets),3)}
            for a in batteries:
                v=battery_vars[a.asset_id]; row[f"battery_{a.asset_id}"]={"charge_kw":round(value(v["charge"][t]) or 0.0,3),"discharge_kw":round(value(v["discharge"][t]) or 0.0,3),"soc_pct":round((value(v["soc"][t]) or 0.0)/a.capacity_kwh*100,2)}
            for a in evs:
                v=ev_vars[a.asset_id]; d=value(v["delta"][t]) or 0.0; actual=v["baseline"][t]+d; row[f"ev_{a.asset_id}"]={"charge_kw":round(actual,3),"flex_kw":round(d,3),"soc_pct":round((value(v["soc"][t]) or 0.0)/a.capacity_kwh*100,2)}
            for a in flex_loads:
                if isinstance(a, IndustrialLoadAsset) and a.start_hour <= t < min(a.end_hour, n):
                    actual=a.baseline_kw+value(flex_vars[a.asset_id][t])
                elif isinstance(a, IndustrialLoadAsset):
                    actual=0.0
                else:
                    actual=value(flex_vars[a.asset_id][t])
                row[f"load_{a.asset_id}_kw"]=round(actual or 0.0,3)
            for a in heat_pumps:
                v=hp_vars[a.asset_id]; d=value(v["delta"][t]) or 0.0; row[f"heat_pump_{a.asset_id}"]={"power_kw":round(a.baseline_power_kw+d,3),"flex_kw":round(d,3),"thermal_kwh":round(value(v["thermal"][t]) or 0.0,3)}
            schedule.append(row)

        dispatch={}
        for a in batteries:
            v=battery_vars[a.asset_id]; dispatch[a.asset_id]=[round((value(v["discharge"][t]) or 0.0)-(value(v["charge"][t]) or 0.0),3) for t in range(n)]
        for a in evs:
            v=ev_vars[a.asset_id]; dispatch[a.asset_id]=[round(-(value(v["delta"][t]) or 0.0),3) for t in range(n)]
        for a in flex_loads: dispatch[a.asset_id]=[round(value(flex_vars[a.asset_id][t]) or 0.0,3) for t in range(n)]
        for a in heat_pumps:
            v=hp_vars[a.asset_id]; dispatch[a.asset_id]=[round(-(value(v["delta"][t]) or 0.0),3) for t in range(n)]
        site_dispatch={}
        for a in batteries+evs+flex_loads+heat_pumps:
            key=str(a.site_id) if a.site_id is not None else "unassigned"; vals=dispatch[a.asset_id]
            site_dispatch.setdefault(key,[0.0]*n); site_dispatch[key]=[round(x+y,3) for x,y in zip(site_dispatch[key],vals)]
        vpp_dispatch=[round(sum(vals[t] for vals in site_dispatch.values()),3) for t in range(n)]
        return MultiAssetOptimizationResult("optimal",schedule,round(float(value(prob.objective) or 0.0),4),round(sum(r["grid_import_kw"] for r in schedule),3),round(sum(r["grid_export_kw"] for r in schedule),3),dispatch,site_dispatch,vpp_dispatch,round((time.time()-started)*1000,1))

    @staticmethod
    def _ev_baseline_profile(asset: EVAsset,n:int)->List[float]:
        required=max(0.0,(asset.target_soc-asset.initial_soc)*asset.capacity_kwh); profile=[0.0]*n
        for hour in range(max(0,asset.arrival_hour),min(asset.departure_hour,n)):
            if required<=1e-9: break
            power=min(asset.max_charge_kw,required/asset.charge_efficiency); profile[hour]=power; required-=power*asset.charge_efficiency
        return profile

    @staticmethod
    def _series(values:List[float],n:int)->List[float]:
        return [float(values[i]) if i<len(values) else 0.0 for i in range(n)]
