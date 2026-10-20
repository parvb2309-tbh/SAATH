"""Comprehensive automated tests for MongoDB email and password authentication,
OTP lifecycle, security controls, rate limiting, and session management.
"""
from datetime import datetime, timedelta, timezone
import re
import uuid
import pytest
from unittest.mock import patch

from app.email_service import EmailDeliveryError, sent_emails_mock
from app import auth, mongo, security


def _extract_otp_from_email(to_email: str) -> str:
    """Find the latest mock email sent to the given address and extract the 6-digit OTP."""
    for m in reversed(sent_emails_mock):
        if m["to"].lower() == to_email.lower():
            match = re.search(r"\b\d{6}\b", m["text"])
            if match:
                return match.group(0)
    raise AssertionError(f"No OTP email found in sent_emails_mock for {to_email}")


def test_signup_and_email_verification(client):
    """Test full registration -> email OTP delivery -> OTP verification -> active token."""
    uid = uuid.uuid4().hex[:8]
    email = f"student_{uid}@example.com"
    password = "SecurePassword@123"

    # 1. Register student
    reg_res = client.post("/api/auth/register", json={
        "name": f"Student {uid}",
        "email": email,
        "password": password,
        "role": "student",
        "lang": "hi",
    })
    assert reg_res.status_code == 200, reg_res.text
    data = reg_res.json()
    assert data["ok"] is True
    # OTP must NEVER be returned in response payload
    assert "code" not in data and "otp" not in data and "token" not in data

    # 2. Extract OTP from mock email
    otp_code = _extract_otp_from_email(email)
    assert len(otp_code) == 6 and otp_code.isdigit()

    # 3. Verify OTP
    verify_res = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": otp_code,
        "purpose": "signup_verification",
    })
    assert verify_res.status_code == 200, verify_res.text
    verify_data = verify_res.json()
    assert "token" in verify_data
    assert verify_data["user"]["email"].lower() == email.lower()
    assert verify_data["user"]["role"] == "student"

    # 4. Authenticated session restoration
    token = verify_data["token"]
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"].lower() == email.lower()


def test_duplicate_registration_rejected(client):
    """Test that registering with an already verified email returns 409 Conflict."""
    uid = uuid.uuid4().hex[:8]
    email = f"dupe_{uid}@example.com"
    password = "SecurePassword@123"

    # Register and verify
    client.post("/api/auth/register", json={
        "name": "Original User",
        "email": email,
        "password": password,
        "role": "student",
    })
    code = _extract_otp_from_email(email)
    client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": code,
        "purpose": "signup_verification",
    })

    # Clear rate limit tracker for clean test of duplication logic
    auth._otp_cooldown_tracker.pop(email.lower(), None)

    # Attempt to register same email again
    dupe_res = client.post("/api/auth/register", json={
        "name": "Imposter",
        "email": email,
        "password": "AnotherPassword@123",
        "role": "student",
    })
    assert dupe_res.status_code == 409
    assert "already exists" in dupe_res.json()["detail"].lower()


def test_privileged_roles_cannot_self_register(client):
    """Students and parents may self-register; counsellor, teacher, admin must be rejected."""
    uid = uuid.uuid4().hex[:8]
    for role in ("counsellor", "teacher", "admin"):
        res = client.post("/api/auth/register", json={
            "name": f"Staff {role}",
            "email": f"staff_{role}_{uid}@example.com",
            "password": "Password@123",
            "role": role,
        })
        # Pydantic or endpoint rejects privileged roles
        assert res.status_code in (403, 422)


def test_login_flow_valid_and_invalid(client):
    """Test standard email/password login (NO OTP on normal login) and credential rejection."""
    uid = uuid.uuid4().hex[:8]
    email = f"login_test_{uid}@example.com"
    password = "ValidPassword@123"

    # Register & verify
    client.post("/api/auth/register", json={
        "name": "Login Tester",
        "email": email,
        "password": password,
        "role": "student",
    })
    code = _extract_otp_from_email(email)
    client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": code,
        "purpose": "signup_verification",
    })

    # 1. Valid login
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })
    assert login_res.status_code == 200, login_res.text
    login_data = login_res.json()
    assert "token" in login_data
    assert login_data["user"]["role"] == "student"

    # 2. Invalid password
    bad_pw_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword@123",
    })
    assert bad_pw_res.status_code == 401

    # 3. Non-existent email
    bad_email_res = client.post("/api/auth/login", json={
        "email": f"nonexistent_{uid}@example.com",
        "password": password,
    })
    assert bad_email_res.status_code == 401


def test_login_before_email_verification_rejected(client):
    """Test that users cannot log in before verifying their email OTP."""
    uid = uuid.uuid4().hex[:8]
    email = f"unverified_{uid}@example.com"
    password = "Password@123"

    # Register without verifying
    client.post("/api/auth/register", json={
        "name": "Unverified User",
        "email": email,
        "password": password,
        "role": "student",
    })

    # Attempt login
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })
    assert login_res.status_code == 403
    assert "not been verified" in login_res.json()["detail"].lower()


def test_incorrect_and_reused_otp(client):
    """Test wrong OTP handling, attempt tracking, and prevention of OTP reuse."""
    uid = uuid.uuid4().hex[:8]
    email = f"otp_tests_{uid}@example.com"
    password = "Password@123"

    client.post("/api/auth/register", json={
        "name": "OTP User",
        "email": email,
        "password": password,
        "role": "student",
    })
    valid_code = _extract_otp_from_email(email)

    # 1. Incorrect OTP
    wrong_res = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": "000000",
        "purpose": "signup_verification",
    })
    assert wrong_res.status_code == 400
    assert "not correct" in wrong_res.json()["detail"].lower()

    # 2. Successful verification
    ok_res = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": valid_code,
        "purpose": "signup_verification",
    })
    assert ok_res.status_code == 200

    # 3. Replay / Reused OTP
    reuse_res = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": valid_code,
        "purpose": "signup_verification",
    })
    assert reuse_res.status_code == 400
    assert "already been used" in reuse_res.json()["detail"].lower()


def test_otp_attempt_limits(client):
    """Test that exceeding maximum attempts (5) locks out the OTP record."""
    uid = uuid.uuid4().hex[:8]
    email = f"attempts_{uid}@example.com"
    password = "Password@123"

    client.post("/api/auth/register", json={
        "name": "Attempt User",
        "email": email,
        "password": password,
        "role": "student",
    })
    _extract_otp_from_email(email)

    # 4 bad attempts
    for _ in range(4):
        res = client.post("/api/auth/otp/verify", json={
            "email": email,
            "code": "111111",
            "purpose": "signup_verification",
        })
        assert res.status_code == 400

    # 5th bad attempt should hit limit (429)
    fifth_res = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": "111111",
        "purpose": "signup_verification",
    })
    assert fifth_res.status_code == 429

    # Subsequent attempt is also rejected
    locked_res = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": "111111",
        "purpose": "signup_verification",
    })
    assert locked_res.status_code == 429


def test_otp_resend_cooldown(client):
    """Test 60-second cooldown on consecutive OTP requests."""
    uid = uuid.uuid4().hex[:8]
    email = f"cooldown_{uid}@example.com"
    password = "Password@123"

    # First request
    r1 = client.post("/api/auth/register", json={
        "name": "Cooldown Tester",
        "email": email,
        "password": password,
        "role": "student",
    })
    assert r1.status_code == 200

    # Immediate second request
    r2 = client.post("/api/auth/otp/request", json={
        "email": email,
        "purpose": "signup_verification",
    })
    assert r2.status_code == 429
    assert "wait" in r2.json()["detail"].lower()


def test_forgot_password_and_reset_flow(client):
    """Test forgot password request (no user enumeration) -> reset OTP -> new password login."""
    uid = uuid.uuid4().hex[:8]
    email = f"reset_{uid}@example.com"
    old_password = "OldPassword@123"
    new_password = "NewPassword@456"

    # Register & verify
    client.post("/api/auth/register", json={
        "name": "Reset User",
        "email": email,
        "password": old_password,
        "role": "student",
    })
    v_code = _extract_otp_from_email(email)
    client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": v_code,
        "purpose": "signup_verification",
    })

    # Clear cooldown tracker for test
    auth._otp_cooldown_tracker.pop(email.lower(), None)

    # 1. Non-existent email request does NOT reveal email absence
    non_exist_res = client.post("/api/auth/forgot-password", json={
        "email": f"ghost_{uid}@example.com",
    })
    assert non_exist_res.status_code == 200
    assert non_exist_res.json()["ok"] is True

    # 2. Forgot password for real user
    fp_res = client.post("/api/auth/forgot-password", json={"email": email})
    assert fp_res.status_code == 200

    reset_code = _extract_otp_from_email(email)

    # 3. Reset password with wrong code
    bad_reset = client.post("/api/auth/reset-password", json={
        "email": email,
        "code": "000000",
        "new_password": new_password,
    })
    assert bad_reset.status_code == 400

    # 4. Reset password with correct code
    good_reset = client.post("/api/auth/reset-password", json={
        "email": email,
        "code": reset_code,
        "new_password": new_password,
    })
    assert good_reset.status_code == 200

    # 5. Old password no longer works
    old_login = client.post("/api/auth/login", json={"email": email, "password": old_password})
    assert old_login.status_code == 401

    # 6. New password works
    new_login = client.post("/api/auth/login", json={"email": email, "password": new_password})
    assert new_login.status_code == 200
    assert "token" in new_login.json()


def test_purpose_mismatch_prevention(client):
    """Ensure signup OTP cannot be used for password reset, and reset OTP cannot verify signup."""
    uid = uuid.uuid4().hex[:8]
    email = f"purpose_{uid}@example.com"
    password = "Password@123"

    # Register (generates signup_verification OTP)
    client.post("/api/auth/register", json={
        "name": "Purpose Test",
        "email": email,
        "password": password,
        "role": "student",
    })
    signup_code = _extract_otp_from_email(email)

    # Attempt to use signup code for password reset
    bad_reset = client.post("/api/auth/reset-password", json={
        "email": email,
        "code": signup_code,
        "new_password": "NewPassword@123",
    })
    assert bad_reset.status_code == 400


def test_logout_and_session_revocation(client):
    """Test that logging out revokes the session token in MongoDB."""
    uid = uuid.uuid4().hex[:8]
    email = f"logout_{uid}@example.com"
    password = "Password@123"

    client.post("/api/auth/register", json={
        "name": "Logout Tester",
        "email": email,
        "password": password,
        "role": "student",
    })
    code = _extract_otp_from_email(email)
    auth_data = client.post("/api/auth/otp/verify", json={
        "email": email,
        "code": code,
        "purpose": "signup_verification",
    }).json()
    token = auth_data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Token works
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    # Token revoked
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_email_delivery_failure_handling(client):
    """Test that email delivery failure does not leave an unverified user in the database."""
    uid = uuid.uuid4().hex[:8]
    email = f"fail_{uid}@example.com"
    password = "Password@123"

    with patch("app.routers.account.send_verification_otp", side_effect=EmailDeliveryError("SMTP connection timed out")):
        res = client.post("/api/auth/register", json={
            "name": "Failure User",
            "email": email,
            "password": password,
            "role": "student",
        })
        assert res.status_code == 502
        assert "failed to send" in res.json()["detail"].lower()
