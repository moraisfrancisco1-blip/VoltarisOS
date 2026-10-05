"""WebSocket authentication that keeps the JWT out of the URL.

A token in `?token=` ends up in uvicorn's access log (and in proxy logs and browser history).
The preferred handshake is therefore: connect without a token, then send ONE first message
    {"type": "auth", "token": "<jwt>"}
within AUTH_TIMEOUT_S. The server answers {"type": "auth_ok"} or closes with 4401.

The legacy `?token=` form is still honoured so tabs and mobile builds that are already open keep
working; it is deprecated and its value is redacted from the logs (backend/log_redaction.py)."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from backend.security import decode_token

logger = logging.getLogger(__name__)

AUTH_TIMEOUT_S = 10.0
MAX_AUTH_MESSAGE_BYTES = 8192  # a JWT is ~500 bytes; anything much bigger is not a login
CLOSE_UNAUTHORIZED = 4401


def _decode(token) -> Optional[dict]:
    if not token or not isinstance(token, str):
        return None
    try:
        data = decode_token(token)
    except Exception:
        return None
    return data if isinstance(data, dict) else None


async def authenticate(ws: WebSocket, query_token: str = "", timeout: Optional[float] = None) -> Optional[dict]:
    """Returns the decoded JWT payload and leaves `ws` accepted, or closes it with 4401 and
    returns None. Never raises for bad input."""
    if query_token:  # deprecated path: the token is already in the URL, nothing to wait for
        data = _decode(query_token)
        if data is None:
            await ws.close(code=CLOSE_UNAUTHORIZED)
            return None
        await ws.accept()
        return data

    await ws.accept()
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_S if timeout is None else timeout)
    except Exception:  # timeout, client went away, or a binary frame
        await _close(ws)
        return None
    data = None
    if len(raw) <= MAX_AUTH_MESSAGE_BYTES:
        try:
            message = json.loads(raw)
        except ValueError:
            message = None
        if isinstance(message, dict) and message.get("type") == "auth":
            data = _decode(message.get("token"))
    if data is None:
        await _close(ws)
        return None
    await ws.send_json({"type": "auth_ok"})
    return data


async def _close(ws: WebSocket) -> None:
    if ws.application_state == WebSocketState.CONNECTED:
        try:
            await ws.close(code=CLOSE_UNAUTHORIZED)
        except Exception:
            pass
