import secrets

from django.conf import settings
from django.utils import timezone

from .models import Account, PasswordResetToken


def build_password_reset_token(account: Account) -> str:
    PasswordResetToken.objects.filter(account=account).delete()
    raw_token = secrets.token_urlsafe(32)
    PasswordResetToken.objects.create(account=account, token=raw_token)
    return raw_token


def get_account_from_password_reset_token(token: str) -> Account | None:
    if not token:
        return None

    reset_token = (
        PasswordResetToken.objects.select_related("account")
        .filter(token=token)
        .first()
    )
    if reset_token is None:
        return None

    expiry_seconds = settings.PASSWORD_RESET_LINK_EXPIRY_MINUTES * 60
    age = (timezone.now() - reset_token.created_at).total_seconds()
    if age > expiry_seconds:
        reset_token.delete()
        return None

    account = reset_token.account
    if not account.is_active:
        return None

    return account


def invalidate_password_reset_tokens(account: Account) -> int:
    deleted, _ = PasswordResetToken.objects.filter(account=account).delete()
    return deleted


def build_password_reset_url(token: str) -> str:
    frontend_base_url = getattr(settings, "FRONTEND_APP_URL", "http://127.0.0.1:3000").rstrip("/")
    return f"{frontend_base_url}/reset-password?token={token}"
