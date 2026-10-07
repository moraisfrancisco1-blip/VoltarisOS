"""Marstek connector, tested against a real VenusE 3.0 (firmware 148) answer. Network identifiers in the
sample (IP, MAC addresses, Wi-Fi name, the MAC inside "src") are removed."""
import json
import socket
import threading

import pytest

from gateway.connectors import marstek as mk

SRC = "VenusE 3.0-<redacted>"
REAL_ANSWERS = {
    "ES.GetStatus": {"id": 2, "src": SRC, "result": {
        "id": 0, "bat_soc": 25, "bat_cap": 5120, "pv_power": 0, "ongrid_power": -33, "offgrid_power": 0,
        "total_pv_energy": 0, "total_grid_output_energy": 1664301, "total_grid_input_energy": 1324551,
        "total_load_energy": 0}},
    "ES.GetMode": {"id": 3, "src": SRC, "result": {
        "id": 0, "mode": "AI", "ongrid_power": -34, "offgrid_power": 0, "bat_soc": 25, "ct_state": 1,
        "a_power": -168, "b_power": -155, "c_power": 21, "total_power": -323,
        "input_energy": 408056190, "output_energy": 227207190}},
    "Bat.GetStatus": {"id": 4, "src": SRC, "result": {
        "id": 0, "soc": 25, "charg_flag": True, "dischrg_flag": True, "bat_temp": 24.0,
        "bat_capacity": 1320.0, "rated_capacity": 5120.0}},
}


def test_real_answer_gives_the_verified_fields_only():
    reading = mk.parse(REAL_ANSWERS)
    assert reading.soc_pct == 25.0
    assert reading.temp_c == 24.0
    assert reading.power_kw is None and reading.energy_kwh is None  # signs/units not verified yet
    marstek = reading.raw["marstek"]
    assert marstek["mode"] == "AI"
    assert (marstek["bat_capacity_wh"], marstek["rated_capacity_wh"]) == (1320.0, 5120.0)
    assert marstek["charging_allowed"] is True
    # the capacity ratio agrees with the reported SoC (this is why soc/capacity are trusted)
    assert marstek["bat_capacity_wh"] / marstek["rated_capacity_wh"] * 100 == pytest.approx(25, abs=1.5)


def test_battery_state_follows_the_sign_seen_in_the_app():
    # Real unit: ongrid_power -33 W while the Marstek app said "Opladen" (charging), Net 32 W.
    assert mk.parse(REAL_ANSWERS).raw["marstek"]["battery_state_provisional"] == "charging"

    def with_power(watts):
        answers = json.loads(json.dumps(REAL_ANSWERS))
        answers["ES.GetStatus"]["result"]["ongrid_power"] = watts
        return mk.parse(answers).raw["marstek"]["battery_state_provisional"]

    assert with_power(240) == "discharging"
    assert with_power(-3) == "idle" and with_power(0) == "idle" and with_power(5) == "idle"


def test_unverified_numbers_are_kept_raw_and_labelled():
    unverified = mk.parse(REAL_ANSWERS).raw["marstek"]["unverified"]
    assert unverified["total_power"] == -323 and unverified["ongrid_power"] == -34
    assert unverified["total_grid_output_energy"] == 1664301


def test_no_identifier_is_ever_stored():
    answers = json.loads(json.dumps(REAL_ANSWERS))
    answers["ES.GetStatus"]["result"].update({"ip": "192.168.1.9", "wifi_mac": "aa", "ble_mac": "bb", "wifi_name": "home"})
    stored = json.dumps(mk.parse(answers).raw)
    for needle in ("192.168", '"aa"', '"bb"', "home", "VenusE", "src"):
        assert needle not in stored


def test_soc_falls_back_to_the_status_answer_when_the_battery_answer_is_missing():
    answers = {"ES.GetStatus": REAL_ANSWERS["ES.GetStatus"]}
    reading = mk.parse(answers)
    assert reading.soc_pct == 25.0 and reading.temp_c is None


def test_nothing_usable_is_an_error_not_a_reading():
    with pytest.raises(ValueError):
        mk.parse({})
    with pytest.raises(ValueError):
        mk.parse({"ES.GetStatus": {"id": 2, "error": {"code": -32601, "message": "Method not found"}}})


@pytest.mark.parametrize("soc", [-1, 101, 250])
def test_an_impossible_state_of_charge_is_rejected(soc):
    answers = json.loads(json.dumps(REAL_ANSWERS))
    answers["Bat.GetStatus"]["result"]["soc"] = soc
    with pytest.raises(ValueError):
        mk.parse(answers)


def test_reads_never_include_a_set_command():
    assert mk.READ_METHODS and all(".Get" in m for m in mk.READ_METHODS)


def test_min_interval_makes_a_second_read_wait():
    now = {"t": 100.0}
    limiter = mk._MinInterval(60.0, clock=lambda: now["t"])
    assert limiter.wait_time("bat") == 0.0
    limiter.mark("bat")
    now["t"] = 130.0
    assert limiter.wait_time("bat") == pytest.approx(30.0)
    assert limiter.wait_time("other") == 0.0
    now["t"] = 161.0
    assert limiter.wait_time("bat") == 0.0


def test_exchange_talks_to_a_battery_over_udp_and_only_asks_to_read():
    battery = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    battery.bind(("127.0.0.1", 0))
    battery_port = battery.getsockname()[1]
    seen = []

    def serve():
        battery.settimeout(3)
        try:
            for _ in range(len(mk.READ_METHODS)):
                data, addr = battery.recvfrom(65535)
                request = json.loads(data)
                seen.append(request["method"])
                reply = json.loads(json.dumps(REAL_ANSWERS[request["method"]]))
                reply["id"] = request["id"]
                battery.sendto(json.dumps(reply).encode(), addr)
        except socket.timeout:
            pass

    thread = threading.Thread(target=serve)
    thread.start()
    try:
        answers = mk._exchange("127.0.0.1", battery_port, 0, timeout=2.0, attempts=1, pause=0)
    finally:
        thread.join()
        battery.close()

    assert seen == list(mk.READ_METHODS)
    assert mk.parse(answers).soc_pct == 25.0
