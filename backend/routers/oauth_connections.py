"""
oauth_connections.py — Settings > Connected Apps (Google Workspace,
Microsoft 365, Slack). Standard OAuth2 authorization-code flow, one
tenant-wide connection per provider.

Every provider needs its own app registered by a human with that provider
(client_id/secret set as this instance's env vars) -- something Claude
cannot do on anyone's behalf. Until a provider's credentials are configured,
its /start endpoint returns 503 rather than a fake success.

    GET    /api/oauth/status              — Per-provider configured/connected state
    POST   /api/oauth/{provider}/start    — Auth'd; returns the provider's authorize_url
    GET    /api/oauth/{provider}/callback — PUBLIC; the provider redirects the browser here
    DELETE /api/oauth/{provider}          — Disconnect

Redirect URI to register with each provider (exact match required):
    {OAUTH_REDIRECT_BASE_URL}/api/oauth/{provider}/callback
"""
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt as jose_jwt
from pydantic import BaseModel

from backend.config import settings
from backend.database import SessionLocal
from backend.security import require_admin, SECRET_KEY, ALGORITHM
from backend.models import utcnow_naive
from backend import models
from backend.audit import log_audit_event

router = APIRouter(prefix="/api/oauth", tags=["oauth"])

STATE_TTL_MINUTES = 10
STATE_PURPOSE = "oauth_connect"

PROVIDER_META = {
    "google": {
        "label": "Google Workspace",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "userinfo_label_field": "email",
        "scope": "openid email profile",
        "extra_authorize_params": {"access_type": "offline", "prompt": "consent"},
    },
    "microsoft": {
        "label": "Microsoft 365",
        "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "userinfo_label_field": "userPrincipalName",
        "scope": "openid email profile offline_access",
        "extra_authorize_params": {},
    },
    "slack": {
        "label": "Slack",
        "authorize_url": "https://slack.com/oauth/v2/authorize",
        "token_url": "https://slack.com/api/oauth.v2.access",
        "userinfo_url": None,  # label comes from the token response itself (team.name)
        "userinfo_label_field": None,
        "scope": "channels:read,chat:write",
        "extra_authorize_params": {},
    },
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _client_id(provider: str) -> str:
    return getattr(settings, f"{provider.upper()}_OAUTH_CLIENT_ID", "")


def _client_secret(provider: str) -> str:
    return getattr(settings, f"{provider.upper()}_OAUTH_CLIENT_SECRET", "")


def _is_configured(provider: str) -> bool:
    return bool(_client_id(provider) and _client_secret(provider))


def _redirect_uri(provider: str) -> str:
    return f"{settings.OAUTH_REDIRECT_BASE_URL}/api/oauth/{provider}/callback"


def _require_known_provider(provider: str) -> dict:
    meta = PROVIDER_META.get(provider)
    if not meta:
        raise HTTPException(404, f"Fornecedor desconhecido: {provider}")
    return meta


def _make_state(tenant_id: int, email: str, provider: str) -> str:
    return jose_jwt.encode(
        {
            "purpose": STATE_PURPOSE,
            "tenant_id": tenant_id,
            "email": email,
            "provider": provider,
            "exp": datetime.utcnow() + timedelta(minutes=STATE_TTL_MINUTES),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _decode_state(state: str, expected_provider: str) -> dict:
    try:
        payload = jose_jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(400, "State inválido ou expirado")
    if payload.get("purpose") != STATE_PURPOSE or payload.get("provider") != expected_provider:
        raise HTTPException(400, "State inválido")
    return payload


class StartResponse(BaseModel):
    authorize_url: str


class ProviderStatus(BaseModel):
    provider: str
    label: str
    configured: bool
    connected: bool
    account_label: str | None = None
    connected_at: datetime | None = None


@router.get("/status", response_model=list[ProviderStatus])
def oauth_status(db=Depends(get_db), user: dict = Depends(require_admin)):
    tenant_id = user.get("tenant_id")
    connections = {
        c.provider: c
        for c in db.query(models.OAuthConnection).filter(models.OAuthConnection.tenant_id == tenant_id).all()
    }
    out = []
    for provider, meta in PROVIDER_META.items():
        conn = connections.get(provider)
        out.append(ProviderStatus(
            provider=provider,
            label=meta["label"],
            configured=_is_configured(provider),
            connected=conn is not None,
            account_label=conn.account_label if conn else None,
            connected_at=conn.connected_at if conn else None,
        ))
    return out


@router.post("/{provider}/start", response_model=StartResponse)
def oauth_start(provider: str, user: dict = Depends(require_admin)):
    meta = _require_known_provider(provider)
    if not _is_configured(provider):
        raise HTTPException(503, f"{meta['label']} não está configurado nesta instância")

    state = _make_state(user.get("tenant_id"), user.get("sub"), provider)
    params = {
        "client_id": _client_id(provider),
        "redirect_uri": _redirect_uri(provider),
        "scope": meta["scope"],
        "state": state,
        "response_type": "code",
        **meta["extra_authorize_params"],
    }
    return StartResponse(authorize_url=f"{meta['authorize_url']}?{urlencode(params)}")


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db=Depends(get_db),
):
    """PUBLIC — the provider redirects the user's browser here with no
    Authorization header. `state` (minted by /start, signed, short-lived)
    is the only thing proving which tenant/user initiated this."""
    meta = _require_known_provider(provider)
    base = settings.OAUTH_REDIRECT_BASE_URL

    if error or not code or not state:
        return RedirectResponse(f"{base}/?oauth=error&provider={provider}")

    payload = _decode_state(state, provider)
    tenant_id = payload["tenant_id"]

    try:
        token_resp = httpx.post(
            meta["token_url"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(provider),
                "client_id": _client_id(provider),
                "client_secret": _client_secret(provider),
            },
            headers={"Accept": "application/json"},
            timeout=15.0,
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not token_resp.is_success or not access_token:
            return RedirectResponse(f"{base}/?oauth=error&provider={provider}")

        account_label = None
        if provider == "slack":
            account_label = (token_data.get("team") or {}).get("name")
        elif meta["userinfo_url"]:
            try:
                info_resp = httpx.get(
                    meta["userinfo_url"],
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0,
                )
                if info_resp.is_success:
                    account_label = info_resp.json().get(meta["userinfo_label_field"])
            except httpx.RequestError:
                pass

        expires_in = token_data.get("expires_in")
        expires_at = utcnow_naive() + timedelta(seconds=expires_in) if expires_in else None

        existing = db.query(models.OAuthConnection).filter(
            models.OAuthConnection.tenant_id == tenant_id,
            models.OAuthConnection.provider == provider,
        ).first()
        if existing:
            db.delete(existing)
            db.flush()

        user_row = db.query(models.User).filter(models.User.email == payload["email"]).first()
        db.add(models.OAuthConnection(
            tenant_id=tenant_id,
            user_id=user_row.id if user_row else None,
            provider=provider,
            access_token=access_token,
            refresh_token=token_data.get("refresh_token"),
            expires_at=expires_at,
            scope=token_data.get("scope") or meta["scope"],
            account_label=account_label,
        ))
        db.commit()

        log_audit_event(
            db=db, action="oauth.connected", tenant_id=tenant_id,
            user_id=user_row.id if user_row else None, user_email=payload["email"],
            target_resource="oauth_connection", ip_address=request.client.host if request.client else None,
            details={"provider": provider},
        )
        return RedirectResponse(f"{base}/?oauth=success&provider={provider}")
    except httpx.RequestError:
        return RedirectResponse(f"{base}/?oauth=error&provider={provider}")


@router.delete("/{provider}", status_code=204)
def oauth_disconnect(
    provider: str,
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(require_admin),
):
    _require_known_provider(provider)
    conn = db.query(models.OAuthConnection).filter(
        models.OAuthConnection.tenant_id == user.get("tenant_id"),
        models.OAuthConnection.provider == provider,
    ).first()
    if not conn:
        return
    db.delete(conn)
    db.commit()

    log_audit_event(
        db=db, action="oauth.disconnected", tenant_id=user.get("tenant_id"),
        user_email=user.get("sub"), target_resource="oauth_connection",
        ip_address=request.client.host if request.client else None,
        details={"provider": provider},
    )
