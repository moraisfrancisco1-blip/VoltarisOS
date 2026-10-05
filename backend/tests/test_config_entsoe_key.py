"""One ENTSO-E key, two historical variable names: either must configure the market client."""
import pytest

from backend.config import entsoe_api_key


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("ENTSOE_API_KEY", raising=False)
    monkeypatch.delenv("ENTSOE_TOKEN", raising=False)


def test_empty_when_neither_is_set():
    assert entsoe_api_key() == ""


def test_the_token_name_used_by_the_prices_endpoint_is_accepted(monkeypatch):
    monkeypatch.setenv("ENTSOE_TOKEN", "from-token")
    assert entsoe_api_key() == "from-token"


def test_the_api_key_name_is_accepted(monkeypatch):
    monkeypatch.setenv("ENTSOE_API_KEY", "from-key")
    assert entsoe_api_key() == "from-key"


def test_api_key_wins_when_both_are_set(monkeypatch):
    monkeypatch.setenv("ENTSOE_API_KEY", "from-key")
    monkeypatch.setenv("ENTSOE_TOKEN", "from-token")
    assert entsoe_api_key() == "from-key"
