"""Authentication dependency, session management in MongoDB, and rate limiting."""
from datetime import datetime, timedelta, timezone
import logging
import secrets
import time
from collections import defaultdict
from fastapi import Header, HTTPException

from . import config, mongo

logger = logging.getLogger("saath.auth")
ROLES = ("student", "parent", "counsellor", "teacher", "admin")

# In-memory rate limiting:
# - OTP requests cooldown: minimum 60s between OTP requests per email
# - Max 5 OTP requests per hour per email
# - Login brute-force protection: max 5 failed attempts per 5 minutes per identifier
_otp_cooldown_tracker: dict[str, float] = {}
_otp_hourly_tracker: dict[str, list[float]] = defaultdict(list)
_failed_login_tracker: dict[str, list[float]] = defaultdict(list)

SALT = "udaan-prototype-salt"


def hash_mobile(mobile: str) -> str:
    import hashlib
    import re
    digits = re.sub(r"\D", "", mobile or "")[-10:]
    return hashlib.sha256(f"{SALT}:{digits}".encode()).hexdigest()


def check_otp_rate_limit(email: str) -> None:
    """Enforce a 60-second cooldown and hourly cap on OTP requests."""
    now = time.time()
    norm_email = email.strip().lower()

    # 60-second cooldown
    last_sent = _otp_cooldown_tracker.get(norm_email)
    if last_sent and (now - last_sent) < 60:
        remaining = int(60 - (now - last_sent))
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {remaining} seconds before requesting a new code.",
        )

    # Hourly cap (max 5 per hour)
    recent = [t for t in _otp_hourly_tracker[norm_email] if now - t < 3600]
    _otp_hourly_tracker[norm_email] = recent
    if len(recent) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many verification requests. Please try again after an hour.",
        )


def record_otp_sent(email: str) -> None:
    now = time.time()
    norm_email = email.strip().lower()
    _otp_cooldown_tracker[norm_email] = now
    _otp_hourly_tracker[norm_email].append(now)


def check_login_rate_limit(key: str) -> None:
    """Enforce maximum 5 failed attempts per 5 minutes."""
    now = time.time()
    recent = [t for t in _failed_login_tracker[key] if now - t < 300]
    _failed_login_tracker[key] = recent
    if len(recent) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please wait 5 minutes before trying again.",
        )


def record_failed_login(key: str) -> None:
    now = time.time()
    _failed_login_tracker[key].append(now)


def reset_failed_logins(key: str) -> None:
    _failed_login_tracker.pop(key, None)


async def issue_token(user_id: str) -> str:
    """Create an authenticated session token stored in MongoDB."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    tokens_col = mongo.get_tokens_col()
    await tokens_col.insert_one({
        "token": token,
        "user_id": str(user_id),
        "created_at": now,
        "expires_at": expires_at,
    })
    return token


def issue_token_sync(user_id: str) -> str:
    """Synchronous token issue for scripts / seed."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)

    tokens_col = mongo.get_sync_tokens_col()
    tokens_col.insert_one({
        "token": token,
        "user_id": str(user_id),
        "created_at": now,
        "expires_at": expires_at,
    })
    return token


async def revoke_token(token: str) -> None:
    """Revoke a session token from MongoDB."""
    if token:
        tokens_col = mongo.get_tokens_col()
        await tokens_col.delete_one({"token": token})


async def revoke_all_user_tokens(user_id: str) -> None:
    """Revoke all session tokens for a user (e.g. on password reset)."""
    if user_id:
        tokens_col = mongo.get_tokens_col()
        await tokens_col.delete_many({"user_id": str(user_id)})


async def get_user_from_token(token: str) -> dict | None:
    """Lookup user by token asynchronously."""
    if not token:
        return None
    tokens_col = mongo.get_tokens_col()
    record = await tokens_col.find_one({"token": token})
    if not record:
        return None

    # Check expiry
    expires_at = record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        await tokens_col.delete_one({"token": token})
        return None

    users_col = mongo.get_users_col()
    user = await users_col.find_one({"_id": record["user_id"]})
    if not user:
        return None

    user["id"] = str(user["_id"])
    return user


def get_user_from_token_sync(token: str) -> dict | None:
    """Lookup user by token synchronously (used by synchronous routes and helpers)."""
    if not token:
        return None
    tokens_col = mongo.get_sync_tokens_col()
    record = tokens_col.find_one({"token": token})
    if not record:
        return None

    expires_at = record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        tokens_col.delete_one({"token": token})
        return None

    users_col = mongo.get_sync_users_col()
    user = users_col.find_one({"_id": record["user_id"]})
    if not user:
        return None

    user["id"] = str(user["_id"])
    return user


def user_from_header(authorization: str | None) -> dict | None:
    """Extract and authenticate user from Authorization header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:].strip()
    return get_user_from_token_sync(token)


def require(*roles: str):
    """FastAPI dependency: user must be authenticated and have an allowed role."""
    def dep(authorization: str | None = Header(default=None)) -> dict:
        user = user_from_header(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="Please sign in")
        if roles and user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="This page is for another role")
        return user
    return dep


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    """FastAPI dependency: optional user from header."""
    return user_from_header(authorization)
