from simulation.virtual_assets import VirtualAsset, VirtualAssetSimulator


def test_battery_simulation_respects_soc_and_power_limits():
    battery = VirtualAsset(
        asset_id="bat-1",
        site_id=1,
        asset_type="battery",
        max_charge_kw=50,
        max_discharge_kw=40,
        capacity_kwh=100,
        soc_kwh=50,
        min_soc_kwh=10,
        max_soc_kwh=90,
    )

    steps = VirtualAssetSimulator([battery]).run(
        {"bat-1": [100, -100, 20]}, hours=3
    )

    assert [s.delivered_kw for s in steps] == [40.0, -50.0, 20.0]
    assert battery.soc_kwh == 20.0


def test_simulator_runs_24_hours():
    battery = VirtualAsset(
        asset_id="bat-1", site_id=1, asset_type="battery",
        max_charge_kw=50, max_discharge_kw=40,
        capacity_kwh=100, soc_kwh=50,
        min_soc_kwh=10, max_soc_kwh=90,
    )
    steps = VirtualAssetSimulator([battery]).run({"bat-1": [0] * 24})
    assert len(steps) == 24
    assert all(step.delivered_kw == 0 for step in steps)
