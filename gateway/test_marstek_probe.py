"""Marstek probe against a fake battery on the loopback interface (no real device)."""
import json
import socket
import threading

from gateway import marstek_probe as mp


def _free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class FakeMarstek(threading.Thread):
    """Answers every request like the real device does: to the asking host, on the
    port the probe has bound locally."""

    def __init__(self, reply_port):
        super().__init__(daemon=True)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.settimeout(0.2)
        self.port = self.sock.getsockname()[1]
        self.reply_port = reply_port
        self.methods = []
        self.running = True

    def run(self):
        while self.running:
            try:
                data, _ = self.sock.recvfrom(65535)
            except socket.timeout:
                continue
            request = json.loads(data)
            self.methods.append(request["method"])
            if request["method"] == "Marstek.GetDevice":
                result = {"device": "VenusE 3.0", "ver": 139, "ble_mac": "AABBCCDDEEFF",
                          "wifi_mac": "112233445566", "wifi_name": "MyHomeWifi", "ip": "192.168.1.9"}
            else:
                result = {"soc": 55, "bat_power": -1200}
            reply = {"id": request["id"], "src": "VenusE 3.0-test", "result": result}
            self.sock.sendto(json.dumps(reply).encode(), ("127.0.0.1", self.reply_port))

    def stop(self):
        self.running = False
        self.join(timeout=2)
        self.sock.close()


def _run_probe(**kwargs):
    local_port = _free_port()
    fake = FakeMarstek(reply_port=local_port)
    fake.start()
    try:
        out = mp.probe(ip="127.0.0.1", remote_port=fake.port, local_port=local_port,
                       timeout=2.0, attempts=1, pause=0, **kwargs)
    finally:
        fake.stop()
    return out, fake


def test_probe_reads_every_method_and_only_reads():
    out, fake = _run_probe()
    assert set(out["methods"]) == set(mp.READ_ONLY_METHODS)
    assert fake.methods == list(mp.READ_ONLY_METHODS)
    assert not any(".Set" in m for m in fake.methods)  # never writes to the battery
    assert out["methods"]["ES.GetStatus"]["result"] == {"soc": 55, "bat_power": -1200}


def test_probe_redacts_network_identifiers_but_keeps_measurements():
    out, _ = _run_probe()
    device = out["methods"]["Marstek.GetDevice"]["result"]
    assert device["wifi_name"] == "<redacted>" and device["ble_mac"] == "<redacted>"
    assert device["wifi_mac"] == "<redacted>" and device["ip"] == "<redacted>"
    assert device["device"] == "VenusE 3.0" and device["ver"] == 139  # model/firmware kept: needed for scaling
    assert out["target"] == "<redacted>"


def test_probe_can_keep_identifiers_when_asked():
    out, _ = _run_probe(do_redact=False)
    assert out["target"] == "127.0.0.1"
    assert out["methods"]["Marstek.GetDevice"]["result"]["wifi_name"] == "MyHomeWifi"


def test_unanswered_methods_are_reported_not_raised():
    local_port = _free_port()
    out = mp.probe(ip="127.0.0.1", remote_port=_free_port(), local_port=local_port,
                   timeout=0.2, attempts=1, pause=0)
    assert all("error" in entry for entry in out["methods"].values())


def test_wait_for_ignores_answers_to_other_requests():
    local = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    local.bind(("127.0.0.1", 0))
    port = local.getsockname()[1]
    sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sender.sendto(json.dumps({"id": 99, "result": {}}).encode(), ("127.0.0.1", port))  # someone else's
    sender.sendto(b"not json", ("127.0.0.1", port))
    sender.sendto(json.dumps({"id": 7, "result": {"ok": 1}}).encode(), ("127.0.0.1", port))
    message, _ = mp._wait_for(local, 7, 1.0)
    assert message["result"] == {"ok": 1}
    assert mp._wait_for(local, 7, 0.1) is None
    local.close()
    sender.close()


def test_redact_walks_nested_structures():
    data = {"a": [{"wifi_name": "x", "keep": 1}], "ssid": None}
    assert mp.redact(data) == {"a": [{"wifi_name": "<redacted>", "keep": 1}], "ssid": None}
