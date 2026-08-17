from simulation.scenarios.mixed_vpp_24h import build_mixed_vpp
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def test_mixed_vpp_24h_is_optimizable_and_aggregates_dispatch():
    result = MultiAssetOptimizer().optimize(build_mixed_vpp())

    assert result.status == "optimal"
    assert len(result.vpp_dispatch) == 24
    assert set(result.asset_dispatch) == {"battery-1", "ev-1", "factory-1", "hp-1"}
    assert {"101", "102", "103"}.issubset(result.site_dispatch)
    assert len(result.site_dispatch["101"]) == 24
    assert len(result.site_dispatch["102"]) == 24
    assert len(result.site_dispatch["103"]) == 24
    assert result.total_import_kwh >= 0
    assert result.total_export_kwh >= 0


def test_flexible_load_dispatch_is_energy_neutral():
    result = MultiAssetOptimizer().optimize(build_mixed_vpp())

    for asset_id in ("ev-1", "factory-1", "hp-1"):
        assert abs(sum(result.asset_dispatch[asset_id])) < 1e-6
