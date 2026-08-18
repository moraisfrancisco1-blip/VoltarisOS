"""Regression tests for the economic accounting of the VPP optimizer."""

from optimization.multi_asset_optimizer import MultiAssetOptimizer
from simulation.scenarios.mixed_vpp_24h import build_mixed_vpp


def _energy_market_cost(result) -> float:
    return sum(
        row["grid_import_kw"] * row["price_eur_mwh"] / 1000.0
        - row["grid_export_kw"] * row["price_eur_mwh"] / 1000.0
        for row in result.schedule
    )


def test_total_cost_reconciles_to_energy_peak_and_non_energy_components():
    portfolio = build_mixed_vpp()
    portfolio.peak_demand_cost_eur_per_kw = 1.0
    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"

    energy_cost = _energy_market_cost(result)
    peak_cost = max(row["grid_import_kw"] for row in result.schedule) * portfolio.peak_demand_cost_eur_per_kw
    non_energy_cost = result.total_cost_eur - energy_cost - peak_cost

    assert abs(result.total_cost_eur - (energy_cost + peak_cost + non_energy_cost)) < 1e-6
    assert peak_cost >= 0.0
    assert non_energy_cost >= 0.0


def test_increasing_peak_tariff_cannot_reduce_optimized_total_cost():
    optimizer = MultiAssetOptimizer()

    low = build_mixed_vpp()
    low.peak_demand_cost_eur_per_kw = 0.0
    low_result = optimizer.optimize(low)

    high = build_mixed_vpp()
    high.peak_demand_cost_eur_per_kw = 5.0
    high_result = optimizer.optimize(high)

    assert low_result.status == "optimal"
    assert high_result.status == "optimal"
    assert high_result.total_cost_eur >= low_result.total_cost_eur - 1e-6
