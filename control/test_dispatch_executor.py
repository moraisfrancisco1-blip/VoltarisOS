import pytest

from control.dispatch_executor import DispatchExecutor


class Device:
    def __init__(self, device_id, site_id, device_type, config):
        self.id = device_id
        self.site_id = site_id
        self.device_type = device_type
        self.config = config


def test_dispatch_executor_is_dry_run_and_clamps_battery():
    device = Device(7, 101, "battery", {"max_charge_kw": 100, "max_discharge_kw": 80})
    executor = DispatchExecutor()
    setpoints = executor.build_setpoints([device], {"device-7": [120, -150, 20]})

    assert [sp.power_kw for sp in setpoints] == [80.0, -100.0, 20.0]
    assert [sp.action for sp in setpoints] == ["discharge", "charge", "discharge"]
    result = executor.execute(setpoints)
    assert result["mode"] == "dry_run"
    assert result["executed"] is False
    assert result["physical_control"] == "not_connected"


def test_physical_execution_is_rejected():
    with pytest.raises(ValueError, match="dry_run"):
        DispatchExecutor(mode="live")


def test_ev_can_only_charge():
    device = Device(8, 101, "ev", {"max_charge_kw": 50})
    setpoints = DispatchExecutor().build_setpoints([device], {"device-8": [20, -30]})

    assert [sp.power_kw for sp in setpoints] == [0.0, -30.0]
    assert [sp.action for sp in setpoints] == ["hold", "charge"]


def test_heat_pump_can_only_heat():
    device = Device(9, 101, "heat_pump", {"max_power_kw": 20})
    setpoints = DispatchExecutor().build_setpoints([device], {"device-9": [5, -12, -25]})

    # Same convention as EV: never exports, clamped into [-max_power, 0].
    assert [sp.power_kw for sp in setpoints] == [0.0, -12.0, -20.0]
    assert [sp.action for sp in setpoints] == ["hold", "heat", "heat"]


def test_ev_can_discharge_only_when_v2g_enabled():
    v2g_device = Device(11, 101, "ev_charger", {"max_charge_kw": 50, "max_discharge_kw": 22, "v2g_enabled": True})
    setpoints = DispatchExecutor().build_setpoints([v2g_device], {"device-11": [30, -40, 0]})
    assert [sp.power_kw for sp in setpoints] == [22.0, -40.0, 0.0]
    assert [sp.action for sp in setpoints] == ["discharge", "charge", "hold"]

    # Same asset_dispatch values, but v2g_enabled missing/false: export must be clamped away.
    plain_device = Device(12, 101, "ev_charger", {"max_charge_kw": 50, "max_discharge_kw": 22})
    setpoints = DispatchExecutor().build_setpoints([plain_device], {"device-12": [30, -40, 0]})
    assert [sp.power_kw for sp in setpoints] == [0.0, -40.0, 0.0]
    assert [sp.action for sp in setpoints] == ["hold", "charge", "hold"]


def test_flexible_load_curtailment_survives_to_setpoint():
    """Regression test: a curtailed absolute power (>=0, below the device's
    normal draw) must reach the executor as-is, not get clamped to 0. Before
    the fix, the optimizer fed this branch a bare delta that went negative for
    any curtailment below baseline, which this same >=0 clamp then discarded."""
    device = Device(10, 101, "industrial_load", {"max_power_kw": 50})
    setpoints = DispatchExecutor().build_setpoints([device], {"device-10": [50.0, 15.0, 0.0]})

    assert [sp.power_kw for sp in setpoints] == [50.0, 15.0, 0.0]
    assert [sp.action for sp in setpoints] == ["consume", "consume", "hold"]
