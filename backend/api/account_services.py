from __future__ import annotations

import logging
from django.contrib.sessions.models import Session
from .models import Account, ArchivedAccount, MemberDatabaseRecord, PasswordResetToken, PreidentifiedEmail

logger = logging.getLogger(__name__)


def terminate_account_sessions(account_id: int) -> None:
    try:
        user_id_str = str(account_id)
        for session in Session.objects.iterator():
            try:
                data = session.get_decoded()
                if str(data.get("_auth_user_id")) == user_id_str:
                    session.delete()
            except Exception:
                continue
    except Exception as e:
        logger.warning("Error terminating sessions for account %s: %s", account_id, e)


def archive_and_reset_member_account(
    old_email: str,
    new_email: str,
    member: MemberDatabaseRecord | None = None,
    change_source: str = ArchivedAccount.ChangeSource.MEMBER_EDIT,
) -> bool:
    """
    When a member's email address is changed:
    1. If an existing Account was linked to old_email, creates an ArchivedAccount record.
    2. Terminates all active Django sessions for that account (logs them out immediately).
    3. Deletes the old Account record.
    4. Sets up a PreidentifiedEmail entry for new_email with default password 'dll347'.
    """
    old_norm = old_email.strip().lower() if old_email else ""
    new_norm = new_email.strip().lower() if new_email else ""

    if not new_norm or old_norm == new_norm:
        return False

    old_account = Account.objects.filter(email__iexact=old_norm).first() if old_norm else None
    role = old_account.role if old_account else Account.Role.MEMBER
    glp_id = (
        member.glp_id_number.strip()
        if member and member.glp_id_number
        else (old_account.glp_id_number.strip() if old_account else "")
    )

    if old_account:
        ArchivedAccount.objects.create(
            original_account_id=old_account.id,
            old_email=old_norm,
            new_email=new_norm,
            member_record=member,
            glp_id_number=glp_id,
            role=role,
            change_source=change_source,
        )

        PasswordResetToken.objects.filter(account=old_account).delete()
        terminate_account_sessions(old_account.pk)
        old_account.delete()

    if old_norm:
        PreidentifiedEmail.objects.filter(email__iexact=old_norm).delete()

    preidentified, _ = PreidentifiedEmail.objects.get_or_create(
        email=new_norm,
        defaults={"role": role},
    )
    preidentified.role = role
    preidentified.set_default_password("dll347")
    preidentified.save()

    return True
