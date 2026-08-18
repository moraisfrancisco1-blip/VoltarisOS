from optimization.assets import HeatPumpAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def test_heat_pump_thermal_constraint_is_respected():
    portfolio = VPPPortfolio(
        assets=[HeatPumpAsset(
            asset_id="hp-1",
            name="Heat Pump",
            site_id=1,
            nominal_power_kw=20,
            min_power_kw=0,
            initial_thermal_kwh=20,
            min_thermal_kwh=0,
            max_thermal_kwh=40,
            thermal_gain_per_kwh=1.0,
            thermal_loss_kwh=2.0,
            target_thermal_kwh=30,
        )],
        base_load_kw=[50] * 6,
        prices_eur_mwh=[200, 200, 200, 200, 20, 20],
    )

    result = MultiAssetOptimizer().optimize(portfolio)

    assert result.status == "optimal"
    assert "hp-1" in result.asset_dispatch
    assert result.schedule[-1]["heat_pump_hp-1"]["thermal_kwh"] >= 30
