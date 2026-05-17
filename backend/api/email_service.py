from __future__ import annotations

from django.conf import settings


class EmailDeliveryError(Exception):
    pass


def send_password_reset_email(to_email: str, reset_link: str) -> dict:
    api_key = getattr(settings, "RESEND_API_KEY", None) or settings.__dict__.get("RESEND_API_KEY")
    if not api_key:
        raise EmailDeliveryError("RESEND_API_KEY is missing.")

    try:
        import resend
    except ImportError as exc:
        raise EmailDeliveryError("The resend package is not installed.") from exc

    resend.api_key = api_key
    expiry_minutes = settings.PASSWORD_RESET_LINK_EXPIRY_MINUTES

    text_body = (
        "Dear Brother,\n\n"
        "We received a request to reset the password for your DLL347 account.\n\n"
        "Please click the link below to set a new password:\n\n"
        f"{reset_link}\n\n"
        f"For your security, this link will expire in {expiry_minutes} minutes.\n\n"
        "If you did not request this password reset, you may safely ignore this email. "
        "Your account will remain secure.\n\n"
        "Thank you,\n\n"
        "Datu Lapu-Lapu Masonic Lodge No. 347"
    )

    html_body = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f160f;line-height:1.75">
      <p>Dear Brother,</p>
      <p>We received a request to reset the password for your DLL347 account.</p>
      <p>Please click the link below to set a new password:</p>
      <p>
        <a href="{reset_link}" style="color:#b00000;font-weight:700;text-decoration:none;">
          Reset Your DLL347 Password
        </a>
      </p>
      <p>For your security, this link will expire in {expiry_minutes} minutes.</p>
      <p>
        If you did not request this password reset, you may safely ignore this email.
        Your account will remain secure.
      </p>
      <p>Thank you,</p>
      <p>Datu Lapu-Lapu Masonic Lodge No. 347</p>
    </div>
    """

    params: resend.Emails.SendParams = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [to_email],
        "subject": "Reset Your DLL347 Password",
        "html": html_body,
        "text": text_body,
    }

    try:
        response = resend.Emails.send(params)
    except Exception as exc:
        raise EmailDeliveryError("Failed to send password reset email.") from exc

    return response
