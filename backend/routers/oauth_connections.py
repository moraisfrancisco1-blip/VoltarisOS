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

import logging

logger = logging.getLogger(__name__)

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
    "solaredge": {
        # URLs/scope are filled from settings at call time (see _require_known_provider)
        "label": "SolarEdge",
        "authorize_url": "",
        "token_url": "",
        "userinfo_url": None,
        "userinfo_label_field": None,
        "scope": "",
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


def _resolved_meta(provider: str) -> dict | None:
    meta = PROVIDER_META.get(provider)
    if meta and provider == "solaredge":
        meta = {
            **meta,
            "authorize_url": settings.SOLAREDGE_AUTHORIZE_URL,
            "token_url": settings.SOLAREDGE_TOKEN_URL,
            "scope": settings.SOLAREDGE_SCOPES,
        }
    return meta


def _is_configured(provider: str) -> bool:
    meta = _resolved_meta(provider) or {}
    return bool(
        _client_id(provider) and _client_secret(provider)
        and meta.get("authorize_url") and meta.get("token_url")
    )


def _redirect_uri(provider: str) -> str:
    if provider == "solaredge":
        # Registered in the SolarEdge developer console as-is; served by
        # callback_alias_router below.
        return settings.SOLAREDGE_REDIRECT_URI
    return f"{settings.OAUTH_REDIRECT_BASE_URL}/api/oauth/{provider}/callback"


def _require_known_provider(provider: str) -> dict:
    meta = _resolved_meta(provider)
    if not meta:
        raise HTTPException(404, f"Fornecedor desconhecido: {provider}")
    return meta


def _post_token(provider: str, data: dict):
    """POST to the provider's token endpoint. Sends the client secret in the
    body (client_secret_post); if the provider answers invalid_client /
    401, retries once with HTTP Basic (client_secret_basic)."""
    meta = _require_known_provider(provider)
    if provider == "solaredge":
        # SolarEdge ONE: JSON body, credentials in the body (docs: Authentication, step 4/6)
        return httpx.post(
            meta["token_url"],
            json={**data, "client_id": _client_id(provider), "client_secret": _client_secret(provider)},
            headers={"Accept": "application/json"},
            timeout=15.0,
        )
    resp = httpx.post(
        meta["token_url"],
        data={**data, "client_id": _client_id(provider), "client_secret": _client_secret(provider)},
        headers={"Accept": "application/json"},
        timeout=15.0,
    )
    if resp.status_code in (400, 401):
        try:
            err = (resp.json() or {}).get("error")
        except Exception:
            err = None
        if resp.status_code == 401 or err == "invalid_client":
            resp = httpx.post(
                meta["token_url"],
                data=data,
                auth=(_client_id(provider), _client_secret(provider)),
                headers={"Accept": "application/json"},
                timeout=15.0,
            )
    return resp


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
    if provider == "solaredge":
        # SolarEdge Connect has no `state`/`redirect_uri` params: the redirect is
        # fixed on the app, and `external_id` is echoed back to the callback --
        # so the signed state travels as external_id.
        params = {"client_id": _client_id(provider), "external_id": state}
        return StartResponse(authorize_url=f"{meta['authorize_url']}?{urlencode(params)}")
    params = {
        "client_id": _client_id(provider),
        "redirect_uri": _redirect_uri(provider),
        "scope": meta["scope"],
        "state": state,
        "response_type": "code",
        **meta["extra_authorize_params"],
    }
    if not params["scope"]:
        del params["scope"]
    return StartResponse(authorize_url=f"{meta['authorize_url']}?{urlencode(params)}")


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    site_id: str | None = None,
    external_id: str | None = None,
    db=Depends(get_db),
):
    """PUBLIC — the provider redirects the user's browser here with no
    Authorization header. `state` (minted by /start, signed, short-lived)
    is the only thing proving which tenant/user initiated this."""
    meta = _require_known_provider(provider)
    base = settings.OAUTH_REDIRECT_BASE_URL
    if provider == "solaredge" and not state:
        state = external_id  # see oauth_start

    if error or not code or not state:
        return RedirectResponse(f"{base}/?oauth=error&provider={provider}")

    payload = _decode_state(state, provider)
    tenant_id = payload["tenant_id"]

    try:
        token_body = {"grant_type": "authorization_code", "code": code}
        if provider != "solaredge":
            token_body["redirect_uri"] = _redirect_uri(provider)
        token_resp = _post_token(provider, token_body)
        try:
            token_data = token_resp.json()
        except ValueError:
            token_data = {}
        access_token = token_data.get("access_token")
        if not token_resp.is_success or not access_token:
            reason = token_data.get("error") or f"http_{token_resp.status_code}"
            logger.warning("OAuth token exchange failed for %s: %s %s", provider, token_resp.status_code, token_data)
            return RedirectResponse(f"{base}/?oauth=error&provider={provider}&reason={reason}")

        account_label = None
        if provider == "solaredge":
            # SolarEdge grants are per site; the callback tells us which one.
            account_label = f"Site {site_id}" if site_id else None
        elif provider == "slack":
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
    if provider == "solaredge" and settings.SOLAREDGE_REVOKE_URL:
        try:
            httpx.post(settings.SOLAREDGE_REVOKE_URL, json={"token": conn.access_token}, timeout=10.0)
        except httpx.RequestError:
            logger.warning("SolarEdge token revoke failed for tenant %s", user.get("tenant_id"))
    db.delete(conn)
    db.commit()

    log_audit_event(
        db=db, action="oauth.disconnected", tenant_id=user.get("tenant_id"),
        user_email=user.get("sub"), target_resource="oauth_connection",
        ip_address=request.client.host if request.client else None,
        details={"provider": provider},
    )


# ── Token refresh + SolarEdge helpers ────────────────────────────────────────

def get_valid_access_token(db, tenant_id: int, provider: str) -> str:
    """Return a usable access token for the tenant's connection, refreshing it
    when it is (about to be) expired. Raises 409 when a reconnect is needed.
    Use this from pollers before every provider API call."""
    conn = db.query(models.OAuthConnection).filter(
        models.OAuthConnection.tenant_id == tenant_id,
        models.OAuthConnection.provider == provider,
    ).first()
    if not conn:
        raise HTTPException(409, f"{provider} não está ligado")

    if not conn.expires_at or conn.expires_at > utcnow_naive() + timedelta(seconds=60):
        return conn.access_token

    if not conn.refresh_token:
        raise HTTPException(409, f"Autorização {provider} expirou — é preciso voltar a ligar")

    try:
        resp = _post_token(provider, {"grant_type": "refresh_token", "refresh_token": conn.refresh_token})
        data = resp.json()
    except (httpx.RequestError, ValueError):
        raise HTTPException(502, f"Falha a renovar o token {provider}")
    if not resp.is_success or not data.get("access_token"):
        logger.warning("OAuth refresh failed for %s tenant %s: %s", provider, tenant_id, data)
        raise HTTPException(409, f"Autorização {provider} expirou — é preciso voltar a ligar")

    conn.access_token = data["access_token"]
    if data.get("refresh_token"):
        conn.refresh_token = data["refresh_token"]
    if data.get("expires_in"):
        conn.expires_at = utcnow_naive() + timedelta(seconds=int(data["expires_in"]))
    db.commit()
    return conn.access_token


def solaredge_site_id(db, tenant_id: int) -> str | None:
    conn = db.query(models.OAuthConnection).filter(
        models.OAuthConnection.tenant_id == tenant_id,
        models.OAuthConnection.provider == "solaredge",
    ).first()
    if conn and conn.account_label and conn.account_label.startswith("Site "):
        return conn.account_label[len("Site "):]
    return None


@router.get("/solaredge/overview")
def solaredge_overview(db=Depends(get_db), user: dict = Depends(require_admin)):
    """Smoke test for the SolarEdge connection: GET /v2/sites/{site_id}/overview
    with the stored (auto-refreshed) bearer token."""
    tenant_id = user.get("tenant_id")
    token = get_valid_access_token(db, tenant_id, "solaredge")
    site_id = solaredge_site_id(db, tenant_id)
    if not site_id:
        raise HTTPException(409, "Site ID da SolarEdge desconhecido — volta a ligar")
    try:
        resp = httpx.get(
            f"{settings.SOLAREDGE_API_BASE.rstrip('/')}/v2/sites/{site_id}/overview",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=20.0,
        )
    except httpx.RequestError as e:
        raise HTTPException(502, f"SolarEdge inacessível: {e}")
    try:
        body = resp.json()
    except ValueError:
        body = {"raw": resp.text[:500]}
    if not resp.is_success:
        raise HTTPException(502, {"solaredge_status": resp.status_code, "body": body})
    return {"site_id": site_id, "overview": body}


# SolarEdge's registered redirect is https://www.voltarisos.com/auth/callback
# (not /api/oauth/solaredge/callback), so expose that exact path too. Must be
# included in main.py before the SPA catch-all route.
callback_alias_router = APIRouter(tags=["oauth"])


@callback_alias_router.get("/auth/callback")
def solaredge_callback_alias(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    site_id: str | None = None,
    external_id: str | None = None,
    db=Depends(get_db),
):
    return oauth_callback(
        "solaredge", request, code=code, state=state, error=error,
        site_id=site_id, external_id=external_id, db=db,
    )
