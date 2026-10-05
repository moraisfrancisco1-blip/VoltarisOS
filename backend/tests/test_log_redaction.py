"""Session tokens in the URL must never reach the logs."""
from __future__ import annotations

import io
import logging

import pytest

from backend import log_redaction

JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signature_part-123"


@pytest.mark.parametrize("text,expected", [
    (f"/ws/alerts?token={JWT}", "/ws/alerts?token=REDACTED"),
    (f"/ws/alerts?x=1&token={JWT}&y=2", "/ws/alerts?x=1&token=REDACTED&y=2"),   # other params kept
    (f"/a?TOKEN={JWT}", "/a?TOKEN=REDACTED"),                                    # case-insensitive
    (f"/a?access_token={JWT}", "/a?access_token=REDACTED"),
    (f'GET /a?api_key=abc123 HTTP/1.1', "GET /a?api_key=REDACTED HTTP/1.1"),
    ("/api/sites?limit=50&page=2", "/api/sites?limit=50&page=2"),                 # nothing sensitive: unchanged
    ("/ws/alerts", "/ws/alerts"),
    ("token=notinaquery", "token=notinaquery"),                                   # not a query parameter
])
def test_redact(text, expected):
    assert log_redaction.redact(text) == expected


def _restore(logger, handler):
    logger.removeHandler(handler)
    logger.propagate = True
    logger.setLevel(logging.NOTSET)


def _logger_with_filter(name):
    logger = logging.getLogger(name)
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger, handler, stream


@pytest.fixture()
def installed():
    log_redaction.install_uvicorn_redaction()
    yield
    for name in log_redaction._UVICORN_LOGGERS:
        logger = logging.getLogger(name)
        logger.filters = [f for f in logger.filters if not isinstance(f, log_redaction.RedactQueryTokens)]


def test_uvicorn_websocket_and_access_lines_are_redacted(installed):
    for name, fmt, args in (
        ("uvicorn.error", '%s - "WebSocket %s" 403', ("100.64.0.2:1", f"/ws/alerts?token={JWT}")),
        ("uvicorn.access", '%s - "%s %s HTTP/%s" %d', ("100.64.0.2:1", "GET", f"/x?token={JWT}", "1.1", 200)),
    ):
        logger, handler, stream = _logger_with_filter(name)
        try:
            logger.info(fmt, *args)
        finally:
            _restore(logger, handler)
        out = stream.getvalue()
        assert JWT not in out and "token=REDACTED" in out, out


def test_lines_without_secrets_are_left_alone(installed):
    logger, handler, stream = _logger_with_filter("uvicorn.access")
    try:
        logger.info('%s - "%s %s HTTP/%s" %d', "1.2.3.4:5", "GET", "/api/sites?limit=5", "1.1", 200)
    finally:
        _restore(logger, handler)
    assert stream.getvalue().strip() == '1.2.3.4:5 - "GET /api/sites?limit=5 HTTP/1.1" 200'


def test_install_is_idempotent(installed):
    log_redaction.install_uvicorn_redaction()
    log_redaction.install_uvicorn_redaction()
    for name in log_redaction._UVICORN_LOGGERS:
        count = sum(isinstance(f, log_redaction.RedactQueryTokens) for f in logging.getLogger(name).filters)
        assert count == 1


def test_a_malformed_record_does_not_break_logging(installed):
    record = logging.LogRecord("uvicorn.error", logging.INFO, __file__, 1, "%s %s", ("only-one",), None)
    assert log_redaction.RedactQueryTokens().filter(record) is True  # getMessage() raises; the filter must not
