"""V2G (vehicle-to-grid) tests for EVAsset.

discharge_allowed defaults to False (charge-only), so every existing EV
scenario is untouched unless a test opts in explicitly. These tests exercise
the opt-in path: a V2G-enabled EV must actually use its discharge capability
when it's economically worthwhile, respect max_discharge_kw, and still reach
target_soc by departure -- and a charge-only EV in the identical price
scenario must never discharge, proving the flag actually gates the behavior
rather than leaking into assets that didn't ask for it.
"""
from __future__ import annotations

from optimization.assets import EVAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer

# Cheap-expensive-cheap: a V2G car with charge to spare should sell during
# the expensive hours and buy back during the cheap ones.
PRICES = [20, 20, 100, 100, 20, 20]
N = len(PRICES)


def _v2g_portfolio(**overrides):
    portfolio = VPPPortfolio(base_load_kw=[0] * N, prices_eur_mwh=PRICES, max_import_kw=100, max_export_kw=100)
    kwargs = dict(
        asset_id="ev-1", name="EV", capacity_kwh=40, max_charge_kw=10,
        initial_soc=0.80, target_soc=0.50, min_soc=0.10, max_soc=0.95,
        arrival_hour=0, departure_hour=N,
        discharge_allowed=True, max_discharge_kw=10, discharge_efficiency=0.95,
    )
    kwargs.update(overrides)
    portfolio.add(EVAsset(**kwargs))
    return portfolio


def test_v2g_ev_discharges_during_expensive_hours():
    result = MultiAssetOptimizer().optimize(_v2g_portfolio())
    assert result.status == "optimal"
    peak_hours = [t for t, p in enumerate(PRICES) if p == 100]
    assert any(result.schedule[t]["ev_ev-1"]["discharge_kw"] > 0.1 for t in peak_hours), (
        "a V2G EV with charge to spare should discharge during the expensive hours"
    )


def test_v2g_ev_still_reaches_target_soc_at_departure():
    result = MultiAssetOptimizer().optimize(_v2g_portfolio())
    assert result.status == "optimal"
    assert result.schedule[-1]["ev_ev-1"]["soc_pct"] >= 50.0 - 0.5  # rounding slack


def test_v2g_ev_respects_max_discharge_kw():
    result = MultiAssetOptimizer().optimize(_v2g_portfolio(max_discharge_kw=3))
    assert result.status == "optimal"
    assert all(row["ev_ev-1"]["discharge_kw"] <= 3.0 + 1e-6 for row in result.schedule)


def test_v2g_dispatch_sign_matches_battery_convention():
    """dispatch[asset_id] must be discharge-charge (positive=export), the same
    sign convention control.dispatch_executor already expects for batteries."""
    result = MultiAssetOptimizer().optimize(_v2g_portfolio())
    assert result.status == "optimal"
    for t, row in enumerate(result.schedule):
        expected = round(row["ev_ev-1"]["discharge_kw"] - row["ev_ev-1"]["charge_kw"], 3)
        assert result.asset_dispatch["ev-1"][t] == expected


def test_charge_only_ev_never_discharges_in_the_same_scenario():
    """Negative control: discharge_allowed defaults to False, so the exact
    same profitable-to-discharge price scenario must produce zero export --
    proving V2G doesn't leak into assets that never opted in."""
    portfolio = VPPPortfolio(base_load_kw=[0] * N, prices_eur_mwh=PRICES, max_import_kw=100, max_export_kw=100)
    portfolio.add(EVAsset(asset_id="ev-1", name="EV", capacity_kwh=40, max_charge_kw=10,
                          initial_soc=0.80, target_soc=0.50, arrival_hour=0, departure_hour=N))
    result = MultiAssetOptimizer().optimize(portfolio)
    assert result.status == "optimal"
    assert all(v <= 0.0 + 1e-6 for v in result.asset_dispatch["ev-1"]), (
        "a charge-only EV (discharge_allowed=False) must never show positive (export) dispatch"
    )
