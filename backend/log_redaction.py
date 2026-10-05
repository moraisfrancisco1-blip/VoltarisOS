"""Keep secrets out of the server logs.

The browser authenticates its WebSocket with `?token=<jwt>` in the URL, and uvicorn writes the
request line to the log, so a live session token ended up in plain text in the platform logs
(readable by anyone with access to the project) every time the socket connected or was rejected.
This filter replaces the VALUE of such query parameters with REDACTED before the line is emitted.
Moving the token out of the URL altogether is the proper fix; until then, never log it.
"""
from __future__ import annotations

import logging
import re

_SENSITIVE_QUERY_VALUE = re.compile(
    r"([?&](?:token|access_token|id_token|refresh_token|auth|authorization|api_key|apikey|key|secret|password)=)[^&\s\"']+",
    re.IGNORECASE,
)

# uvicorn writes request lines through these two loggers (HTTP access lines and WebSocket lines).
_UVICORN_LOGGERS = ("uvicorn.access", "uvicorn.error")


def redact(text: str) -> str:
    return _SENSITIVE_QUERY_VALUE.sub(r"\1REDACTED", text)


class RedactQueryTokens(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True  # a malformed record is not ours to fix; let it through unchanged
        redacted = redact(message)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def install_uvicorn_redaction() -> None:
    """Attach the filter to uvicorn's loggers once (safe to call repeatedly)."""
    for name in _UVICORN_LOGGERS:
        logger = logging.getLogger(name)
        if not any(isinstance(f, RedactQueryTokens) for f in logger.filters):
            logger.addFilter(RedactQueryTokens())
