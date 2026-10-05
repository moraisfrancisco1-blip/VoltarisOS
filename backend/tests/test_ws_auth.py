"""WebSocket first-message authentication: the JWT travels in the first frame, not in the URL."""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.websockets import WebSocketDisconnect

from backend import models, ws_auth
from backend.database import Base
from backend.routers import alerts_ws
from backend.security import SECRET_KEY, ALGORITHM


def _token(tenant_id=3):
    return jwt.encode({"sub": "u@x.com", "tenant_id": tenant_id, "role": "TENANT_ADMIN"}, SECRET_KEY, algorithm=ALGORITHM)


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(alerts_ws, "SessionLocal", factory)
    db = factory()
    db.add(models.Alert(tenant_id=3, severity="warning", title="mine", message="m"))
    db.add(models.Alert(tenant_id=4, severity="warning", title="other tenant", message="o"))
    db.commit()
    db.close()
    app = FastAPI()
    app.include_router(alerts_ws.router)
    yield TestClient(app)
    Base.metadata.drop_all(bind=engine)


def _rejected_with_4401(ws):
    with pytest.raises(WebSocketDisconnect) as exc:
        ws.receive_json()
    assert exc.value.code == 4401


def test_first_message_auth_succeeds_and_streams_only_the_tenants_alerts(client):
    with client.websocket_connect("/ws/alerts") as ws:
        ws.send_json({"type": "auth", "token": _token(3)})
        assert ws.receive_json() == {"type": "auth_ok"}
        alert = ws.receive_json()
        assert alert["type"] == "alert" and alert["title"] == "mine"


def test_invalid_token_in_first_message_is_closed_4401(client):
    with client.websocket_connect("/ws/alerts") as ws:
        ws.send_json({"type": "auth", "token": "not-a-jwt"})
        _rejected_with_4401(ws)


def test_first_message_that_is_not_auth_is_closed_4401(client):
    with client.websocket_connect("/ws/alerts") as ws:
        ws.send_json({"type": "pong"})
        _rejected_with_4401(ws)


def test_first_message_that_is_not_json_is_closed_4401(client):
    with client.websocket_connect("/ws/alerts") as ws:
        ws.send_text("hello")
        _rejected_with_4401(ws)


def test_oversized_first_message_is_closed_4401(client):
    with client.websocket_connect("/ws/alerts") as ws:
        ws.send_json({"type": "auth", "token": _token(3), "pad": "x" * (ws_auth.MAX_AUTH_MESSAGE_BYTES + 1)})
        _rejected_with_4401(ws)


def test_silence_is_closed_4401_after_the_timeout(client, monkeypatch):
    monkeypatch.setattr(ws_auth, "AUTH_TIMEOUT_S", 0.2)
    with client.websocket_connect("/ws/alerts") as ws:
        _rejected_with_4401(ws)


def test_legacy_query_token_still_works(client):
    with client.websocket_connect(f"/ws/alerts?token={_token(3)}") as ws:
        assert ws.receive_json()["title"] == "mine"  # no auth_ok on the legacy path


def test_legacy_query_token_invalid_is_rejected(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws/alerts?token=bad") as ws:
            ws.receive_json()
    assert exc.value.code == 4401
