"""
security.py — shared auth used by every router.
- Single SECRET_KEY (env var, no more mismatched hardcoded strings)
- bcrypt password hashing (passlib) with legacy sha256 fallback for old accounts
- get_current_user: FastAPI dependency that validates the JWT and 401s if missing/invalid
"""
import hashlib
import hmac
import json
import os
import sys

from dotenv import load_dotenv
load_dotenv()

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address


def _require_secret(key: str) -> str:
    """Return env var or exit — secrets must never have hardcoded fallbacks."""
    value = os.environ.get(key)
    if not value:
        print(
            f"ERROR: Required secret '{key}' is not set. "
            f"Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"",
            file=sys.stderr,
        )
        sys.exit(1)
    return value


SECRET_KEY = _require_secret("SECRET_KEY")
ALGORITHM = "HS256"

_bearer = HTTPBearer(auto_error=False)

# Shared limiter instance — must be the SAME object used in app.state.limiter (main.py)
# and in @limiter.limit(...) decorators across routers, otherwise slowapi can't track state.
limiter = Limiter(key_func=get_remote_address)


# ─── Password hashing (bcrypt directly — no passlib, avoids version conflicts) ─
def hash_pw(password: str) -> str:
    """New passwords always get bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def _legacy_sha256(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_pw(password: str, stored_hash: str) -> bool:
    """Verify against bcrypt hash, falling back to legacy sha256 for pre-migration accounts."""
    if stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$") or stored_hash.startswith("$2y$"):
        try:
            return bcrypt.checkpw(password.encode("utf-8")[:72], stored_hash.encode("utf-8"))
        except Exception:
            return False
    # legacy sha256 hash (accounts created before the bcrypt migration)
    return stored_hash == _legacy_sha256(password)


# ─── JWT ──────────────────────────────────────────────────────────────────────
def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """FastAPI dependency — require a valid Bearer JWT. Raises 401 if missing/invalid."""
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    return decode_token(creds.credentials)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency — require TENANT_ADMIN or SUPER_ADMIN role."""
    if user.get("role") not in ("SUPER_ADMIN", "TENANT_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return user


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency — require SUPER_ADMIN role exclusively.
    Used for infrastructure routes, global tenant management, and system health.
    No other role (including TENANT_ADMIN) can pass this check."""
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao Super Admin da plataforma")
    return user


def require_role(*allowed_roles: str):
    """Factory for a FastAPI dependency restricting an endpoint to specific roles.
    SUPER_ADMIN always pass regardless of the list (they retain full access).
    Usage: Depends(require_role("TENANT_MEMBER", "TENANT_ADMIN"))"""
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role")
        if role == "SUPER_ADMIN":
            return user
        if role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido para este tipo de conta")
        return user
    return _dep


async def check_module_access(module_name: str, user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency — validate that the user's active plan includes the requested module.

    Usage:
        @router.post("/trading/execute")
        async def execute_trade(..., _: dict = Depends(lambda: check_module_access("markets_trading"))):
            ...

    SUPER_ADMIN bypasses all module checks.
    Module access is determined by the ALLOWED_MODULES per plan (see permissions.py).
    """
    from backend.permissions import can_access_module, get_tenant_plan
    from backend.database import SessionLocal

    role = user.get("role", "")
    if role == "SUPER_ADMIN":
        return user

    db = SessionLocal()
    try:
        plan = get_tenant_plan(user, db)
        if not can_access_module(plan, module_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"O módulo '{module_name}' não está disponível no teu plano ({plan}). Faz upgrade para desbloquear.",
            )
        return user
    finally:
        db.close()


# ─── Service-to-service auth (gateway/rules engine, not a logged-in user) ────
# GATEWAY_API_KEY must be set in production; empty string only acceptable in local dev
GATEWAY_API_KEY = os.environ.get("GATEWAY_API_KEY", "")
# Warn at import time if not set (but don't crash — gateway auth is optional in dev)
if not GATEWAY_API_KEY and os.environ.get("ENVIRONMENT", "development") != "development":
    print(
        "WARNING: GATEWAY_API_KEY is not set. Gateway-to-backend auth will fail.",
        file=sys.stderr,
    )

_gateway_bearer = HTTPBearer(auto_error=False)


async def require_gateway_key(creds: HTTPAuthorizationCredentials = Depends(_gateway_bearer)) -> None:
    """Protects endpoints called by internal services (e.g. device gateway firing alerts),
    not by logged-in users. Requires GATEWAY_API_KEY env var to be set in production."""
    if not GATEWAY_API_KEY:
        # No key configured — fail closed in any environment that isn't local dev.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Gateway auth not configured")
    if creds is None or creds.credentials != GATEWAY_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chave de serviço inválida")


# ─── Tenant-scoped gateway keys (service-to-service telemetry ingestion) ──────
# GATEWAY_API_KEYS binds a gateway bearer token to exactly ONE tenant it may
# write to. Format (JSON):  {"<key1>": 1, "<key2>": 2}
#
# This is separate from the global GATEWAY_API_KEY above (which remains for the
# alert rules engine, where the tenant is carried explicitly in the request body).
# Ingestion derives the tenant from the authenticated credential, never from
# client-supplied data, so a gateway key can never reach another tenant.
def _load_gateway_keys() -> dict:
    """Parse GATEWAY_API_KEYS into {token: tenant_id}. Read lazily so key
    rotation/revocation propagates without a code deploy (on env reload)."""
    raw = os.environ.get("GATEWAY_API_KEYS", "")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    if not isinstance(parsed, dict):
        return {}
    mapping = {}
    for key, tenant_id in parsed.items():
        try:
            mapping[str(key)] = int(tenant_id)
        except (TypeError, ValueError):
            continue
    return mapping


def _gateway_tenant_for_token(token: str):
    """Return the tenant_id bound to a gateway token, or None. Constant-time
    comparison avoids leaking which key matched via timing side channels."""
    for key, tenant_id in _load_gateway_keys().items():
        if hmac.compare_digest(key, token):
            return tenant_id
    return None


async def require_ingest_identity(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Identity for telemetry ingestion: either a logged-in user (JWT) or a
    tenant-scoped gateway key. Always returns a dict carrying `tenant_id` so
    the ingestion path can enforce tenant isolation against the device record.
    """
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")

    token = creds.credentials

    # 1) Normal logged-in user (JWT)
    try:
        return decode_token(token)
    except HTTPException:
        pass

    # 2) Tenant-scoped gateway key (no JWT required for the edge gateway)
    tenant_id = _gateway_tenant_for_token(token)
    if tenant_id is not None:
        return {"sub": "gateway", "role": "GATEWAY", "tenant_id": tenant_id}

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chave de serviço inválida")