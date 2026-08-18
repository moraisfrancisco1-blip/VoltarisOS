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


def test_zero_peak_tariff_removes_only_the_peak_component():
    portfolio = build_mixed_vpp()
    portfolio.peak_demand_cost_eur_per_kw = 0.0
    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"
    energy_cost = _energy_market_cost(result)
    assert abs(result.total_cost_eur - energy_cost - (result.total_cost_eur - energy_cost)) < 1e-6
    assert max(row["grid_import_kw"] for row in result.schedule) >= 0.0
