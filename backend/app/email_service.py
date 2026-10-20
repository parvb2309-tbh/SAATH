"""Reusable email service using async SMTP (aiosmtplib) with HTML and plain text bodies."""
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import aiosmtplib

from . import config

logger = logging.getLogger("saath.email")


class EmailDeliveryError(Exception):
    """Raised when email delivery fails."""
    pass


# In-memory storage for test inspection when mocking email
sent_emails_mock: list[dict] = []


def clear_mock_emails():
    sent_emails_mock.clear()


async def send_email(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    """Send an email using SMTP or record in mock buffer."""
    if config.MOCK_EMAIL:
        logger.info("MOCK_EMAIL active: Simulating email delivery to %s [Subject: %s]", to_email, subject)
        sent_emails_mock.append({
            "to": to_email,
            "subject": subject,
            "text": text_body,
            "html": html_body,
        })
        return True

    msg = MIMEMultipart("alternative")
    msg["From"] = config.SMTP_FROM_EMAIL or config.SMTP_USERNAME
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        use_tls = config.SMTP_PORT == 465
        start_tls = config.SMTP_PORT in (587, 25)

        await aiosmtplib.send(
            msg,
            hostname=config.SMTP_HOST,
            port=config.SMTP_PORT,
            username=config.SMTP_USERNAME or None,
            password=config.SMTP_PASSWORD or None,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=15,
        )
        logger.info("Email delivered successfully to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to deliver email to %s: %s", to_email, str(e))
        raise EmailDeliveryError(f"Could not deliver email: {str(e)}") from e


async def send_verification_otp(to_email: str, code: str, expire_minutes: int | None = None) -> bool:
    """Send 6-digit signup verification OTP."""
    exp = expire_minutes or config.OTP_EXPIRE_MINUTES
    subject = "Your SAATH Verification Code"

    text_body = f"""Hello,

Welcome to SAATH!

Your 6-digit email verification code is: {code}

This code will expire in {exp} minutes. Please enter it on the verification screen to activate your account.

If you did not request this verification code, please ignore this email.

Best regards,
The SAATH Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #1a202c; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .title {{ font-size: 22px; font-weight: 700; color: #1e3a8a; margin: 0; }}
    .subtitle {{ font-size: 14px; color: #64748b; margin-top: 4px; }}
    .otp-card {{ background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #15803d; font-family: monospace; }}
    .meta {{ font-size: 13px; color: #475569; margin-top: 8px; }}
    .warning {{ font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">SAATH · UDAAN</h1>
      <div class="subtitle">Email Verification</div>
    </div>
    <p>Welcome! Please use the following 6-digit verification code to complete your registration:</p>
    <div class="otp-card">
      <div class="otp-code">{code}</div>
      <div class="meta">Valid for <strong>{exp} minutes</strong> (Single-use)</div>
    </div>
    <p class="meta">Do not share this code with anyone. SAATH team members will never ask for your verification code.</p>
    <div class="warning">
      If you did not sign up for SAATH, you can safely ignore this message.
    </div>
  </div>
</body>
</html>
"""
    return await send_email(to_email, subject, text_body, html_body)


async def send_password_reset_otp(to_email: str, code: str, expire_minutes: int | None = None) -> bool:
    """Send 6-digit password reset OTP."""
    exp = expire_minutes or config.OTP_EXPIRE_MINUTES
    subject = "Reset Your SAATH Password"

    text_body = f"""Hello,

We received a request to reset the password for your SAATH account.

Your password reset code is: {code}

This code will expire in {exp} minutes. Enter this code along with your new password to reset your credentials.

If you did not request a password reset, please secure your account immediately.

Best regards,
The SAATH Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7fafc; margin: 0; padding: 20px; color: #1a202c; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .title {{ font-size: 22px; font-weight: 700; color: #1e3a8a; margin: 0; }}
    .subtitle {{ font-size: 14px; color: #64748b; margin-top: 4px; }}
    .otp-card {{ background: #eff6ff; border: 2px dashed #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #1d4ed8; font-family: monospace; }}
    .meta {{ font-size: 13px; color: #475569; margin-top: 8px; }}
    .warning {{ font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">SAATH · UDAAN</h1>
      <div class="subtitle">Password Reset Request</div>
    </div>
    <p>We received a request to reset your password. Use the following code to choose a new password:</p>
    <div class="otp-card">
      <div class="otp-code">{code}</div>
      <div class="meta">Valid for <strong>{exp} minutes</strong> (Single-use)</div>
    </div>
    <p class="meta">If you did not request this change, please ignore this email. Your current password remains unchanged.</p>
    <div class="warning">
      Do not share this code with anyone.
    </div>
  </div>
</body>
</html>
"""
    return await send_email(to_email, subject, text_body, html_body)
