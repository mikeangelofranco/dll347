from django.conf import settings
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired

from .models import Account

PASSWORD_RESET_SALT = "dll347.password-reset"


def build_password_reset_token(account: Account) -> str:
    payload = {
        "email": account.email,
        "password": account.password,
        "updated_at": account.updated_at.isoformat(),
    }
    return signing.dumps(payload, salt=PASSWORD_RESET_SALT)


def get_account_from_password_reset_token(token: str) -> Account | None:
    try:
        payload = signing.loads(
            token,
            salt=PASSWORD_RESET_SALT,
            max_age=settings.PASSWORD_RESET_LINK_EXPIRY_MINUTES * 60,
        )
    except (BadSignature, SignatureExpired):
        return None

    account = (
        Account.objects.filter(email=payload.get("email"))
        .only("id", "email", "password", "updated_at", "is_active", "role", "is_staff", "is_superuser")
        .first()
    )
    if account is None or not account.is_active:
        return None

    if account.password != payload.get("password"):
        return None

    if account.updated_at.isoformat() != payload.get("updated_at"):
        return None

    return account


def build_password_reset_url(token: str) -> str:
    frontend_base_url = getattr(settings, "FRONTEND_APP_URL", "http://127.0.0.1:3000").rstrip("/")
    return f"{frontend_base_url}/reset-password?token={token}"
