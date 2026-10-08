import datetime
import json
import logging
import re
import threading
import urllib.error
import urllib.request

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

    keywords = [k.strip().lower() for k in config.search_keywords.split(",") if k.strip()]
    if q in keywords:
        return True

    # Also match if query specifically targets his name
    watched_name = (config.watched_name or "").strip().lower()
    if "franco" in q or (watched_name and watched_name in q):
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

    if target_member_id is not None and target_member_id == config.watched_member_id:
        return True

    if target_name:
        tn = target_name.strip().lower()
        watched = (config.watched_name or "").strip().lower()
        if "franco, mike angelo" in tn or "mike angelo franco" in tn or (watched and watched in tn):
            return True

    return False


def _send_discord_alert_worker(
    config_id: int,
    log_id: int,
    webhook_url: str,
    message: str,
    member_name: str,
) -> None:
    """Background worker sending HTTP POST to Discord webhook safely."""
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

        # Update config stats and log status
        ProfileAlertWebhookConfig.objects.filter(pk=config_id).update(
            total_triggers=models.F("total_triggers") + 1,
            last_triggered_at=timezone.now(),
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
) -> None:
    """Safely process alert trigger and dispatch webhook asynchronously."""
    try:
        config = ProfileAlertWebhookConfig.get_solo()
        if not config.is_enabled:
            return

        user = getattr(request, "user", None)
        actor_email = getattr(user, "email", "").strip().lower() if user else ""
        actor_id = getattr(user, "pk", None)

        # Check self-exclusion
        if config.ignore_self and user and getattr(user, "is_authenticated", False):
            self_email = (config.self_email or "").strip().lower()
            known_self_emails = {self_email, "mikeangelofranco@outlook.com", "mikeangelofranco@gmail.com"}
            if actor_email in known_self_emails or actor_id == 5:
                # Log skipped self-view without calling Discord
                ProfileAlertWebhookLog.objects.create(
                    config=config,
                    member_name=format_actor_name(user),
                    actor_email=actor_email,
                    trigger_type=trigger_type,
                    detail=f"Self-activity: {detail}"[:255],
                    message=format_alert_message(format_actor_name(user)),
                    status=ProfileAlertWebhookLog.Status.SKIPPED_SELF,
                    ip_address=request.META.get("REMOTE_ADDR") if request else None,
                    user_agent=request.headers.get("User-Agent", "")[:255] if request else "",
                )
                return

        member_name = format_actor_name(user)
        message = format_alert_message(member_name)

        # Cooldown check per actor to prevent rapid duplicates
        if config.cooldown_seconds > 0 and actor_email:
            cutoff = timezone.now() - datetime.timedelta(seconds=config.cooldown_seconds)
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
                )
                return

        # Create trigger event log
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
        )

        # Fire webhook in background thread
        thread = threading.Thread(
            target=_send_discord_alert_worker,
            args=(config.pk, log_entry.pk, config.webhook_url, message, member_name),
            daemon=True,
        )
        thread.start()

    except Exception:
        logger.exception("Unexpected error in dispatch_profile_alert")


def trigger_profile_search_alert(request, search_query: str) -> None:
    """Trigger alert if search query matches watched keywords."""
    try:
        config = ProfileAlertWebhookConfig.get_solo()
        if is_watched_search(search_query, config):
            dispatch_profile_alert(
                request=request,
                trigger_type="search",
                detail=f"Searched: {search_query.strip()}",
            )
    except Exception:
        logger.exception("Error checking profile search alert")


def trigger_profile_view_alert(
    request,
    target_member_id: int | None = None,
    target_name: str = "",
) -> None:
    """Trigger alert if opened profile is Mike Angelo Franco."""
    try:
        config = ProfileAlertWebhookConfig.get_solo()
        if is_watched_profile(target_member_id=target_member_id, target_name=target_name, config=config):
            detail = f"Profile viewed: ID={target_member_id or 'N/A'}"
            if target_name:
                detail += f" ({target_name})"
            dispatch_profile_alert(
                request=request,
                trigger_type="profile_view",
                detail=detail,
                target_member_id=target_member_id,
                target_name=target_name,
            )
    except Exception:
        logger.exception("Error checking profile view alert")


def send_test_discord_alert(config: ProfileAlertWebhookConfig, admin_user) -> tuple[bool, str]:
    """Synchronously send a test alert from Django admin to verify webhook setup."""
    member_name = format_actor_name(admin_user)
    message = format_alert_message(member_name)
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
        config.last_triggered_at = timezone.now()
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
        )
        return False, err_msg
    except Exception as e:
        err_msg = str(e)[:300]
        config.last_error = err_msg
        config.save()
        return False, err_msg
