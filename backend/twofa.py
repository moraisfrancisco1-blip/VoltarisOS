"""
twofa.py — Two-Factor Authentication (TOTP) module.

Provides TOTP-based 2FA using pyotp library.
Supports:
- Setup: Generate secret and QR code URI
- Verification: Validate TOTP codes
- Backup codes: Generate and verify backup codes for recovery

Usage:
    from backend.twofa import generate_totp_secret, verify_totp_code, generate_backup_codes
    
    # Setup 2FA for a user
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, email)
    
    # Verify code during login
    is_valid = verify_totp_code(secret, code)
"""
import pyotp
import hashlib
import secrets
from typing import Optional


def generate_totp_secret() -> str:
    """Generate a new TOTP secret (base32 encoded)."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "VoltarisOS") -> str:
    """Generate TOTP URI for QR code generation.
    
    Args:
        secret: Base32-encoded TOTP secret
        email: User's email address
        issuer: Service name (shown in authenticator app)
    
    Returns:
        otpauth:// URI for QR code generation
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify a TOTP code.
    
    Args:
        secret: Base32-encoded TOTP secret
        code: 6-digit TOTP code to verify
        valid_window: Number of time steps to check (1 = ±30 seconds)
    
    Returns:
        True if code is valid, False otherwise
    """
    if not secret or not code:
        return False
    
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)


def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate backup codes for 2FA recovery.
    
    Args:
        count: Number of backup codes to generate
    
    Returns:
        List of backup codes (8 characters each)
    """
    codes = []
    for _ in range(count):
        # Generate 8-character alphanumeric code
        code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(8))
        codes.append(code)
    return codes


def hash_backup_code(code: str) -> str:
    """Hash a backup code for secure storage.
    
    Args:
        code: Backup code to hash
    
    Returns:
        SHA-256 hash of the code
    """
    return hashlib.sha256(code.encode()).hexdigest()


def verify_backup_code(code: str, stored_hashes: list[str]) -> bool:
    """Verify a backup code against stored hashes.
    
    Args:
        code: Backup code to verify
        stored_hashes: List of hashed backup codes
    
    Returns:
        True if code matches any stored hash
    """
    if not code or not stored_hashes:
        return False
    
    code_hash = hash_backup_code(code.upper())
    return code_hash in stored_hashes


def get_current_totp_code(secret: str) -> str:
    """Get the current TOTP code (for testing/debugging only).
    
    Args:
        secret: Base32-encoded TOTP secret
    
    Returns:
        Current 6-digit TOTP code
    """
    totp = pyotp.TOTP(secret)
    return totp.now()