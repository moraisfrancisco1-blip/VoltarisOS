from simulation.flexible_assets import IndustrialLoadSimulator, HeatPumpSimulator


def test_industrial_load_respects_operating_limits():
    asset = IndustrialLoadSimulator("factory-1", baseline_kw=500, min_kw=250, max_kw=600)
    result = asset.simulate([200, 400, 700])
    assert result.asset_type == "industrial_load"
    assert result.power_kw == [250, 400, 600]


def test_heat_pump_respects_power_limits_and_tracks_thermal_state():
    asset = HeatPumpSimulator("hp-1", nominal_kw=100, min_kw=20, thermal_capacity_kwh=200, thermal_soc_kwh=50)
    result = asset.simulate([0, 50, 120])
    assert result.asset_type == "heat_pump"
    assert result.power_kw == [20, 50, 100]
    assert len(result.energy_kwh) == 1
    assert 0 <= result.energy_kwh[0] <= 200
