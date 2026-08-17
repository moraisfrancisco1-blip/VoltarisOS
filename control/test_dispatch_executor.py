from control.dispatch_executor import DispatchExecutor


def test_dispatch_executor_is_dry_run_and_clamps_battery():
    class Device:
        id = 7
        site_id = 101
        device_type = "battery"
        config = {"max_charge_kw": 100, "max_discharge_kw": 80}

    executor = DispatchExecutor()
    setpoints = executor.build_setpoints(
        [Device()],
        {"device-7": [120, -150, 20]},
    )

    assert [sp.power_kw for sp in setpoints] == [80.0, -100.0, 20.0]
    assert [sp.action for sp in setpoints] == ["discharge", "charge", "discharge"]
    result = executor.execute(setpoints)
    assert result["mode"] == "dry_run"
    assert result["executed"] is False
    assert result["physical_control"] == "not_connected"


def test_physical_execution_is_rejected():
    try:
        DispatchExecutor(mode="live")
    except ValueError as exc:
        assert "dry_run" in str(exc)
    else:
        raise AssertionError("Physical execution must remain disabled")
