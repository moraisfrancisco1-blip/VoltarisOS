"""
twofa.py — Two-Factor Authentication (TOTP) endpoints.

Provides endpoints for:
- Setting up 2FA (generate secret, QR code URI)
- Verifying and enabling 2FA
- Disabling 2FA
- Generating backup codes
- Verifying backup codes

Usage:
    POST /api/2fa/setup          — Generate TOTP secret and QR URI
    POST /api/2fa/verify         — Verify code and enable 2FA
    POST /api/2fa/disable        — Disable 2FA
    POST /api/2fa/backup-codes   — Generate new backup codes
    POST /api/2fa/verify-backup  — Verify a backup code
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.security import get_current_user
from backend import models
from backend.twofa import (
    generate_totp_secret,
    get_totp_uri,
    verify_totp_code,
    generate_backup_codes,
    hash_backup_code,
    verify_backup_code,
)
from backend.config import settings
from backend.audit import log_audit_event
from fastapi import Request

router = APIRouter(prefix="/2fa", tags=["2FA"])


# ─── DB dependency ────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Schemas ──────────────────────────────────────────────────────────────────
class SetupResponse(BaseModel):
    secret: str
    qr_uri: str
    message: str


class VerifyRequest(BaseModel):
    code: str


class VerifyResponse(BaseModel):
    success: bool
    message: str
    backup_codes: list[str] | None = None


class DisableRequest(BaseModel):
    code: str  # TOTP code to confirm disabling


class BackupCodesResponse(BaseModel):
    backup_codes: list[str]
    message: str


class VerifyBackupRequest(BaseModel):
    code: str


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/setup", response_model=SetupResponse)
def setup_2fa(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Generate a new TOTP secret and QR code URI for 2FA setup.
    
    The user must scan the QR code with an authenticator app (Google Authenticator,
    Authy, etc.) and then call /2fa/verify with a code to enable 2FA.
    """
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    if user.totp_enabled:
        raise HTTPException(400, "2FA já está ativado. Use /2fa/disable para desativar primeiro.")
    
    # Generate new secret
    secret = generate_totp_secret()
    
    # Store secret temporarily (not enabled yet)
    user.totp_secret = secret
    user.totp_enabled = False
    db.commit()
    
    # Generate QR URI
    qr_uri = get_totp_uri(secret, user.email, settings.TOTP_ISSUER)
    
    # Log audit event
    log_audit_event(
        db=db,
        action="2fa.setup.initiated",
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
    )
    
    return SetupResponse(
        secret=secret,
        qr_uri=qr_uri,
        message="Escaneie o QR code com sua aplicação autenticadora (Google Authenticator, Authy, etc.)"
    )


@router.post("/verify", response_model=VerifyResponse)
def verify_2fa(
    request: Request,
    req: VerifyRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Verify a TOTP code and enable 2FA.
    
    After scanning the QR code, the user must enter the 6-digit code from their
    authenticator app to confirm setup.
    """
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    if not user.totp_secret:
        raise HTTPException(400, "2FA não foi iniciado. Use /2fa/setup primeiro.")
    
    if user.totp_enabled:
        raise HTTPException(400, "2FA já está ativado.")
    
    # Verify the code
    if not verify_totp_code(user.totp_secret, req.code):
        raise HTTPException(400, "Código TOTP inválido. Tente novamente.")
    
    # Enable 2FA
    user.totp_enabled = True
    
    # Generate backup codes
    backup_codes = generate_backup_codes(8)
    user.totp_backup_codes = [hash_backup_code(code) for code in backup_codes]
    
    db.commit()
    
    # Log audit event
    log_audit_event(
        db=db,
        action="2fa.enabled",
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
    )
    
    return VerifyResponse(
        success=True,
        message="2FA ativado com sucesso! Guarde os códigos de backup em local seguro.",
        backup_codes=backup_codes,
    )


@router.post("/disable")
def disable_2fa(
    request: Request,
    req: DisableRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Disable 2FA for the current user.
    
    Requires a valid TOTP code to confirm the action.
    """
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    if not user.totp_enabled:
        raise HTTPException(400, "2FA não está ativado.")
    
    # Verify the code before disabling
    if not verify_totp_code(user.totp_secret, req.code):
        raise HTTPException(400, "Código TOTP inválido.")
    
    # Disable 2FA
    user.totp_enabled = False
    user.totp_secret = None
    user.totp_backup_codes = None
    
    db.commit()
    
    # Log audit event
    log_audit_event(
        db=db,
        action="2fa.disabled",
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
    )
    
    return {"message": "2FA desativado com sucesso."}


@router.post("/backup-codes", response_model=BackupCodesResponse)
def regenerate_backup_codes(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Generate new backup codes for 2FA recovery.
    
    This invalidates all previous backup codes.
    """
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    if not user.totp_enabled:
        raise HTTPException(400, "2FA não está ativado.")
    
    # Generate new backup codes
    backup_codes = generate_backup_codes(8)
    user.totp_backup_codes = [hash_backup_code(code) for code in backup_codes]
    
    db.commit()
    
    # Log audit event
    log_audit_event(
        db=db,
        action="2fa.backup_codes.regenerated",
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
    )
    
    return BackupCodesResponse(
        backup_codes=backup_codes,
        message="Novos códigos de backup gerados. Os códigos anteriores foram invalidados."
    )


@router.post("/verify-backup")
def verify_backup(
    request: Request,
    req: VerifyBackupRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Verify a backup code for 2FA recovery.
    
    If valid, the backup code is consumed (cannot be used again).
    """
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    if not user.totp_enabled:
        raise HTTPException(400, "2FA não está ativado.")
    
    if not user.totp_backup_codes:
        raise HTTPException(400, "Nenhum código de backup disponível.")
    
    # Verify the backup code
    if not verify_backup_code(req.code, user.totp_backup_codes):
        raise HTTPException(400, "Código de backup inválido.")
    
    # Remove the used backup code
    code_hash = hash_backup_code(req.code.upper())
    user.totp_backup_codes = [h for h in user.totp_backup_codes if h != code_hash]
    
    db.commit()
    
    # Log audit event
    log_audit_event(
        db=db,
        action="2fa.backup_code.used",
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
        details={"remaining_codes": len(user.totp_backup_codes)},
    )
    
    return {
        "message": "Código de backup verificado com sucesso.",
        "remaining_codes": len(user.totp_backup_codes),
    }


@router.get("/status")
def get_2fa_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get the current 2FA status for the user."""
    user = db.query(models.User).filter(models.User.email == current_user.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    return {
        "enabled": user.totp_enabled,
        "has_backup_codes": bool(user.totp_backup_codes),
        "backup_codes_count": len(user.totp_backup_codes) if user.totp_backup_codes else 0,
    }