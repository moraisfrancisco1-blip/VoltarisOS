"""
milp_optimizer.py — Mixed Integer Linear Programming optimizer for VPP dispatch.

Uses PuLP (or scipy) to solve the optimal dispatch problem considering:
- Battery constraints (SOC, charge/discharge rates, efficiency)
- Grid constraints (import/export limits, tariffs)
- Market prices (spot, FCR, aFRR)
- Forecast data (solar, load, prices)
- Degradation costs

Usage:
    from optimization.milp_optimizer import MILPOptimizer
    
    optimizer = MILPOptimizer()
    result = optimizer.optimize(
        horizon_hours=24,
        battery_capacity_kwh=500,
        initial_soc=0.5,
        prices=price_forecast,
        load=load_forecast,
        solar=solar_forecast,
    )
"""
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@dataclass
class BatteryConstraints:
    """Battery physical constraints."""
    capacity_kwh: float
    max_charge_kw: float
    max_discharge_kw: float
    min_soc: float = 0.1  # 10% minimum
    max_soc: float = 0.95  # 95% maximum
    charge_efficiency: float = 0.95
    discharge_efficiency: float = 0.95
    degradation_cost_per_cycle: float = 0.5  # EUR/kWh throughput


@dataclass
class GridConstraints:
    """Grid connection constraints."""
    max_import_kw: float = 1000.0
    max_export_kw: float = 1000.0
    import_tariff_eur_kwh: float = 0.15
    export_tariff_eur_kwh: float = 0.05


@dataclass
class OptimizationResult:
    """Result of MILP optimization."""
    status: str  # "optimal", "infeasible", "error"
    schedule: List[Dict[str, Any]]  # Hourly dispatch schedule
    total_profit_eur: float
    total_charge_kwh: float
    total_discharge_kwh: float
    battery_cycles: float
    solver_time_ms: float
    
    def get_action_for_hour(self, hour: int) -> Dict[str, Any]:
        """Get dispatch action for a specific hour."""
        if 0 <= hour < len(self.schedule):
            return self.schedule[hour]
        return {"action": "hold", "power_kw": 0}


class MILPOptimizer:
    """
    Mixed Integer Linear Programming optimizer for VPP dispatch.
    
    Solves the optimal battery dispatch problem over a time horizon,
    considering battery constraints, grid constraints, and market prices.
    
    The optimization maximizes profit from:
    - Energy arbitrage (buy low, sell high)
    - Self-consumption optimization
    - Grid services (FCR, aFRR) if configured
    """
    
    def __init__(self):
        self.solver = "CBC"  # Default open-source solver
    
    def optimize(
        self,
        horizon_hours: int = 24,
        battery: Optional[BatteryConstraints] = None,
        grid: Optional[GridConstraints] = None,
        prices: Optional[List[float]] = None,
        load_forecast: Optional[List[float]] = None,
        solar_forecast: Optional[List[float]] = None,
        initial_soc: float = 0.5,
        target_soc: Optional[float] = None,
    ) -> OptimizationResult:
        """
        Run MILP optimization for battery dispatch.
        
        Args:
            horizon_hours: Optimization horizon (hours)
            battery: Battery constraints (uses defaults if None)
            grid: Grid constraints (uses defaults if None)
            prices: Hourly spot prices (EUR/MWh)
            load_forecast: Hourly load forecast (kW)
            solar_forecast: Hourly solar forecast (kW)
            initial_soc: Initial state of charge (0-1)
            target_soc: Target final SOC (0-1, optional)
        
        Returns:
            OptimizationResult with dispatch schedule
        """
        import time
        start_time = time.time()
        
        # Use defaults if not provided
        if battery is None:
            battery = BatteryConstraints(capacity_kwh=500, max_charge_kw=250, max_discharge_kw=250)
        if grid is None:
            grid = GridConstraints()
        if prices is None:
            prices = [50.0] * horizon_hours  # Default flat price
        if load_forecast is None:
            load_forecast = [0.0] * horizon_hours
        if solar_forecast is None:
            solar_forecast = [0.0] * horizon_hours
        
        # Validate inputs
        n = min(horizon_hours, len(prices), len(load_forecast), len(solar_forecast))
        if n == 0:
            return OptimizationResult(
                status="error",
                schedule=[],
                total_profit_eur=0,
                total_charge_kwh=0,
                total_discharge_kwh=0,
                battery_cycles=0,
                solver_time_ms=0,
            )
        
        try:
            # Try to use PuLP for proper MILP
            schedule, profit = self._solve_with_pulp(
                n, battery, grid, prices, load_forecast, solar_forecast, initial_soc, target_soc
            )
        except ImportError:
            # Fallback to rule-based optimization if PuLP not available
            logger.warning("PuLP not available, using rule-based optimization")
            schedule, profit = self._solve_rule_based(
                n, battery, grid, prices, load_forecast, solar_forecast, initial_soc
            )
        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            return OptimizationResult(
                status="error",
                schedule=[],
                total_profit_eur=0,
                total_charge_kwh=0,
                total_discharge_kwh=0,
                battery_cycles=0,
                solver_time_ms=(time.time() - start_time) * 1000,
            )
        
        # Calculate statistics
        total_charge = sum(s.get("charge_kw", 0) for s in schedule)
        total_discharge = sum(s.get("discharge_kw", 0) for s in schedule)
        battery_cycles = (total_charge + total_discharge) / (2 * battery.capacity_kwh) if battery.capacity_kwh > 0 else 0
        
        return OptimizationResult(
            status="optimal",
            schedule=schedule,
            total_profit_eur=round(profit, 2),
            total_charge_kwh=round(total_charge, 2),
            total_discharge_kwh=round(total_discharge, 2),
            battery_cycles=round(battery_cycles, 2),
            solver_time_ms=round((time.time() - start_time) * 1000, 1),
        )
    
    def _solve_with_pulp(
        self,
        n: int,
        battery: BatteryConstraints,
        grid: GridConstraints,
        prices: List[float],
        load: List[float],
        solar: List[float],
        initial_soc: float,
        target_soc: Optional[float],
    ) -> tuple:
        """Solve using PuLP MILP solver."""
        from pulp import LpProblem, LpMinimize, LpVariable, LpStatus, value, lpSum
        
        prob = LpProblem("VPP_Dispatch", LpMinimize)
        
        # Decision variables
        charge = [LpVariable(f"charge_{t}", 0, battery.max_charge_kw) for t in range(n)]
        discharge = [LpVariable(f"discharge_{t}", 0, battery.max_discharge_kw) for t in range(n)]
        soc = [LpVariable(f"soc_{t}", battery.min_soc * battery.capacity_kwh, battery.max_soc * battery.capacity_kwh) for t in range(n)]
        grid_import = [LpVariable(f"import_{t}", 0, grid.max_import_kw) for t in range(n)]
        grid_export = [LpVariable(f"export_{t}", 0, grid.max_export_kw) for t in range(n)]
        
        # Binary variables for charging/discharging (prevent simultaneous)
        is_charging = [LpVariable(f"is_charging_{t}", cat="Binary") for t in range(n)]
        
        # Objective: minimize cost (negative profit)
        costs = []
        for t in range(n):
            price = prices[t] / 1000  # Convert EUR/MWh to EUR/kWh
            net_load = load[t] - solar[t]
            
            # Grid cost/revenue
            grid_cost = grid_import[t] * price - grid_export[t] * price
            
            # Degradation cost
            degradation = (charge[t] + discharge[t]) * battery.degradation_cost_per_cycle
            
            costs.append(grid_cost + degradation)
        
        prob += lpSum(costs)
        
        # Constraints
        for t in range(n):
            # SOC dynamics
            if t == 0:
                prev_soc = initial_soc * battery.capacity_kwh
            else:
                prev_soc = soc[t-1]
            
            prob += soc[t] == prev_soc + (charge[t] * battery.charge_efficiency - discharge[t] / battery.discharge_efficiency)
            
            # Power balance
            net_load = load[t] - solar[t]
            prob += grid_import[t] - grid_export[t] == net_load + charge[t] - discharge[t]
            
            # Prevent simultaneous charge/discharge
            prob += charge[t] <= battery.max_charge_kw * is_charging[t]
            prob += discharge[t] <= battery.max_discharge_kw * (1 - is_charging[t])
        
        # Final SOC constraint
        if target_soc is not None:
            prob += soc[n-1] >= target_soc * battery.capacity_kwh * 0.95
            prob += soc[n-1] <= target_soc * battery.capacity_kwh * 1.05
        
        # Solve
        prob.solve()
        
        # Extract solution
        schedule = []
        for t in range(n):
            schedule.append({
                "hour": t,
                "charge_kw": round(value(charge[t]) or 0, 2),
                "discharge_kw": round(value(discharge[t]) or 0, 2),
                "soc_pct": round((value(soc[t]) or 0) / battery.capacity_kwh * 100, 1),
                "grid_import_kw": round(value(grid_import[t]) or 0, 2),
                "grid_export_kw": round(value(grid_export[t]) or 0, 2),
                "action": self._get_action(value(charge[t]) or 0, value(discharge[t]) or 0),
            })
        
        profit = -value(prob.objective) if prob.status == 1 else 0
        
        return schedule, profit
    
    def _solve_rule_based(
        self,
        n: int,
        battery: BatteryConstraints,
        grid: GridConstraints,
        prices: List[float],
        load: List[float],
        solar: List[float],
        initial_soc: float,
    ) -> tuple:
        """
        Rule-based fallback optimization when PuLP is not available.
        
        Uses price thresholds and SOC limits to make dispatch decisions.
        """
        schedule = []
        current_soc = initial_soc
        
        # Calculate price statistics for thresholds
        avg_price = sum(prices) / len(prices) if prices else 50
        low_price = sorted(prices)[len(prices) // 4] if prices else 30
        high_price = sorted(prices, reverse=True)[len(prices) // 4] if prices else 80
        
        total_profit = 0
        
        for t in range(n):
            price = prices[t]
            net_load = load[t] - solar[t]
            
            charge_kw = 0
            discharge_kw = 0
            action = "hold"
            
            # Decision logic
            if price < low_price and current_soc < battery.max_soc:
                # Low price — charge
                charge_kw = min(battery.max_charge_kw, (battery.max_soc - current_soc) * battery.capacity_kwh)
                action = "charge"
            elif price > high_price and current_soc > battery.min_soc:
                # High price — discharge
                discharge_kw = min(battery.max_discharge_kw, (current_soc - battery.min_soc) * battery.capacity_kwh)
                action = "discharge"
            elif net_load > 0 and current_soc > battery.min_soc:
                # Net load positive and battery has energy — discharge to cover load
                discharge_kw = min(battery.max_discharge_kw, net_load, (current_soc - battery.min_soc) * battery.capacity_kwh)
                action = "discharge"
            elif net_load < 0 and current_soc < battery.max_soc:
                # Excess solar — charge
                charge_kw = min(battery.max_charge_kw, -net_load, (battery.max_soc - current_soc) * battery.capacity_kwh)
                action = "charge"
            
            # Update SOC
            soc_delta = (charge_kw * battery.charge_efficiency - discharge_kw / battery.discharge_efficiency) / battery.capacity_kwh
            current_soc = max(battery.min_soc, min(battery.max_soc, current_soc + soc_delta))
            
            # Calculate profit
            profit = (discharge_kw - charge_kw) * price / 1000  # EUR
            total_profit += profit
            
            schedule.append({
                "hour": t,
                "charge_kw": round(charge_kw, 2),
                "discharge_kw": round(discharge_kw, 2),
                "soc_pct": round(current_soc * 100, 1),
                "grid_import_kw": round(max(0, net_load + charge_kw - discharge_kw), 2),
                "grid_export_kw": round(max(0, -net_load - charge_kw + discharge_kw), 2),
                "action": action,
            })
        
        return schedule, total_profit
    
    def _get_action(self, charge: float, discharge: float) -> str:
        """Determine action from charge/discharge values."""
        if charge > 0.1:
            return "charge"
        elif discharge > 0.1:
            return "discharge"
        return "hold"