"""Regression tests for the active MultiAssetOptimizer (PuLP v4 migration).

Validates mathematical invariants rather than brittle golden values, so the
suite stays stable across minor CBC version changes.
"""
from __future__ import annotations

import warnings

from optimization.multi_asset_optimizer import MultiAssetOptimizer
from simulation.scenarios.mixed_vpp_24h import build_mixed_vpp


def _solve():
    portfolio = build_mixed_vpp()
    result = MultiAssetOptimizer().optimize(portfolio)
    return portfolio, result


def test_optimizer_numeric_invariants():
    portfolio, result = _solve()

    assert result.status == "optimal"
    assert len(result.schedule) == 24
    assert len(result.vpp_dispatch) == 24

    base_load = portfolio.base_load_kw

    for row in result.schedule:
        t = row["hour"]
        gi = row["grid_import_kw"]
        ge = row["grid_export_kw"]
        solar = row["solar_kw"]
        battery = row["battery_battery-1"]
        ev = row["ev_ev-1"]
        factory = row["load_factory-1_kw"]
        hp = row["heat_pump_hp-1"]

        # Import/export stay within the grid connection limits.
        assert -1e-6 <= gi <= 1000.0 + 1e-6
        assert -1e-6 <= ge <= 1000.0 + 1e-6

        # Battery charge/discharge power bounds.
        assert -1e-6 <= battery["charge_kw"] <= 300.0 + 1e-6
        assert -1e-6 <= battery["discharge_kw"] <= 300.0 + 1e-6

        # EV charging power bound.
        assert -1e-6 <= ev["charge_kw"] <= 22.0 + 1e-6

        # State-of-charge limits (battery 10..95%, EV 10..100%).
        assert 10.0 - 0.5 <= battery["soc_pct"] <= 95.0 + 0.5
        assert 10.0 - 0.5 <= ev["soc_pct"] <= 100.0 + 0.5

        # Factory load bounds: within the flexible window it ranges between
        # min power and baseline + max recovery; outside it is curtailed to 0.
        if 6 <= t < 22:
            assert 300.0 - 0.01 <= factory <= 600.0 + 0.01
        else:
            assert abs(factory) < 0.01

        # Per-hour power balance:
        # gi - ge == base_load + factory + ev_load + hp_load + (charge - discharge) - solar
        rhs = (
            base_load[t]
            + factory
            + ev["charge_kw"]
            + hp["power_kw"]
            + (battery["charge_kw"] - battery["discharge_kw"])
            - solar
        )
        assert abs((gi - ge) - rhs) < 0.02

    # EV and heat-pump flexibility are energy-neutral (hard sum(delta)==0).
    for asset_id in ("ev-1", "hp-1"):
        assert abs(sum(result.asset_dispatch[asset_id])) < 0.05

    # Factory must meet its total energy requirement (hard constraint).
    factory_energy = sum(row["load_factory-1_kw"] for row in result.schedule)
    assert factory_energy >= 7200.0 - 0.05

    # Battery returns to its initial SOC (hard terminal constraint).
    final_battery_soc = result.schedule[-1]["battery_battery-1"]["soc_pct"]
    assert abs(final_battery_soc - 55.0) < 0.5

    # Energy totals are non-negative.
    assert result.total_import_kwh >= -1e-6
    assert result.total_export_kwh >= -1e-6

    # Cost reconciliation: total cost is at least the energy-market cost
    # (peak + non-energy components are non-negative).
    energy_cost = sum(
        row["grid_import_kw"] * row["price_eur_mwh"] / 1000.0
        - row["grid_export_kw"] * row["price_eur_mwh"] / 1000.0
        for row in result.schedule
    )
    assert result.total_cost_eur >= energy_cost - 1e-6


def test_optimizer_emits_no_lpvariable_deprecation():
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        result = MultiAssetOptimizer().optimize(build_mixed_vpp())

    assert result.status == "optimal"
    lp_warnings = [
        w
        for w in caught
        if issubclass(w.category, DeprecationWarning) and "LpVariable" in str(w.message)
    ]
    assert lp_warnings == []
