"""Hardening of physical control and server-side connections to user-supplied
destinations: SSRF guard (netguard), admin-only + audited EV commands, hard
current ceiling, device connection-test validation."""
from __future__ import annotations

import asyncio
import math
import socket

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import models, netguard
from backend.database import Base
from backend.main import app
from backend.routers import devices as devices_module
from backend.routers import ev_charger as ev_module
from backend.routers import webhooks as webhooks_module
from backend.security import get_current_user
from gateway.connectors import alfen_eve
import backend.tasks as tasks_module

TENANT_A = 1
ADMIN = {"sub": "admin@a.com", "tenant_id": TENANT_A, "role": "TENANT_ADMIN"}
MEMBER = {"sub": "member@a.com", "tenant_id": TENANT_A, "role": "TENANT_MEMBER"}


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session, monkeypatch):
    def _get_db():
        yield db_session

    for module in (devices_module, ev_module, webhooks_module):
        app.dependency_overrides[module.get_db] = _get_db
    app.dependency_overrides[get_current_user] = lambda: ADMIN
    monkeypatch.setattr(tasks_module.deliver_webhook, "delay", lambda *a, **kw: None)
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def production(monkeypatch):
    """Production policy: private destinations are NOT allowed."""
    monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", "false")


def _resolves_to(monkeypatch, *addresses):
    def fake_getaddrinfo(host, port, *a, **kw):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (addr, 0)) for addr in addresses]
    monkeypatch.setattr(netguard.socket, "getaddrinfo", fake_getaddrinfo)


# ── netguard ────────────────────────────────────────────────────────────────
class TestNetguardPolicy:
    @pytest.mark.parametrize("host", [
        "169.254.169.254", "0.0.0.0", "224.0.0.1", "fe80::1", "::ffff:169.254.169.254", "[fe80::1]",
    ])
    def test_always_blocked_even_when_private_is_allowed(self, host):
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_host(host, allow_private=True)

    @pytest.mark.parametrize("host", [
        "127.0.0.1", "10.0.0.5", "172.16.5.5", "192.168.1.65", "100.64.0.1", "::1", "fd00::1",
        "::ffff:10.0.0.1", "localhost", "LOCALHOST.", "db.internal", "printer.local",
        "redis.svc.cluster.local", "box.lan",
    ])
    def test_private_blocked_in_production_allowed_when_enabled(self, host):
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_host(host, allow_private=False, resolve=False)
        netguard.check_host(host, allow_private=True, resolve=False)  # no exception

    def test_public_ip_literal_is_allowed(self):
        netguard.check_host("8.8.8.8", allow_private=False)
        netguard.check_host("2606:4700:4700::1111", allow_private=False)

    def test_hostname_resolving_to_private_is_blocked(self, monkeypatch):
        _resolves_to(monkeypatch, "10.1.2.3")
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_host("innocent.example.com", allow_private=False)

    def test_every_resolved_address_must_be_allowed(self, monkeypatch):
        _resolves_to(monkeypatch, "93.184.216.34", "169.254.169.254")
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_host("mixed.example.com", allow_private=True)

    def test_hostname_resolving_to_public_is_allowed(self, monkeypatch):
        _resolves_to(monkeypatch, "93.184.216.34")
        netguard.check_host("example.com", allow_private=False)

    def test_unresolvable_host_fails_closed(self, monkeypatch):
        def boom(*a, **kw):
            raise socket.gaierror("nope")
        monkeypatch.setattr(netguard.socket, "getaddrinfo", boom)
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_host("does-not-exist.example", allow_private=False)

    def test_resolve_false_never_touches_the_network(self, monkeypatch):
        def boom(*a, **kw):
            raise AssertionError("DNS must not be used")
        monkeypatch.setattr(netguard.socket, "getaddrinfo", boom)
        netguard.check_host("example.com", allow_private=False, resolve=False)

    def test_empty_host_rejected(self):
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_host("  ", allow_private=True)

    def test_async_wrapper(self, monkeypatch):
        _resolves_to(monkeypatch, "10.0.0.1")
        with pytest.raises(netguard.BlockedDestination):
            asyncio.run(netguard.acheck_host("x.example.com", allow_private=False))


class TestNetguardUrls:
    @pytest.mark.parametrize("url", [
        "ftp://example.com/x", "file:///etc/passwd", "gopher://example.com", "http://", "not a url",
        "http://example.com:99999/",
    ])
    def test_bad_scheme_host_or_port(self, url):
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_url(url, allow_private=True, resolve=False)

    def test_userinfo_trick_is_judged_by_the_real_host(self):
        # the browser-looking part is a username; the host is the metadata IP
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_url("http://example.com@169.254.169.254/latest/meta-data", allow_private=True, resolve=False)

    def test_returns_the_hostname(self):
        assert netguard.check_url("https://hooks.example.com:8443/x", resolve=False, allow_private=False) == "hooks.example.com"

    def test_custom_scheme_allowed_only_when_asked(self):
        netguard.check_url("opc.tcp://plc.example.com:4840", schemes=("opc.tcp",), allow_private=False, resolve=False)
        with pytest.raises(netguard.BlockedDestination):
            netguard.check_url("opc.tcp://plc.example.com:4840", allow_private=False, resolve=False)


class TestNetguardEnvironmentPolicy:
    def test_default_follows_environment(self, monkeypatch):
        monkeypatch.delenv("ALLOW_PRIVATE_DESTINATIONS", raising=False)
        monkeypatch.setenv("ENVIRONMENT", "production")
        assert netguard.private_allowed() is False
        monkeypatch.setenv("ENVIRONMENT", "development")
        assert netguard.private_allowed() is True

    @pytest.mark.parametrize("value,expected", [("true", True), ("1", True), ("YES", True), ("false", False), ("0", False)])
    def test_explicit_flag_wins(self, monkeypatch, value, expected):
        monkeypatch.setenv("ENVIRONMENT", "production" if expected else "development")
        monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", value)
        assert netguard.private_allowed() is expected

    @pytest.mark.parametrize("environment,expected", [("production", False), ("development", True)])
    def test_empty_value_means_not_set(self, monkeypatch, environment, expected):
        # .env.example ships the variable empty; copying it must not change behaviour
        monkeypatch.setenv("ENVIRONMENT", environment)
        monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", "")
        assert netguard.private_allowed() is expected


# ── Webhooks ────────────────────────────────────────────────────────────────
def _seed_tenant_and_admin(db):
    db.add(models.Tenant(id=TENANT_A, name="A", slug="a", plan="pro", max_sites=20))
    db.add(models.User(tenant_id=TENANT_A, email=ADMIN["sub"], password_hash="x", role="TENANT_ADMIN"))
    db.commit()


class TestWebhookDestinations:
    @pytest.mark.parametrize("url", [
        "http://169.254.169.254/latest/meta-data", "http://localhost:8000/admin", "http://10.0.0.5/hook",
        "https://redis.internal/x", "http://[::1]/x", "http://example.com@169.254.169.254/",
    ])
    def test_internal_urls_rejected_on_create(self, client, db_session, production, url):
        _seed_tenant_and_admin(db_session)
        resp = client.post("/api/webhooks", json={"url": url, "event_types": ["*"]})
        assert resp.status_code == 422, resp.text

    def test_metadata_ip_rejected_even_when_private_is_allowed(self, client, db_session, monkeypatch):
        monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", "true")
        _seed_tenant_and_admin(db_session)
        resp = client.post("/api/webhooks", json={"url": "http://169.254.169.254/", "event_types": ["*"]})
        assert resp.status_code == 422

    def test_public_https_url_still_accepted_without_dns(self, client, db_session, production, monkeypatch):
        def boom(*a, **kw):
            raise AssertionError("registration must not need DNS")
        monkeypatch.setattr(netguard.socket, "getaddrinfo", boom)
        _seed_tenant_and_admin(db_session)
        resp = client.post("/api/webhooks", json={"url": "https://example.com/hook", "event_types": ["*"]})
        assert resp.status_code == 201, resp.text

    def test_patching_the_url_to_an_internal_one_is_rejected(self, client, db_session, production):
        _seed_tenant_and_admin(db_session)
        wid = client.post("/api/webhooks", json={"url": "https://example.com/hook", "event_types": ["*"]}).json()["id"]
        resp = client.patch(f"/api/webhooks/{wid}", json={"url": "http://192.168.1.10/x"})
        assert resp.status_code == 422


class TestWebhookDelivery:
    def _webhook(self, db, url):
        _seed_tenant_and_admin(db)
        wh = models.Webhook(tenant_id=TENANT_A, user_id=1, url=url, event_types=["*"], secret="whsec_x", active=True)
        db.add(wh)
        db.commit()
        return wh

    def _run(self, monkeypatch, db, wh_id):
        import backend.database as database
        monkeypatch.setattr(database, "SessionLocal", lambda: db)
        return tasks_module.deliver_webhook(wh_id, "test.event", {"a": 1})

    def test_name_resolving_to_internal_address_is_not_contacted(self, db_session, production, monkeypatch):
        wh = self._webhook(db_session, "https://rebind.example.com/hook")
        _resolves_to(monkeypatch, "169.254.169.254")
        import httpx

        def must_not_post(*a, **kw):
            raise AssertionError("must not contact an internal address")
        monkeypatch.setattr(httpx, "post", must_not_post)

        wh_id = wh.id
        result = self._run(monkeypatch, db_session, wh_id)
        assert result["status"] == "blocked"
        # the task closes its session, so read the row back instead of refreshing
        row = db_session.get(models.Webhook, wh_id)
        assert row.failure_count == 1
        assert row.last_error.startswith("blocked:")

    def test_public_destination_is_delivered_without_following_redirects(self, db_session, production, monkeypatch):
        wh = self._webhook(db_session, "https://hooks.example.com/hook")
        _resolves_to(monkeypatch, "93.184.216.34")
        import httpx
        seen = {}

        class Resp:
            status_code = 200
            is_success = True

        def fake_post(url, **kw):
            seen.update(kw, url=url)
            return Resp()
        monkeypatch.setattr(httpx, "post", fake_post)

        result = self._run(monkeypatch, db_session, wh.id)
        assert result["status"] == "delivered"
        assert seen["url"] == "https://hooks.example.com/hook"
        assert seen["follow_redirects"] is False


# ── EV charger endpoints ─────────────────────────────────────────────────────
def _ev_device(db, host="203.0.113.10", **config):
    db.add(models.Tenant(id=TENANT_A, name="A", slug="a", plan="pro", max_sites=20))
    dev = models.Device(
        tenant_id=TENANT_A, name="Wallbox", protocol="modbus_tcp", device_type="ev_charger", enabled=True,
        config={"host": host, **config} if host is not None else dict(config),
    )
    db.add(dev)
    db.commit()
    return dev


@pytest.fixture()
def fake_charger(monkeypatch):
    calls = []

    async def send_command(config, command, value=0.0):
        calls.append(("send_command", command, value, config))
        return {"ok": True, "command": command, "amps": value}

    async def solar_optimise(config, solar_surplus_kw, spot_price_eur):
        calls.append(("solar_optimise", solar_surplus_kw, spot_price_eur))
        return {"action": "holding", "reason": "x", "command_result": {"ok": True}}

    async def poll(config):
        calls.append(("poll",))
        return {"status": "available"}

    monkeypatch.setattr(ev_module.alfen_eve, "send_command", send_command)
    monkeypatch.setattr(ev_module.alfen_eve, "solar_optimise", solar_optimise)
    monkeypatch.setattr(ev_module.alfen_eve, "poll", poll)
    return calls


def _audit_rows(db, action):
    db.expire_all()
    return db.query(models.AuditLog).filter(models.AuditLog.action == action).all()


class TestEvCommandAccess:
    def test_member_cannot_send_commands(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        app.dependency_overrides[get_current_user] = lambda: MEMBER
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "pause"}).status_code == 403
        assert client.post(f"/api/ev/{dev.id}/optimise", json={"solar_surplus_kw": 5, "spot_price_eur": 0.1}).status_code == 403
        assert fake_charger == []  # nothing reached the hardware

    def test_member_can_still_read_status(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        app.dependency_overrides[get_current_user] = lambda: MEMBER
        assert client.get(f"/api/ev/{dev.id}/status").status_code == 200

    def test_admin_command_goes_through_and_is_audited(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        resp = client.post(f"/api/ev/{dev.id}/command", json={"command": "set_current", "value": 12})
        assert resp.status_code == 200, resp.text
        rows = _audit_rows(db_session, "device.command")
        assert len(rows) == 1
        row = rows[0]
        assert row.target_id == dev.id and row.tenant_id == TENANT_A and row.user_email == ADMIN["sub"]
        assert row.details["command"] == "set_current" and row.details["requested_value"] == 12 and row.details["ok"] is True

    def test_failed_command_is_audited_too(self, client, db_session, monkeypatch):
        dev = _ev_device(db_session)

        async def failing(config, command, value=0.0):
            return {"ok": False, "message": "Cannot connect"}
        monkeypatch.setattr(ev_module.alfen_eve, "send_command", failing)
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "pause"}).status_code == 503
        rows = _audit_rows(db_session, "device.command")
        assert len(rows) == 1 and rows[0].details["ok"] is False

    def test_optimise_is_audited(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        resp = client.post(f"/api/ev/{dev.id}/optimise", json={"solar_surplus_kw": 4.5, "spot_price_eur": -0.02})
        assert resp.status_code == 200, resp.text  # negative prices are real market prices
        assert len(_audit_rows(db_session, "device.optimise")) == 1

    def test_other_tenants_charger_is_404(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        app.dependency_overrides[get_current_user] = lambda: {"sub": "x@b.com", "tenant_id": 2, "role": "TENANT_ADMIN"}
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "pause"}).status_code == 404
        assert fake_charger == []


class TestEvCommandValidation:
    @pytest.mark.parametrize("value", [-1, 33, 1000, "NaN", "Infinity"])
    def test_out_of_range_or_non_finite_current_is_422(self, client, db_session, fake_charger, value):
        dev = _ev_device(db_session)
        body = '{"command": "set_current", "value": %s}' % (value if isinstance(value, int) else f'"{value}"')
        resp = client.post(f"/api/ev/{dev.id}/command", content=body, headers={"Content-Type": "application/json"})
        assert resp.status_code == 422
        assert fake_charger == []

    def test_non_finite_optimiser_inputs_are_422(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        resp = client.post(f"/api/ev/{dev.id}/optimise", content='{"solar_surplus_kw": "NaN", "spot_price_eur": 0.1}',
                           headers={"Content-Type": "application/json"})
        assert resp.status_code == 422

    def test_set_current_requires_a_value(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "set_current"}).status_code == 422

    def test_zero_amps_is_a_valid_value(self, client, db_session, fake_charger):
        dev = _ev_device(db_session)
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "set_current", "value": 0}).status_code == 200


class TestEvHost:
    def test_command_without_host_is_400_not_a_hard_coded_default(self, client, db_session, fake_charger):
        dev = _ev_device(db_session, host=None)
        resp = client.post(f"/api/ev/{dev.id}/command", json={"command": "pause"})
        assert resp.status_code == 400
        assert fake_charger == []

    @pytest.mark.parametrize("path,body", [
        ("command", {"command": "pause"}),
        ("optimise", {"solar_surplus_kw": 5, "spot_price_eur": 0.1}),
    ])
    @pytest.mark.parametrize("host", ["169.254.169.254", "127.0.0.1", "10.0.0.8", "192.168.1.65", "localhost"])
    def test_internal_host_blocked_in_production(self, client, db_session, fake_charger, production, path, body, host):
        dev = _ev_device(db_session, host=host)
        resp = client.post(f"/api/ev/{dev.id}/{path}", json=body)
        assert resp.status_code == 400, resp.text
        assert fake_charger == []

    def test_status_also_blocks_internal_hosts(self, client, db_session, fake_charger, production):
        dev = _ev_device(db_session, host="10.0.0.8")
        assert client.get(f"/api/ev/{dev.id}/status").status_code == 400
        assert fake_charger == []

    def test_lan_host_allowed_when_private_destinations_enabled(self, client, db_session, fake_charger, monkeypatch):
        monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", "true")
        dev = _ev_device(db_session, host="192.168.1.65")
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "pause"}).status_code == 200

    def test_metadata_host_never_allowed(self, client, db_session, fake_charger, monkeypatch):
        monkeypatch.setenv("ALLOW_PRIVATE_DESTINATIONS", "true")
        dev = _ev_device(db_session, host="169.254.169.254")
        assert client.post(f"/api/ev/{dev.id}/command", json={"command": "pause"}).status_code == 400


# ── Connector: hard current ceiling ─────────────────────────────────────────
class TestAlfenHardCeiling:
    @pytest.fixture()
    def writes(self, monkeypatch):
        written = []

        class FakeClient:
            def __init__(self, *a, **kw):
                pass

            async def connect(self):
                return True

            async def write_holding(self, register, value):
                written.append((register, value))
                return True

            def close(self):
                pass

        monkeypatch.setattr(alfen_eve, "AlfenModbusClient", FakeClient)
        return written

    def test_config_cannot_raise_the_limit_above_the_hard_max(self, writes):
        result = asyncio.run(alfen_eve.send_command({"host": "h", "max_amps": 63}, "set_current", 32))
        assert result["amps"] == alfen_eve.HARD_MAX_AMPS == 32.0
        assert writes[-1][1] == 320

    def test_requested_value_is_clamped_to_the_configured_max(self, writes):
        result = asyncio.run(alfen_eve.send_command({"host": "h", "max_amps": 10}, "set_current", 25))
        assert result["amps"] == 10.0

    def test_requested_value_is_clamped_to_the_minimum(self, writes):
        result = asyncio.run(alfen_eve.send_command({"host": "h", "min_amps": 6}, "set_current", 1))
        assert result["amps"] == 6.0

    @pytest.mark.parametrize("config", [
        {"max_amps": "abc"}, {"max_amps": None}, {"max_amps": float("nan")}, {"max_amps": float("inf")}, {"max_amps": -5},
    ])
    def test_garbage_config_falls_back_to_safe_limits(self, writes, config):
        min_a, max_a = alfen_eve._amps_limits(config)
        assert 0 <= min_a <= max_a <= alfen_eve.HARD_MAX_AMPS
        assert math.isfinite(min_a) and math.isfinite(max_a)

    def test_min_can_never_exceed_max(self):
        assert alfen_eve._amps_limits({"min_amps": 20, "max_amps": 10}) == (10.0, 10.0)

    def test_non_finite_value_is_refused_before_any_write(self, writes):
        result = asyncio.run(alfen_eve.send_command({"host": "h"}, "set_current", float("nan")))
        assert result["ok"] is False
        assert writes == []

    def test_solar_optimiser_respects_the_hard_ceiling(self, writes):
        result = asyncio.run(alfen_eve.solar_optimise({"host": "h", "max_amps": 100, "phases": 3}, solar_surplus_kw=50, spot_price_eur=0.5))
        amps = [w[1] for w in writes if w[0] == alfen_eve.R.MAX_CURRENT]
        assert amps and max(amps) <= int(alfen_eve.HARD_MAX_AMPS * 10)
        assert result["action"] == "solar_charging"


# ── Device connection test ───────────────────────────────────────────────────
def _device(db, protocol, **config):
    db.add(models.Tenant(id=TENANT_A, name="A", slug="a", plan="pro", max_sites=20))
    dev = models.Device(tenant_id=TENANT_A, name="D", protocol=protocol, device_type="inverter", enabled=True, config=config)
    db.add(dev)
    db.commit()
    return dev


class TestDeviceConnectionTest:
    @pytest.mark.parametrize("protocol,config", [
        ("modbus_tcp", {"host": "169.254.169.254", "port": 80}),
        ("modbus_tcp", {"host": "127.0.0.1", "port": 6379}),
        ("modbus_tcp", {"host": "10.0.0.7"}),
        ("fronius", {"host": "10.0.0.7"}),
        ("fronius", {"host": "169.254.169.254/latest/meta-data/#"}),
        ("sma", {"host": "localhost:5432"}),
        ("opcua", {"url": "opc.tcp://10.0.0.7:4840"}),
        ("opcua", {"url": "http://169.254.169.254/"}),
    ])
    def test_internal_targets_are_refused_and_never_contacted(self, client, db_session, production, monkeypatch, protocol, config):
        dev = _device(db_session, protocol, **config)

        def must_not_connect(*a, **kw):
            raise AssertionError("must not open a connection to an internal destination")
        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", must_not_connect)
        from pymodbus.client import AsyncModbusTcpClient
        monkeypatch.setattr(AsyncModbusTcpClient, "connect", must_not_connect)

        resp = client.post(f"/api/devices/{dev.id}/test")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["ok"] is False
        assert "não permitido" in body["message"].lower() or "inválido" in body["message"].lower() or "esquema" in body["message"].lower(), body

    def test_solaredge_site_id_must_be_numeric(self, client, db_session):
        dev = _device(db_session, "solaredge", api_key="k", site_id="../../admin")
        body = client.post(f"/api/devices/{dev.id}/test").json()
        assert body["ok"] is False and "numeric" in body["message"]

    @pytest.mark.parametrize("port", ["/etc/passwd", "/dev/../etc/shadow", "/proc/self/environ", "relative", "/dev/sda1; rm"])
    def test_serial_port_must_be_a_real_serial_device(self, client, db_session, port):
        dev = _device(db_session, "modbus_rtu", port=port)
        body = client.post(f"/api/devices/{dev.id}/test").json()
        assert body["ok"] is False and body["message"] == "Invalid serial port"

    def test_legitimate_serial_port_names_pass_the_whitelist(self):
        import re
        pattern = r"(/dev/(tty|serial/)[A-Za-z0-9_./-]*|COM[0-9]{1,3})"
        for ok in ("/dev/ttyUSB0", "/dev/ttyS1", "/dev/serial/by-id/usb-FTDI_x-if00-port0", "COM3"):
            assert re.fullmatch(pattern, ok)
