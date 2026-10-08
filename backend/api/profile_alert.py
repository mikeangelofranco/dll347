import datetime
import json
import logging
import re
import sys
import threading
import urllib.error
import urllib.request

from django.conf import settings
from django.db import models
from django.utils import timezone

from .models import MemberDatabaseRecord, ProfileAlertWebhookConfig, ProfileAlertWebhookLog

logger = logging.getLogger(__name__)


def format_member_display_name(raw_name: str) -> str:
    """Format stored database name ('Lastname, Firstname M.') into readable display name."""
    if not raw_name:
        return "Unknown Member"
    clean = re.sub(r"^(Mr\.|FCM|EAM|Bro\.|Brother)\s+", "", raw_name.strip(), flags=re.IGNORECASE)
    clean = clean.replace("+", "").replace("*", "").strip()
    if "," in clean:
        parts = clean.split(",", 1)
        last_name = parts[0].strip()
        first_name = parts[1].strip() if len(parts) > 1 else ""
        return f"{first_name} {last_name}".strip()
    return clean or raw_name.strip()


def format_actor_name(user) -> str:
    """Resolve the display Member Name for the current user."""
    if not user or not getattr(user, "is_authenticated", False):
        return "Unknown Visitor"
    email = getattr(user, "email", "").strip()
    if email:
        member = MemberDatabaseRecord.objects.filter(email__iexact=email).first()
        if member and member.name.strip():
            return format_member_display_name(member.name)
    full_name = getattr(user, "get_full_name", lambda: "")()
    return full_name.strip() or email or f"User #{user.pk}"


def format_alert_message(member_name: str, trigger_time: datetime.datetime | None = None) -> str:
    """
    Generate alert message in format:
    Your profile has been checked by [Member Name] - [Time]

    The [Time] reflects the exact timestamp the profile was actually viewed.
    """
    if trigger_time is None:
        trigger_time = timezone.localtime(timezone.now())
    else:
        trigger_time = timezone.localtime(trigger_time)

    time_str = trigger_time.strftime("%B %d, %Y, %I:%M %p")
    return f"Your profile has been checked by {member_name} - {time_str}"


def is_watched_search(search_query: str, config: ProfileAlertWebhookConfig) -> bool:
    """
    Determine if search query specifically matches 'mike', 'Mike', 'mic',
    or configured keywords / user name.
    """
    if not search_query:
        return False
    q = search_query.strip().lower()
    if not q:
        return False

    # Exact matches for configured keywords ('mike', 'mic')
    keywords = {k.strip().lower() for k in config.search_keywords.split(",") if k.strip()}
    if q in keywords:
        return True

    # Exact match for full name or surname
    watched_name = (config.watched_name or "").strip().lower()
    if q in {"franco", "mike franco"} or (watched_name and q == watched_name):
        return True

    return False


def is_watched_profile(
    target_member_id: int | None = None,
    target_name: str = "",
    config: ProfileAlertWebhookConfig | None = None,
) -> bool:
    """Determine if accessed profile is Mike Angelo Franco."""
    if config is None:
        config = ProfileAlertWebhookConfig.get_solo()

    if target_name:
        tn = target_name.strip().lower()
        if "franco, mike angelo" in tn or "mike angelo franco" in tn:
            return True

    if target_member_id is not None:
        member = MemberDatabaseRecord.objects.filter(pk=target_member_id).first()
        if member:
            # Never trigger for mock/test records outside test runner
            if member.is_test_record and not (getattr(settings, "TESTING", False) or "test" in sys.argv):
                return False
            m_name = member.name.lower()
            m_email = member.email.lower()
            if "franco, mike angelo" in m_name or "mike angelo franco" in m_name:
                return True
            if m_email in {"mikeangelofranco@gmail.com", "mikeangelofranco@outlook.com"}:
                return True

        if target_member_id == config.watched_member_id:
            return True

    return False


def _send_discord_alert_worker(
    config_id: int,
    log_id: int,
    webhook_url: str,
    message: str,
    member_name: str,
    event_time: datetime.datetime,
) -> None:
    """Background worker sending HTTP POST to Discord webhook safely."""
    # Test runner guard: never call Discord during test runs or if disabled
    if (
        getattr(settings, "TESTING", False)
        or "test" in sys.argv
        or "pytest" in sys.modules
        or getattr(settings, "DISABLE_WEBHOOK_CALLS", False)
    ):
        ProfileAlertWebhookLog.objects.filter(pk=log_id).update(
            status=ProfileAlertWebhookLog.Status.SUCCESS,
            status_code=204,
        )
        return

    try:
        payload = json.dumps({"content": message}).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "DLL347-ProfileAlert/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            status_code = resp.status

        # Update config stats with the actual view time and member
        ProfileAlertWebhookConfig.objects.filter(pk=config_id).update(
            total_triggers=models.F("total_triggers") + 1,
            last_triggered_at=event_time,
            last_triggered_by=member_name[:255],
            last_status_code=status_code,
            last_error="",
        )
        ProfileAlertWebhookLog.objects.filter(pk=log_id).update(
            status=ProfileAlertWebhookLog.Status.SUCCESS,
            status_code=status_code,
        )
    except urllib.error.HTTPError as e:
        err_msg = f"HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')[:300]}"
        logger.warning("Discord webhook error: %s", err_msg)
        ProfileAlertWebhookConfig.objects.filter(pk=config_id).update(
            last_status_code=e.code,
            last_error=err_msg,
        )
        ProfileAlertWebhookLog.objects.filter(pk=log_id).update(
            status=ProfileAlertWebhookLog.Status.FAILED,
            status_code=e.code,
            error_message=err_msg,
        )
    except Exception as e:
        err_msg = str(e)[:300]
        logger.warning("Discord webhook exception: %s", err_msg)
        ProfileAlertWebhookConfig.objects.filter(pk=config_id).update(
            last_error=err_msg,
        )
        ProfileAlertWebhookLog.objects.filter(pk=log_id).update(
            status=ProfileAlertWebhookLog.Status.FAILED,
            error_message=err_msg,
        )


def dispatch_profile_alert(
    request,
    trigger_type: str,
    detail: str = "",
    target_member_id: int | None = None,
    target_name: str = "",
    event_time: datetime.datetime | None = None,
) -> None:
    """
    Safely process alert trigger and dispatch webhook asynchronously.
    Strictly backend-only with no visibility to frontend users.
    """
    try:
        config = ProfileAlertWebhookConfig.get_solo()
        if not config.is_enabled:
            return

        # Capture actual view/search timestamp if not provided
        if event_time is None:
            event_time = timezone.localtime(timezone.now())

        user = getattr(request, "user", None)
        actor_email = getattr(user, "email", "").strip().lower() if user else ""
        actor_id = getattr(user, "pk", None)

        # Self-exclusion: do not alert if Mike himself viewed or searched
        if config.ignore_self and user and getattr(user, "is_authenticated", False):
            self_email = (config.self_email or "").strip().lower()
            known_self_emails = {self_email, "mikeangelofranco@outlook.com", "mikeangelofranco@gmail.com"}
            if actor_email in known_self_emails or actor_id == 5:
                ProfileAlertWebhookLog.objects.create(
                    config=config,
                    member_name=format_actor_name(user),
                    actor_email=actor_email,
                    trigger_type=trigger_type,
                    detail=f"Self-activity: {detail}"[:255],
                    message=format_alert_message(format_actor_name(user), trigger_time=event_time),
                    status=ProfileAlertWebhookLog.Status.SKIPPED_SELF,
                    ip_address=request.META.get("REMOTE_ADDR") if request else None,
                    user_agent=request.headers.get("User-Agent", "")[:255] if request else "",
                    created_at=event_time,
                )
                return

        member_name = format_actor_name(user)
        # Message explicitly records the actual view time
        message = format_alert_message(member_name, trigger_time=event_time)

        # Cooldown check per actor to prevent rapid duplicate alerts
        if config.cooldown_seconds > 0 and actor_email:
            cutoff = event_time - datetime.timedelta(seconds=config.cooldown_seconds)
            recent = ProfileAlertWebhookLog.objects.filter(
                actor_email=actor_email,
                status=ProfileAlertWebhookLog.Status.SUCCESS,
                created_at__gte=cutoff,
            ).exists()
            if recent:
                ProfileAlertWebhookLog.objects.create(
                    config=config,
                    member_name=member_name,
                    actor_email=actor_email,
                    trigger_type=trigger_type,
                    detail=f"Cooldown active: {detail}"[:255],
                    message=message,
                    status=ProfileAlertWebhookLog.Status.SKIPPED_COOLDOWN,
                    ip_address=request.META.get("REMOTE_ADDR") if request else None,
                    user_agent=request.headers.get("User-Agent", "")[:255] if request else "",
                    created_at=event_time,
                )
                return

        # Create trigger event log with the actual view timestamp
        log_entry = ProfileAlertWebhookLog.objects.create(
            config=config,
            member_name=member_name,
            actor_email=actor_email,
            trigger_type=trigger_type,
            detail=detail[:255],
            message=message,
            status=ProfileAlertWebhookLog.Status.SUCCESS,
            ip_address=request.META.get("REMOTE_ADDR") if request else None,
            user_agent=request.headers.get("User-Agent", "")[:255] if request else "",
            created_at=event_time,
        )

        # Test environment safety guard: never spawn background thread or call Discord during test runs
        is_test_env = (
            getattr(settings, "TESTING", False)
            or "test" in sys.argv
            or "pytest" in sys.modules
            or getattr(settings, "DISABLE_WEBHOOK_CALLS", False)
        )
        if is_test_env:
            log_entry.status = ProfileAlertWebhookLog.Status.SUCCESS
            log_entry.status_code = 204
            log_entry.save(update_fields=["status", "status_code"])
            return

        # Fire webhook in background daemon thread
        thread = threading.Thread(
            target=_send_discord_alert_worker,
            args=(config.pk, log_entry.pk, config.webhook_url, message, member_name, event_time),
            daemon=True,
        )
        thread.start()

    except Exception:
        logger.exception("Unexpected error in dispatch_profile_alert")


def trigger_profile_search_alert(
    request,
    search_query: str,
    event_time: datetime.datetime | None = None,
) -> None:
    """Trigger alert when someone specifically searches 'mike', 'Mike', 'mic', or name."""
    try:
        # Record the exact instant the search was performed
        if event_time is None:
            event_time = timezone.localtime(timezone.now())
        else:
            event_time = timezone.localtime(event_time)

        config = ProfileAlertWebhookConfig.get_solo()
        if is_watched_search(search_query, config):
            dispatch_profile_alert(
                request=request,
                trigger_type="search",
                detail=f"Specifically searched: '{search_query.strip()}'",
                event_time=event_time,
            )
    except Exception:
        logger.exception("Error checking profile search alert")


def trigger_profile_view_alert(
    request,
    target_member_id: int | None = None,
    target_name: str = "",
    event_time: datetime.datetime | None = None,
) -> None:
    """Trigger alert when Mike Angelo Franco's profile is actually opened."""
    try:
        # Record the exact instant the actual profile view occurred
        if event_time is None:
            event_time = timezone.localtime(timezone.now())
        else:
            event_time = timezone.localtime(event_time)

        config = ProfileAlertWebhookConfig.get_solo()
        if is_watched_profile(target_member_id=target_member_id, target_name=target_name, config=config):
            detail = f"Actual profile opened (ID {target_member_id or 'N/A'})"
            dispatch_profile_alert(
                request=request,
                trigger_type="profile_view",
                detail=detail,
                target_member_id=target_member_id,
                target_name=target_name,
                event_time=event_time,
            )
    except Exception:
        logger.exception("Error checking profile view alert")


def send_test_discord_alert(config: ProfileAlertWebhookConfig, admin_user) -> tuple[bool, str]:
    """Synchronously send a test alert from Django admin to verify webhook setup."""
    test_time = timezone.localtime(timezone.now())
    member_name = format_actor_name(admin_user)
    message = format_alert_message(member_name, trigger_time=test_time)
    try:
        payload = json.dumps({"content": f"🔔 [TEST ALERT] {message}"}).encode("utf-8")
        req = urllib.request.Request(
            config.webhook_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "DLL347-ProfileAlert-Test/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            status_code = resp.status

        config.total_triggers += 1
        config.last_triggered_at = test_time
        config.last_triggered_by = f"Test: {member_name}"
        config.last_status_code = status_code
        config.last_error = ""
        config.save()

        ProfileAlertWebhookLog.objects.create(
            config=config,
            member_name=f"Test: {member_name}",
            actor_email=getattr(admin_user, "email", ""),
            trigger_type="admin_test",
            detail="Admin test alert triggered manually",
            message=message,
            status=ProfileAlertWebhookLog.Status.SUCCESS,
            status_code=status_code,
            created_at=test_time,
        )
        return True, f"HTTP {status_code}"
    except urllib.error.HTTPError as e:
        err_msg = f"HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')[:300]}"
        config.last_status_code = e.code
        config.last_error = err_msg
        config.save()
        ProfileAlertWebhookLog.objects.create(
            config=config,
            member_name=f"Test: {member_name}",
            actor_email=getattr(admin_user, "email", ""),
            trigger_type="admin_test",
            detail="Admin test alert failed",
            message=message,
            status=ProfileAlertWebhookLog.Status.FAILED,
            status_code=e.code,
            error_message=err_msg,
            created_at=test_time,
        )
        return False, err_msg
    except Exception as e:
        err_msg = str(e)[:300]
        config.last_error = err_msg
        config.save()
        return False, err_msg
