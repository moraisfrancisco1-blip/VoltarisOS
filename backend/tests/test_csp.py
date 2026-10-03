"""The CSP keeps scripts to our own origin (XSS containment for a token held in
localStorage) and stays usable: WebSockets only to the page's host, API docs
still work, and a rollback lever exists."""
import pytest
from fastapi.testclient import TestClient

from backend import csp
from backend.main import app


def directive(policy: str, name: str) -> str:
    for part in policy.split(";"):
        part = part.strip()
        if part.startswith(name + " ") or part == name:
            return part
    raise AssertionError(f"{name} missing from {policy}")


def test_scripts_may_only_come_from_our_own_origin():
    script = directive(csp.build_csp("app.example.com"), "script-src")
    assert script == "script-src 'self'"  # no unsafe-inline, no unsafe-eval, no hosts


def test_websockets_are_limited_to_the_page_host_not_wss_everywhere():
    connect = directive(csp.build_csp("app.example.com", secure=True), "connect-src")
    tokens = connect.split()
    assert "wss://app.example.com" in tokens and "wss:" not in tokens
    assert not any(t.startswith("ws://") for t in tokens)


def test_plain_ws_only_outside_production():
    assert "ws://localhost:8000" in csp.build_csp("localhost:8000")
    assert "ws://localhost:8000" not in csp.build_csp("localhost:8000", secure=True)


@pytest.mark.parametrize("bad", ["evil.com; script-src *", "a b", "x\r\nSet-Cookie: a=b", "https://x"])
def test_an_unvalidated_host_header_never_reaches_the_policy(bad):
    policy = csp.build_csp(bad)
    assert bad not in policy and "script-src 'self'" in policy


def test_clickjacking_framing_and_plugins_are_blocked():
    policy = csp.build_csp("h")
    for want in ("frame-ancestors 'none'", "frame-src 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"):
        assert want in policy


def test_upgrade_insecure_requests_only_in_production():
    assert "upgrade-insecure-requests" in csp.build_csp("h", secure=True)
    assert "upgrade-insecure-requests" not in csp.build_csp("h")


def test_api_docs_get_their_own_looser_policy_and_nothing_else_does():
    docs = directive(csp.build_csp("h", api_docs=True), "script-src")
    assert "cdn.jsdelivr.net" in docs
    assert csp.is_api_docs("/docs") and csp.is_api_docs("/redoc") and not csp.is_api_docs("/api/docs-export")
    assert "unsafe-eval" not in csp.build_csp("h", api_docs=True)


class TestHeaderOnTheWire:
    def test_every_response_carries_the_strict_policy(self):
        with TestClient(app) as c:
            r = c.get("/health")
        policy = r.headers["content-security-policy"]
        assert directive(policy, "script-src") == "script-src 'self'"
        assert "content-security-policy-report-only" not in r.headers

    def test_report_only_lever_switches_the_header_name(self, monkeypatch):
        monkeypatch.setenv("CSP_REPORT_ONLY", "true")
        with TestClient(app) as c:
            r = c.get("/health")
        assert "content-security-policy-report-only" in r.headers
        assert "content-security-policy" not in r.headers
