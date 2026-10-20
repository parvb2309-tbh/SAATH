"""Security utilities: Argon2id password hashing, Keyed HMAC OTPs, and email normalization."""
import hashlib
import hmac
import re
import secrets
import argon2
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from . import config

# Argon2id password hasher
_ph = PasswordHasher(
    time_cost=2,
    memory_cost=19456,
    parallelism=1,
    hash_len=32,
    type=argon2.low_level.Type.ID,
)


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verify password against Argon2id hash."""
    if not password_hash or not password:
        return False
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> str | None:
    """Return error message if password does not meet requirements, else None."""
    if not password or len(password) < 8:
        return "Password must be at least 8 characters long."
    if not any(c.isupper() or c.islower() for c in password):
        return "Password must contain letters."
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number."
    return None


def normalize_email(email: str) -> str:
    """Strip whitespace, lowercase, and validate basic email structure."""
    if not email or "@" not in email:
        raise ValueError("Enter a valid email address.")
    normalized = email.strip().lower()
    parts = normalized.split("@")
    if len(parts) != 2 or not parts[0] or not parts[1] or "." not in parts[1]:
        raise ValueError("Enter a valid email address.")
    return normalized


def generate_otp() -> str:
    """Generate cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(email: str, code: str, purpose: str) -> str:
    """Hash OTP using keyed HMAC-SHA256."""
    msg = f"{email.strip().lower()}:{purpose.strip()}:{code.strip()}".encode("utf-8")
    secret = config.OTP_HMAC_SECRET.encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def verify_otp_hash(stored_hash: str, email: str, code: str, purpose: str) -> bool:
    """Verify OTP code using constant-time comparison."""
    if not stored_hash or not code:
        return False
    computed = hash_otp(email, code, purpose)
    return hmac.compare_digest(stored_hash, computed)
