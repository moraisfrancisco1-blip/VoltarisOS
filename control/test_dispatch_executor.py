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
