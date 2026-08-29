"""Tests for DeviceOut config sanitization via _sanitize_config."""
from __future__ import annotations

from datetime import datetime
from backend.models import utcnow_naive

from backend.routers.devices import _sanitize_config, DeviceOut


def _make_device_out(config):
    return DeviceOut(
        id=1,
        name="Test",
        site_id=None,
        protocol="solaredge",
        device_type="inverter",
        config=config,
        enabled=True,
        status="unknown",
        last_seen=None,
        created_at=utcnow_naive(),
    )


def test_non_sensitive_config_preserved():
    cfg = {"host": "192.168.1.10", "port": 502, "node_power": "ns=2;i=1001"}
    out = _make_device_out(cfg)
    assert out.config == cfg


def test_api_key_redacted():
    out = _make_device_out({"api_key": "SECRET"})
    assert out.config["api_key"] == "***"


def test_token_and_access_token_redacted():
    out = _make_device_out({"token": "a", "access_token": "b", "refresh_token": "c"})
    assert out.config["token"] == "***"
    assert out.config["access_token"] == "***"
    assert out.config["refresh_token"] == "***"


def test_password_redacted():
    out = _make_device_out({"password": "hunter2"})
    assert out.config["password"] == "***"


def test_secret_and_client_secret_redacted():
    out = _make_device_out({"secret": "s", "client_secret": "cs"})
    assert out.config["secret"] == "***"
    assert out.config["client_secret"] == "***"


def test_authorization_bearer_credentials_redacted():
    out = _make_device_out({"authorization": "a", "bearer": "b", "credentials": "c"})
    assert out.config["authorization"] == "***"
    assert out.config["bearer"] == "***"
    assert out.config["credentials"] == "***"


def test_keys_case_insensitive():
    out = _make_device_out({"Api_Key": "x", "PASSWORD": "y", "Access_Token": "z"})
    assert out.config["Api_Key"] == "***"
    assert out.config["PASSWORD"] == "***"
    assert out.config["Access_Token"] == "***"


def test_nested_dicts_sanitized():
    out = _make_device_out({"mqtt": {"username": "u", "password": "p", "host": "h"}})
    assert out.config["mqtt"]["host"] == "h"
    assert out.config["mqtt"]["password"] == "***"


def test_lists_of_dicts_sanitized():
    out = _make_device_out({"channels": [{"name": "a", "token": "x"}, {"name": "b"}]})
    assert out.config["channels"][0]["name"] == "a"
    assert out.config["channels"][0]["token"] == "***"
    assert out.config["channels"][1]["name"] == "b"


def test_original_config_not_mutated():
    cfg = {"api_key": "SECRET", "nested": {"password": "p"}, "list": [{"token": "t"}]}
    _sanitize_config(cfg)
    assert cfg["api_key"] == "SECRET"
    assert cfg["nested"]["password"] == "p"
    assert cfg["list"][0]["token"] == "t"


def test_generic_username_remains_visible():
    out = _make_device_out({"username": "myuser"})
    assert out.config["username"] == "myuser"


def test_mqtt_username_and_password_redacted():
    out = _make_device_out({"mqtt_username": "u", "mqtt_password": "p"})
    assert out.config["mqtt_username"] == "***"
    assert out.config["mqtt_password"] == "***"