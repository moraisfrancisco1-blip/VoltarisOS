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
from fastapi import Depends, HTTPException, Request, status
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


# ─── RBAC v2 — canonical roles + legacy normalization ────────────────────────
# Single source of truth for the role values the whole app (backend guards and
# the frontend RBAC) understands. Legacy / variant spellings found in older DB
# rows or JWTs are mapped onto these so the same account is always recognised.
CANONICAL_ROLES = ("SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MEMBER")

# Alias → canonical. Lookup key is upper-cased with spaces/hyphens collapsed to
# underscores, so "Super Admin", "super-admin" and "SUPERADMIN" all match.
_ROLE_ALIASES = {
    # Platform owner (pre-RBAC-v2 rows stored this account as "admin").
    "SUPER_ADMIN": "SUPER_ADMIN",
    "SUPERADMIN": "SUPER_ADMIN",
    "ADMIN": "SUPER_ADMIN",
    "OWNER": "SUPER_ADMIN",
    "PLATFORM_ADMIN": "SUPER_ADMIN",
    # Organization admins.
    "TENANT_ADMIN": "TENANT_ADMIN",
    "TENANTADMIN": "TENANT_ADMIN",
    "ORG_ADMIN": "TENANT_ADMIN",
    "ORGANIZATION_ADMIN": "TENANT_ADMIN",
    # Regular end users / operators.
    "TENANT_MEMBER": "TENANT_MEMBER",
    "TENANTMEMBER": "TENANT_MEMBER",
    "MEMBER": "TENANT_MEMBER",
    "USER": "TENANT_MEMBER",
    "OPERATOR": "TENANT_MEMBER",
    "VIEWER": "TENANT_MEMBER",
    "INSTALLER": "TENANT_MEMBER",
}


def normalize_role(role) -> str:
    """Map a legacy/variant role string onto the canonical RBAC v2 role.

    Unknown roles (e.g. GATEWAY, SERVICE_READONLY) are returned unchanged so
    non-user service identities keep working.
    """
    if role is None:
        return "TENANT_MEMBER"
    key = str(role).strip().upper().replace("-", "_").replace(" ", "_")
    if not key:
        return "TENANT_MEMBER"
    return _ROLE_ALIASES.get(key, str(role).strip())

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
    """FastAPI dependency — require a valid Bearer JWT. Raises 401 if missing/invalid.

    The decoded role is normalized to the canonical RBAC v2 value here, so every
    downstream guard (require_admin, require_super_admin, permissions, …) sees
    the same role regardless of how it was spelled when the token was issued.
    """
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    user = decode_token(creds.credentials)
    if user.get("role") is not None:
        user["role"] = normalize_role(user.get("role"))
    return user


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


# ─── Forced first-login password change ──────────────────────────────────────
# Accounts created with a temporary password (the first user of a new tenant,
# or any admin-created account flagged as such) may log in but must change it
# before using the platform. SUPER_ADMIN is deliberately excluded: the platform
# owner account is seeded by seed_admin() and never enters this onboarding flow.
def password_change_required(user: dict) -> bool:
    """True when a decoded identity must change its temporary password first."""
    if not user:
        return False
    if user.get("role") == "SUPER_ADMIN":
        return False
    return bool(user.get("must_change_password"))


async def require_password_changed(user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency — block platform usage until the temporary password
    has been replaced.

    Strictly additive: the claim is only present on tokens issued for an account
    with `must_change_password` set, so every pre-existing session and every
    normal account behaves exactly as before.
    """
    if password_change_required(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tem de alterar a password temporária antes de usar a plataforma",
        )
    return user


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


# ─── Volt Core service key (machine-to-machine, read-only, closed allowlist) ──
# Lets the Volt Core agent-operations hub (a separate app) read a small, fixed
# set of platform status endpoints without a human login or a stored admin
# session/password. A distinct credential from user JWTs and from the device
# GATEWAY_API_KEY(S) above — this key can never write, and never reaches
# anything outside VOLT_CORE_SERVICE_ALLOWLIST below.
#
# Deliberately an ALLOWLIST, not a denylist: adding a new route to the app
# later never grants this key access to it — only someone editing the set
# below, on purpose, does. Enforced globally by VoltCoreServiceKeyMiddleware
# (backend/main.py), which runs before routing, so a wrong key or a right key
# used outside the allowlist gets a 403 no matter which route it's aimed at —
# including write endpoints this module never touches.
VOLT_CORE_SERVICE_HEADER = "x-volt-core-key"  # Starlette lowercases header names

VOLT_CORE_SERVICE_ALLOWLIST = frozenset({
    ("GET", "/api/admin/tenants"),
    ("GET", "/api/admin/system-health"),
    ("GET", "/api/admin/production-readiness"),
    ("GET", "/api/alerts"),
    ("GET", "/api/alert-rules"),
})

# Synthetic identity substituted for a JWT-derived user on the allowlisted
# routes only. tenant_id=None reads as "no tenant filter" wherever routes
# already treat SUPER_ADMIN's tenant_id=None that way (see _effective_tenant
# in alerts_ws.py) — a platform-wide read view, matching /api/admin/tenants.
VOLT_CORE_SERVICE_IDENTITY = {"sub": "volt-core-service", "role": "SERVICE_READONLY", "tenant_id": None}


def _volt_core_key_matches(supplied: str) -> bool:
    """Read the configured key fresh on every call (not cached at import time)
    so rotating VOLT_CORE_SERVICE_KEY takes effect without a redeploy — same
    reasoning as _load_gateway_keys() above."""
    configured = os.environ.get("VOLT_CORE_SERVICE_KEY", "")
    return bool(configured) and hmac.compare_digest(supplied, configured)


def check_volt_core_service_key(method: str, path: str, supplied_key):
    """Core allowlist check, shared by the middleware and (indirectly, via
    request.state) the per-route dependencies below.

    Returns:
      - False — no key was supplied; caller must fall through to normal auth,
        completely unchanged. This is the case for every request from real
        users, always, since they never send this header.
      - True  — key matches AND (method, path) is in the closed allowlist.
    Raises HTTPException(403) for a wrong key, or a right key used outside
    the allowlist — both are rejected outright, never silently falling back
    to "please log in" (a 401), because that would misrepresent a scoping
    violation as a missing credential.
    """
    if supplied_key is None:
        return False
    if not _volt_core_key_matches(supplied_key):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chave de serviço inválida")
    if (method, path) not in VOLT_CORE_SERVICE_ALLOWLIST:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta chave não tem acesso a este endpoint")
    return True


def _is_volt_core_service_request(request: Request) -> bool:
    """True only when VoltCoreServiceKeyMiddleware already validated this
    exact request (key + allowlist) and marked it on request.state. Routes
    never re-derive trust from the header themselves."""
    return getattr(request.state, "volt_core_service", False) is True


async def get_current_user_or_service(
    request: Request, creds: HTTPAuthorizationCredentials = Depends(_bearer)
) -> dict:
    """Drop-in replacement for Depends(get_current_user) on the two GET
    endpoints (/api/alerts, /api/alert-rules) that accept the Volt Core
    service key. Human traffic is completely unaffected: no header, no
    change in behavior."""
    if _is_volt_core_service_request(request):
        return VOLT_CORE_SERVICE_IDENTITY
    return await get_current_user(creds)


async def require_super_admin_or_service(
    request: Request, creds: HTTPAuthorizationCredentials = Depends(_bearer)
) -> dict:
    """Drop-in replacement for Depends(require_super_admin) on the three
    SUPER_ADMIN-only GET endpoints the Volt Core key may read."""
    if _is_volt_core_service_request(request):
        return VOLT_CORE_SERVICE_IDENTITY
    user = await get_current_user(creds)
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao Super Admin da plataforma")
    return user