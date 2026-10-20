"""Authentication, user accounts, profile management, and privacy endpoints."""
from datetime import datetime, timedelta, timezone
import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from .. import auth, config, db, mongo, security
from ..email_service import EmailDeliveryError, send_password_reset_otp, send_verification_otp
from ..services import consents_for, ensure_chat, link_for_student, linked_student, new_id, sync_chat_trade

logger = logging.getLogger("saath.account")
router = APIRouter(prefix="/api", tags=["account"])

Role = Literal["student", "parent", "counsellor", "teacher", "admin"]
AllowedSelfRegisterRole = Literal["student", "parent"]
Lang = Literal["hi", "en"]
PROFILE_FIELDS = (
    "education_level", "study_mode", "age", "gender", "budget_limit",
    "max_travel_km", "needs_stipend", "min_earning", "max_months",
    "work_setting", "chosen_trade", "district_id",
)

# ------------------------------------------------------------------ Pydantic Request Models

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=100)
    role: AllowedSelfRegisterRole
    lang: Lang = "hi"


class OtpRequestModel(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    purpose: Literal["signup_verification", "password_reset"] = "signup_verification"


class OtpVerifyModel(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    code: str = Field(..., min_length=6, max_length=6)
    purpose: Literal["signup_verification", "password_reset"] = "signup_verification"


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=100)


class MePatch(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    preferred_lang: Lang | None = None
    district_id: str | None = None
    relation: Literal["mother", "father", "guardian"] | None = None
    education_level: Literal["8", "10", "12", "iti", "grad"] | None = None
    study_mode: Literal["full_time", "part_time", "weekend"] | None = None
    age: int | None = Field(default=None, ge=12, le=40)
    gender: Literal["m", "f", "x"] | None = None
    budget_limit: int | None = Field(default=None, ge=0, le=500000)
    max_travel_km: int | None = Field(default=None, ge=0, le=500)
    needs_stipend: bool | None = None
    min_earning: int | None = Field(default=None, ge=0, le=100000)
    max_months: int | None = Field(default=None, ge=1, le=60)
    work_setting: Literal["indoor", "outdoor", "any"] | None = None
    chosen_trade: str | None = None


class ConsentIn(BaseModel):
    ai_guidance: bool
    counsellor_share: bool
    parent_link: bool
    research: bool


# ------------------------------------------------------------------ Internal Helpers

def _me(user: dict) -> dict:
    """Build standardized user profile & permissions state for the frontend."""
    uid = str(user.get("id") or user.get("_id"))
    out = {
        "user": {
            "id": uid,
            "role": user.get("role"),
            "name": user.get("name") or "",
            "email": user.get("email") or "",
            "relation": user.get("relation"),
            "preferred_lang": user.get("preferred_lang") or "hi",
            "district_id": user.get("district_id"),
        },
        "consents": consents_for(uid),
    }

    if user.get("role") == "student":
        p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (uid,))
        out["profile"] = p and {k: v for k, v in p.items() if k != "private_notes"}
        dna = p and db.one("SELECT riasec FROM career_dna WHERE profile_id = ?", (p["id"],))
        out["has_dna"] = bool(dna and dna["riasec"])
        minor = bool(p and (p.get("age") or 18) < 18)
        out["minor"] = minor
        out["guardian_needed"] = minor and not out["consents"].get("guardian_approved")
        link = p and link_for_student(p["id"])
        out["link"] = link and {"code": link["code"], "status": link["consent_status"]}
        out["onboarded"] = bool(p and p.get("district_id") and p.get("education_level"))
    else:
        out["onboarded"] = bool(user.get("district_id")) or user.get("role") in ("counsellor", "admin", "teacher")
        if user.get("role") == "parent":
            pair = linked_student({"id": uid, **user})
            if pair:
                su = db.one("SELECT name FROM users WHERE id = ?", (pair[1]["user_id"],))
                out["linked_student"] = {
                    "profile_id": pair[1]["id"],
                    "name": su and su["name"],
                    "chosen_trade": pair[1].get("chosen_trade"),
                }
    return out


def clean_email(email_str: str) -> str:
    try:
        return security.normalize_email(email_str)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------ Authentication Endpoints

@router.post("/auth/register")
async def register(body: RegisterRequest):
    """Register a new student or parent account. Sends email verification OTP."""
    norm_email = clean_email(body.email)

    # Privileged roles cannot self-register
    if body.role not in ("student", "parent"):
        raise HTTPException(
            status_code=403,
            detail="Staff accounts (counsellor, teacher, admin) must be created through an administrative process.",
        )

    # Validate password strength
    pwd_err = security.validate_password_strength(body.password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)

    users_col = mongo.get_users_col()
    existing = await users_col.find_one({"normalized_email": norm_email})
    if existing and existing.get("is_email_verified"):
        raise HTTPException(
            status_code=409,
            detail="An account with this email address already exists. Please sign in.",
        )

    # Cooldown check for OTP requests
    auth.check_otp_rate_limit(norm_email)

    # Generate 6-digit OTP and keyed HMAC hash
    otp_code = security.generate_otp()
    purpose = "signup_verification"
    otp_hash = security.hash_otp(norm_email, otp_code, purpose)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=config.OTP_EXPIRE_MINUTES)

    # Send verification email first
    try:
        await send_verification_otp(norm_email, otp_code, config.OTP_EXPIRE_MINUTES)
    except EmailDeliveryError as e:
        logger.error("Registration email delivery failed for %s: %s", norm_email, str(e))
        raise HTTPException(
            status_code=502,
            detail="Failed to send verification email. Please check your email address and try again.",
        )

    auth.record_otp_sent(norm_email)

    # Save OTP request in MongoDB
    otp_col = mongo.get_otp_col()
    await otp_col.insert_one({
        "email": norm_email,
        "purpose": purpose,
        "otp_hash": otp_hash,
        "expires_at": expires_at,
        "attempts": 0,
        "consumed_at": None,
        "created_at": now,
    })

    # Create or update unverified user record
    password_hash = security.hash_password(body.password)
    user_data = {
        "name": body.name.strip(),
        "email": body.email.strip(),
        "normalized_email": norm_email,
        "password_hash": password_hash,
        "role": body.role,
        "preferred_lang": body.lang,
        "is_email_verified": False,
        "is_active": False,
        "updated_at": now.isoformat(timespec="seconds"),
    }

    if existing:
        user_id = str(existing["_id"])
        await users_col.update_one({"_id": existing["_id"]}, {"$set": user_data})
    else:
        user_id = new_id()
        user_data["_id"] = user_id
        user_data["created_at"] = now.isoformat(timespec="seconds")
        user_data["last_login_at"] = None
        user_data["district_id"] = None
        user_data["relation"] = None
        await users_col.insert_one(user_data)

    return {
        "ok": True,
        "message": f"Verification code sent to {body.email}",
        "email": norm_email,
    }


@router.post("/auth/otp/request")
async def request_otp(body: OtpRequestModel):
    """Request or resend an email OTP for signup verification or password reset."""
    norm_email = clean_email(body.email)
    auth.check_otp_rate_limit(norm_email)

    users_col = mongo.get_users_col()
    user = await users_col.find_one({"normalized_email": norm_email})

    if body.purpose == "signup_verification":
        if not user:
            raise HTTPException(status_code=404, detail="No unverified account found for this email.")
        if user.get("is_email_verified"):
            raise HTTPException(status_code=400, detail="This email is already verified. Please sign in.")
    elif body.purpose == "password_reset":
        # Do not leak whether the email exists
        if not user or not user.get("is_active"):
            return {
                "sent": True,
                "message": "If an account with that email exists, a verification code has been sent.",
            }

    otp_code = security.generate_otp()
    otp_hash = security.hash_otp(norm_email, otp_code, body.purpose)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=config.OTP_EXPIRE_MINUTES)

    try:
        if body.purpose == "signup_verification":
            await send_verification_otp(norm_email, otp_code, config.OTP_EXPIRE_MINUTES)
        else:
            await send_password_reset_otp(norm_email, otp_code, config.OTP_EXPIRE_MINUTES)
    except EmailDeliveryError as e:
        logger.error("OTP send failed for %s (%s): %s", norm_email, body.purpose, str(e))
        raise HTTPException(
            status_code=502,
            detail="Failed to send verification email. Please try again later.",
        )

    auth.record_otp_sent(norm_email)

    otp_col = mongo.get_otp_col()
    await otp_col.insert_one({
        "email": norm_email,
        "purpose": body.purpose,
        "otp_hash": otp_hash,
        "expires_at": expires_at,
        "attempts": 0,
        "consumed_at": None,
        "created_at": now,
    })

    return {
        "sent": True,
        "message": "Verification code sent to your email.",
    }


@router.post("/auth/otp/verify")
async def verify_otp(body: OtpVerifyModel):
    """Verify an email OTP for signup activation or reset."""
    norm_email = clean_email(body.email)
    code = body.code.strip()

    otp_col = mongo.get_otp_col()
    now = datetime.now(timezone.utc)

    # Find the newest matching active OTP record
    cursor = otp_col.find({
        "email": norm_email,
        "purpose": body.purpose,
    }).sort("created_at", -1)

    record = None
    async for r in cursor:
        record = r
        break

    if not record:
        raise HTTPException(status_code=400, detail="No verification code found. Please request a new one.")

    # Check consumed
    if record.get("consumed_at") is not None:
        raise HTTPException(status_code=400, detail="This code has already been used. Please request a new one.")

    # Check expiry
    expires_at = record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now:
        raise HTTPException(status_code=400, detail="The code has expired. Please request a new one.")

    # Check attempts
    attempts = record.get("attempts", 0)
    if attempts >= config.OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. This code is invalidated. Please request a new one.",
        )

    # Validate HMAC
    is_valid = security.verify_otp_hash(record["otp_hash"], norm_email, code, body.purpose)
    if not is_valid:
        await otp_col.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        remaining = config.OTP_MAX_ATTEMPTS - (attempts + 1)
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Please request a new code.",
            )
        raise HTTPException(
            status_code=400,
            detail=f"That code is not correct. {remaining} attempt(s) remaining.",
        )

    # Code is valid -> consume it immediately
    await otp_col.update_one({"_id": record["_id"]}, {"$set": {"consumed_at": now}})

    if body.purpose == "signup_verification":
        users_col = mongo.get_users_col()
        user = await users_col.find_one({"normalized_email": norm_email})
        if not user:
            raise HTTPException(status_code=404, detail="User account not found.")

        # Activate user account
        user_id = str(user["_id"])
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "is_email_verified": True,
                "is_active": True,
                "updated_at": now.isoformat(timespec="seconds"),
            }},
        )
        user["is_email_verified"] = True
        user["is_active"] = True
        user["id"] = user_id

        # Sync user to SQLite users table so legacy joins continue working
        try:
            with db.connect() as c:
                c.execute(
                    "INSERT OR REPLACE INTO users (id, role, mobile_hash, name, relation, preferred_lang, district_id, created_at, synthetic, demo_key) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)",
                    (user_id, user["role"], None, user.get("name", ""), user.get("relation"),
                     user.get("preferred_lang", "hi"), user.get("district_id"), db.now()),
                )
                if user["role"] == "student":
                    existing_p = db.one("SELECT id FROM student_profiles WHERE user_id = ?", (user_id,))
                    if not existing_p:
                        c.execute(
                            "INSERT INTO student_profiles (id, user_id, created_at, synthetic, flags, stage) VALUES (?, ?, ?, 0, '{}', 1)",
                            (new_id(), user_id, db.now()),
                        )
            db.update("users", "id", user_id, {"last_active_at": db.now()})
        except Exception as e:
            logger.warning("Error syncing verified user to SQLite: %s", str(e))

        token = await auth.issue_token(user_id)
        return {"token": token, "is_new": True, **_me(user)}

    # For password reset verification
    return {"verified": True, "message": "Code verified. Please set your new password."}


@router.post("/auth/login")
async def login(body: LoginRequest, request: Request):
    """Authenticate with email and password without OTP."""
    norm_email = clean_email(body.email)
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{norm_email}:{client_ip}"

    # Rate limiting on failed login attempts
    auth.check_login_rate_limit(rate_key)

    users_col = mongo.get_users_col()
    user = await users_col.find_one({"normalized_email": norm_email})

    if not user:
        auth.record_failed_login(rate_key)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Check password with Argon2id
    pwd_hash = user.get("password_hash")
    if not pwd_hash or not security.verify_password(pwd_hash, body.password):
        auth.record_failed_login(rate_key)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Check email verification status
    if not user.get("is_email_verified"):
        raise HTTPException(
            status_code=403,
            detail="Your email has not been verified yet. Please complete email verification.",
        )

    # Check account active status
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Your account is inactive. Please contact support.")

    # Reset failed login count on successful auth
    auth.reset_failed_logins(rate_key)

    # Update last login timestamp
    user_id = str(user["_id"])
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    await users_col.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now_iso}})
    db.update("users", "id", user_id, {"last_active_at": db.now()})
    user["last_login_at"] = now_iso
    user["id"] = user_id

    token = await auth.issue_token(user_id)
    return {"token": token, "is_new": False, **_me(user)}


@router.post("/auth/logout")
async def logout(authorization: str | None = Header(default=None)):
    """Revoke authenticated session."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        await auth.revoke_token(token)
    return {"ok": True}


@router.get("/auth/me")
@router.get("/me")
def me(user: dict = Depends(auth.require())):
    """Retrieve authenticated user's profile and consents."""
    return _me(user)


@router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """Send password reset code to user's registered email without leaking existence."""
    norm_email = security.normalize_email(body.email)
    auth.check_otp_rate_limit(norm_email)

    users_col = mongo.get_users_col()
    user = await users_col.find_one({"normalized_email": norm_email})

    # Generic response regardless of existence to avoid enumeration
    if not user or not user.get("is_active"):
        return {
            "ok": True,
            "message": "If an account with that email exists, a password reset code has been sent.",
        }

    otp_code = security.generate_otp()
    purpose = "password_reset"
    otp_hash = security.hash_otp(norm_email, otp_code, purpose)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=config.OTP_EXPIRE_MINUTES)

    try:
        await send_password_reset_otp(norm_email, otp_code, config.OTP_EXPIRE_MINUTES)
    except EmailDeliveryError as e:
        logger.error("Password reset email delivery failed for %s: %s", norm_email, str(e))
        raise HTTPException(
            status_code=502,
            detail="Failed to send password reset email. Please try again later.",
        )

    auth.record_otp_sent(norm_email)

    otp_col = mongo.get_otp_col()
    await otp_col.insert_one({
        "email": norm_email,
        "purpose": purpose,
        "otp_hash": otp_hash,
        "expires_at": expires_at,
        "attempts": 0,
        "consumed_at": None,
        "created_at": now,
    })

    return {
        "ok": True,
        "message": "If an account with that email exists, a password reset code has been sent.",
    }


@router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """Reset account password using verified reset OTP."""
    norm_email = security.normalize_email(body.email)
    code = body.code.strip()

    # Validate password strength
    pwd_err = security.validate_password_strength(body.new_password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)

    otp_col = mongo.get_otp_col()
    now = datetime.now(timezone.utc)

    # Find the newest matching password reset OTP
    cursor = otp_col.find({
        "email": norm_email,
        "purpose": "password_reset",
    }).sort("created_at", -1)

    record = None
    async for r in cursor:
        record = r
        break

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code. Please request a new one.")

    if record.get("consumed_at") is not None:
        raise HTTPException(status_code=400, detail="This reset code has already been used.")

    expires_at = record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < now:
        raise HTTPException(status_code=400, detail="This reset code has expired. Please request a new one.")

    attempts = record.get("attempts", 0)
    if attempts >= config.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")

    if not security.verify_otp_hash(record["otp_hash"], norm_email, code, "password_reset"):
        await otp_col.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="That code is not correct. Please check and try again.")

    # Consume the OTP
    await otp_col.update_one({"_id": record["_id"]}, {"$set": {"consumed_at": now}})

    # Update password hash in MongoDB
    users_col = mongo.get_users_col()
    user = await users_col.find_one({"normalized_email": norm_email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_hash = security.hash_password(body.new_password)
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password_hash": new_hash,
            "updated_at": now.isoformat(timespec="seconds"),
        }},
    )

    # Invalidate existing sessions for security
    await auth.revoke_all_user_tokens(str(user["_id"]))

    return {
        "ok": True,
        "message": "Your password has been reset successfully. You can now sign in.",
    }


# Backwards compatibility demo login for automated tests & local development
@router.post("/auth/demo/{role}")
async def demo_login(role: Role):
    """Sign in to seeded demo account for local development/testing."""
    demo_email_map = {
        "student": "student@saath.local",
        "parent": "parent@saath.local",
        "counsellor": "counsellor@saath.local",
        "teacher": "teacher@saath.local",
        "admin": "admin@saath.local",
    }
    target_email = demo_email_map.get(role)
    users_col = mongo.get_users_col()
    user = await users_col.find_one({"normalized_email": target_email})
    if not user:
        # Fallback to demo key lookup
        user = await users_col.find_one({"_id": f"demo-{role}"})
    if not user:
        raise HTTPException(status_code=404, detail=f"Demo account for {role} not found. Please reseed the database.")

    user_id = str(user["_id"])
    user["id"] = user_id
    token = await auth.issue_token(user_id)
    return {"token": token, "is_new": False, **_me(user)}


# ------------------------------------------------------------------ User Profile & Consents

@router.patch("/me")
async def patch_me(body: MePatch, user: dict = Depends(auth.require())):
    changes = body.model_dump(exclude_none=True)
    if "district_id" in changes and not db.get_district(changes["district_id"]):
        raise HTTPException(400, "Unknown district")
    if "chosen_trade" in changes and not db.get_trade(changes["chosen_trade"]):
        raise HTTPException(400, "Unknown trade")

    user_id = str(user["id"])
    user_changes = {k: v for k, v in changes.items() if k in ("name", "preferred_lang", "district_id", "relation")}

    if user_changes:
        # Update MongoDB
        users_col = mongo.get_users_col()
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {**user_changes, "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}},
        )
        # Sync to SQLite; the admin India map groups users by state
        if "district_id" in user_changes:
            user_changes["state"] = db.get_district(user_changes["district_id"])["state"]
        try:
            db.update("users", "id", user_id, user_changes)
        except Exception:
            pass

    if user["role"] == "student":
        p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (user_id,))
        prof = {k: v for k, v in changes.items() if k in PROFILE_FIELDS}
        if "needs_stipend" in prof:
            prof["needs_stipend"] = int(prof["needs_stipend"])
        if prof and p:
            db.update("student_profiles", "id", p["id"], prof)
        if "chosen_trade" in prof and p and prof["chosen_trade"] != p.get("chosen_trade"):
            sync_chat_trade(p, prof["chosen_trade"])

    if "preferred_lang" in changes:
        with db.connect() as c:
            c.execute("UPDATE sessions SET language = ? WHERE user_id = ?", (changes["preferred_lang"], user_id))

    updated_user = await mongo.get_users_col().find_one({"_id": user["_id"]})
    updated_user["id"] = user_id
    return _me(updated_user)


@router.put("/me/consents")
def put_consents(body: ConsentIn, user: dict = Depends(auth.require())):
    user_id = str(user["id"])
    current = consents_for(user_id)
    row = {
        **{k: int(v) for k, v in body.model_dump().items()},
        "guardian_approved": current.get("guardian_approved") or 0,
        "updated_at": db.now(),
    }
    with db.connect() as c:
        c.execute(
            "INSERT OR REPLACE INTO consents (user_id, ai_guidance, counsellor_share, parent_link, research, "
            "guardian_approved, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, row["ai_guidance"], row["counsellor_share"], row["parent_link"], row["research"],
             row["guardian_approved"], row["updated_at"]),
        )
    return _me(user)


@router.post("/me/chat")
def my_chat(user: dict = Depends(auth.require("student", "parent"))):
    user_id = str(user["id"])
    if not consents_for(user_id).get("ai_guidance") and user["role"] == "student":
        raise HTTPException(403, "Turn on AI guidance in your privacy settings to chat with UDAAN")
    return {"session_id": ensure_chat(user)}


def _owned(user: dict) -> dict:
    """Collect all data associated with this user for export and deletion."""
    user_id = str(user["id"])
    p = db.one("SELECT * FROM student_profiles WHERE user_id = ?", (user_id,))
    pid = p and p["id"]
    sessions = db.query("SELECT * FROM sessions WHERE user_id = ?", (user_id,))
    sids = [s["id"] for s in sessions]
    marks = ",".join("?" for _ in sids) or "''"
    return {
        "user": {k: v for k, v in user.items() if k not in ("password_hash", "mobile_hash")},
        "consents": consents_for(user_id),
        "profile": p,
        "career_dna": pid and db.one("SELECT * FROM career_dna WHERE profile_id = ?", (pid,)),
        "simulation_attempts": pid and db.query("SELECT * FROM simulation_attempts WHERE profile_id = ?", (pid,)) or [],
        "guardian_links": db.query("SELECT * FROM guardian_links WHERE student_id = ? OR parent_id = ?", (pid or "", user_id)),
        "conversations": [{**s, "messages": db.get_messages(s["id"])} for s in sessions],
        "referrals": db.query(f"SELECT * FROM escalations WHERE session_id IN ({marks})", sids),
        "events": db.query("SELECT * FROM events WHERE user_id = ? OR profile_id = ?", (user_id, pid or "")),
    }


@router.get("/me/export")
def export_me(user: dict = Depends(auth.require("student", "parent"))):
    body = json.dumps({"exported_at": db.now(), **_owned(user)}, ensure_ascii=False, indent=2, default=str)
    return Response(
        body,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="udaan-my-data.json"'},
    )


@router.delete("/me")
async def delete_me(user: dict = Depends(auth.require("student", "parent"))):
    data = _owned(user)
    user_id = str(user["id"])
    pid = data["profile"] and data["profile"]["id"]
    sids = [s["id"] for s in data["conversations"]]
    link_ids = [lk["id"] for lk in data["guardian_links"]]

    # Delete from MongoDB
    users_col = mongo.get_users_col()
    tokens_col = mongo.get_tokens_col()
    otp_col = mongo.get_otp_col()
    norm_email = user.get("normalized_email") or security.normalize_email(user.get("email", ""))

    await users_col.delete_one({"_id": user["_id"]})
    await tokens_col.delete_many({"user_id": user_id})
    if norm_email:
        await otp_col.delete_many({"email": norm_email})

    # Delete from SQLite
    with db.connect() as c:
        for sid in sids:
            c.execute("DELETE FROM messages WHERE session_id = ?", (sid,))
            c.execute("DELETE FROM escalations WHERE session_id = ?", (sid,))
            c.execute("DELETE FROM updates WHERE session_id = ?", (sid,))
            c.execute("DELETE FROM sessions WHERE id = ?", (sid,))
        for lid in link_ids:
            c.execute("DELETE FROM consensus WHERE link_id = ?", (lid,))
            c.execute("DELETE FROM guardian_links WHERE id = ?", (lid,))
        if pid:
            for table, col in (("career_dna", "profile_id"), ("simulation_attempts", "profile_id"),
                               ("report_shares", "profile_id"), ("student_profiles", "id")):
                c.execute(f"DELETE FROM {table} WHERE {col} = ?", (pid,))
        c.execute("DELETE FROM events WHERE user_id = ? OR profile_id = ?", (user_id, pid or ""))
        for table, col in (("consents", "user_id"), ("auth_tokens", "user_id"), ("users", "id")):
            c.execute(f"DELETE FROM {table} WHERE {col} = ?", (user_id,))

    return {"deleted": True}
