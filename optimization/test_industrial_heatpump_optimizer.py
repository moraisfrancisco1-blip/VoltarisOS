from optimization.assets import HeatPumpAsset, IndustrialLoadAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def test_optimizer_accepts_industrial_load_and_heat_pump():
    portfolio = VPPPortfolio(
        base_load_kw=[100.0] * 6,
        prices_eur_mwh=[40.0, 40.0, 150.0, 150.0, 40.0, 40.0],
    )
    portfolio.add(IndustrialLoadAsset(
        asset_id="factory-1",
        name="Factory",
        site_id=10,
        min_power_kw=40,
        max_power_kw=120,
        energy_required_kwh=360,
        curtailment_cost_eur_kwh=0.01,
        baseline_kw=100,
    ))
    portfolio.add(HeatPumpAsset(
        asset_id="hp-1",
        name="Heat pump",
        site_id=10,
        min_power_kw=10,
        nominal_power_kw=60,
        baseline_power_kw=40,
        initial_thermal_kwh=50,
        target_thermal_kwh=80,
        max_thermal_kwh=200,
    ))

    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"
    assert "factory-1" in result.asset_dispatch
    assert "hp-1" in result.asset_dispatch
    assert "10" in result.site_dispatch
    assert len(result.vpp_dispatch) == 6
