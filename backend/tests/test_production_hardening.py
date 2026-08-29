"""Production hardening tests: startup config guards and honest health reporting.

Covers:
- startup_config_errors: SQLite-in-production / RUN_CELERY-without-REDIS are fatal;
  missing GATEWAY_API_KEYS warns; development is clean.
- /health/detailed: Redis never reported healthy when not configured/unavailable.
- CacheManager.is_connected reflects the real backend state.
"""
from fastapi.testclient import TestClient
import pytest

import backend.main as main
import backend.cache as backend_cache
from backend.cache import CacheManager, InMemoryCache
from backend.startup import startup_config_errors


# ── Startup config guards ────────────────────────────────────────────────────
def test_startup_guards_development_is_clean(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    fatal, warnings = startup_config_errors("development")
    assert fatal == []
    assert warnings == []


def test_startup_guard_sqlite_in_production_fatal(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./voltaris.db")
    monkeypatch.setenv("RUN_CELERY", "0")
    monkeypatch.setenv("GATEWAY_API_KEYS", "{}")
    fatal, _ = startup_config_errors("production")
    assert any("SQLite" in e for e in fatal)


def test_startup_guard_celery_without_redis_fatal(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@host/db")
    monkeypatch.setenv("RUN_CELERY", "1")
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv("GATEWAY_API_KEYS", "{}")
    fatal, _ = startup_config_errors("production")
    assert any("REDIS_URL" in e for e in fatal)


def test_startup_guard_missing_gateway_keys_warns(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@host/db")
    monkeypatch.setenv("RUN_CELERY", "0")
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("GATEWAY_API_KEYS", raising=False)
    fatal, warnings = startup_config_errors("production")
    assert fatal == []
    assert any("GATEWAY_API_KEYS" in w for w in warnings)


def test_startup_guard_production_clean_config(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@host/db")
    monkeypatch.setenv("REDIS_URL", "redis://host:6379/0")
    monkeypatch.setenv("RUN_CELERY", "1")
    monkeypatch.setenv("GATEWAY_API_KEYS", "{}")
    fatal, warnings = startup_config_errors("production")
    assert fatal == []
    assert warnings == []


# ── CacheManager.is_connected ────────────────────────────────────────────────
def test_cache_manager_is_connected_reflects_backend():
    cm = CacheManager()
    cm._cache = InMemoryCache()
    assert cm.is_connected is False

    class _R:
        is_connected = True
    cm._cache = _R()
    assert cm.is_connected is True


# ── /health/detailed Redis honesty ───────────────────────────────────────────
def test_health_detailed_redis_not_configured(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("RUN_CELERY", raising=False)
    monkeypatch.setattr(backend_cache, "cache", type("_F", (), {})())
    body = TestClient(main.app).get("/health/detailed").json()
    assert body["components"]["redis"]["status"] == "not_configured"


def test_health_detailed_redis_unavailable_degraded(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:9999/0")
    monkeypatch.delenv("RUN_CELERY", raising=False)
    monkeypatch.setattr(backend_cache, "cache", type("_F", (), {"is_connected": False})())
    r = TestClient(main.app).get("/health/detailed")
    body = r.json()
    assert body["components"]["redis"]["status"] == "unavailable"
    assert body["status"] == "degraded"


def test_health_detailed_redis_healthy(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.delenv("RUN_CELERY", raising=False)
    monkeypatch.setattr(backend_cache, "cache", type("_F", (), {"is_connected": True})())
    body = TestClient(main.app).get("/health/detailed").json()
    assert body["components"]["redis"]["status"] == "healthy"
