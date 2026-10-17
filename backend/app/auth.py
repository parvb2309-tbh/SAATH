"""Low-friction login (spec §4.3): mobile number + OTP, with tokens sent as `Authorization: Bearer <token>`.

The prototype sends no SMS (that costs money): the OTP request returns the code so the screen can show
it, clearly labelled as a demo. Mobile numbers are stored only as salted SHA-256 hashes (spec §6.1).
"""
import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException

from . import db

SALT = os.getenv("UDAAN_SALT", "udaan-prototype-salt")
OTP_TTL = timedelta(minutes=10)
ROLES = ("student", "parent", "counsellor", "teacher", "admin")


def normalise_mobile(mobile: str) -> str:
    digits = re.sub(r"\D", "", mobile or "")[-10:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise HTTPException(400, "Enter a valid 10-digit Indian mobile number")
    return digits


def hash_mobile(mobile: str) -> str:
    return hashlib.sha256(f"{SALT}:{normalise_mobile(mobile)}".encode()).hexdigest()


def _hash_code(mobile_hash: str, code: str) -> str:
    return hashlib.sha256(f"{mobile_hash}:{code}".encode()).hexdigest()


def request_otp(mobile: str) -> str:
    mh = hash_mobile(mobile)
    code = f"{secrets.randbelow(900000) + 100000}"
    with db.connect() as c:
        c.execute("INSERT OR REPLACE INTO otp_requests (mobile_hash, code_hash, created_at, tries) VALUES (?, ?, ?, 0)",
                  (mh, _hash_code(mh, code), db.now()))
    return code


def verify_otp(mobile: str, code: str) -> str:
    mh = hash_mobile(mobile)
    row = db.one("SELECT * FROM otp_requests WHERE mobile_hash = ?", (mh,))
    if not row or datetime.fromisoformat(row["created_at"]) + OTP_TTL < datetime.now(timezone.utc):
        raise HTTPException(400, "The code has expired. Ask for a new one.")
    if row["tries"] >= 5:
        raise HTTPException(429, "Too many attempts. Ask for a new code.")
    if not secrets.compare_digest(row["code_hash"], _hash_code(mh, (code or "").strip())):
        db.update("otp_requests", "mobile_hash", mh, {"tries": row["tries"] + 1})
        raise HTTPException(400, "That code is not right. Please check and try again.")
    with db.connect() as c:
        c.execute("DELETE FROM otp_requests WHERE mobile_hash = ?", (mh,))
    return mh


def issue_token(user_id: str) -> str:
    token = secrets.token_urlsafe(24)
    db.insert("auth_tokens", {"token": token, "user_id": user_id, "created_at": db.now()})
    return token


def user_from_header(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    row = db.one("SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?",
                 (authorization[7:].strip(),))
    return row


def require(*roles: str):
    """FastAPI dependency: the signed-in user, limited to the given roles."""
    def dep(authorization: str | None = Header(default=None)) -> dict:
        user = user_from_header(authorization)
        if not user:
            raise HTTPException(401, "Please sign in")
        if roles and user["role"] not in roles:
            raise HTTPException(403, "This page is for another role")
        return user
    return dep


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    return user_from_header(authorization)
