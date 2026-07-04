"""
security.py — shared auth used by every router.
- Single SECRET_KEY (env var, no more mismatched hardcoded strings)
- bcrypt password hashing (passlib) with legacy sha256 fallback for old accounts
- get_current_user: FastAPI dependency that validates the JWT and 401s if missing/invalid
"""
import hashlib
import os

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

SECRET_KEY = os.environ.get("SECRET_KEY", "voltarisos-secret-2026-production")
ALGORITHM = "HS256"

_bearer = HTTPBearer(auto_error=False)


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
    """FastAPI dependency — require superadmin/admin role."""
    if user.get("role") not in ("superadmin", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores")
    return user
