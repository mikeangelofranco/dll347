from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count, OuterRef, Subquery
from django.utils import timezone

from .models import (
    Account,
    AuditLog,
    BallotingCoinRecord,
    LodgeActivity,
    LodgeVisitorRecord,
    MemberDatabaseRecord,
    MemberPositionHeld,
    MembersWorkbookImport,
    MembersWorkbookSheetSchema,
    PasswordResetToken,
    PreidentifiedEmail,
    ToolAccessLog,
)


@admin.register(Account)
class AccountAdmin(UserAdmin):
    ordering = ("id",)
    list_display = ("id", "email", "role", "is_active", "last_login", "last_app_activity", "last_viewed_screen")
    list_filter = ("role", "can_manage_activities", "can_edit_members", "is_active", "is_staff")
    search_fields = ("email",)
    actions = ("unlock_accounts",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Access", {"fields": ("role", "can_manage_activities", "can_edit_members", "is_active", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
        ("Lockout", {"fields": ("failed_login_attempts", "locked_until")}),
        ("Audit", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    readonly_fields = ("last_login", "created_at", "updated_at", "failed_login_attempts", "locked_until")

    @admin.action(description="Unlock selected accounts")
    def unlock_accounts(self, request, queryset):
        updated = queryset.update(failed_login_attempts=0, locked_until=None)
        self.message_user(request, f"{updated} account(s) unlocked.")

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "role", "can_manage_activities", "can_edit_members", "password1", "password2", "is_active", "is_staff"),
            },
        ),
    )

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        recent_activity = AuditLog.objects.filter(
            actor=OuterRef("pk"),
            action__in=(AuditLog.Action.APP_OPEN, AuditLog.Action.SCREEN_VIEW),
        ).order_by("-created_at", "-id")
        recent_screen = AuditLog.objects.filter(
            actor=OuterRef("pk"),
            action=AuditLog.Action.SCREEN_VIEW,
        ).exclude(screen="").order_by("-created_at", "-id")
        return queryset.annotate(
            _last_app_activity=Subquery(recent_activity.values("created_at")[:1]),
            _last_viewed_screen=Subquery(recent_screen.values("screen")[:1]),
        )

    @admin.display(description="Last app activity", ordering="_last_app_activity")
    def last_app_activity(self, obj):
        return obj._last_app_activity

    @admin.display(description="Last screen")
    def last_viewed_screen(self, obj):
        return obj._last_viewed_screen or "—"


@admin.register(PreidentifiedEmail)
class PreidentifiedEmailAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "role", "updated_at")
    list_filter = ("role",)
    search_fields = ("email",)


@admin.register(ToolAccessLog)
class ToolAccessLogAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "tool",
        "last_accessed_at",
        "last_known_window",
        "access_count",
    )
    list_filter = ("tool", "last_accessed_at")
    search_fields = ("email", "account__email", "last_known_window", "user_agent")
    readonly_fields = (
        "account",
        "email",
        "tool",
        "last_accessed_at",
        "last_known_window",
        "user_agent",
        "access_count",
        "first_accessed_at",
    )
    date_hierarchy = "last_accessed_at"

    def has_add_permission(self, request):
        return False


@admin.register(MembersWorkbookImport)
class MembersWorkbookImportAdmin(admin.ModelAdmin):
    list_display = ("filename", "file_sha256", "imported_at")
    readonly_fields = ("file_sha256", "sheet_summaries", "imported_at")


@admin.register(MembersWorkbookSheetSchema)
class MembersWorkbookSheetSchemaAdmin(admin.ModelAdmin):
    list_display = ("sheet_name", "table_key", "dimension", "workbook_import")
    readonly_fields = ("freeze_panes", "merged_ranges", "columns", "row_formats")


@admin.register(MemberDatabaseRecord)
class MemberDatabaseRecordAdmin(admin.ModelAdmin):
    list_display = ("source_row", "name", "glp_id_number", "section", "email")
    list_filter = ("section",)
    search_fields = ("name", "glp_id_number", "email")


@admin.register(LodgeVisitorRecord)
class LodgeVisitorRecordAdmin(admin.ModelAdmin):
    list_display = ("source_row", "meeting", "meeting_date", "name", "lodge")
    search_fields = ("name", "lodge", "meeting")


@admin.register(LodgeActivity)
class LodgeActivityAdmin(admin.ModelAdmin):
    list_display = ("title", "starts_at", "place", "status", "is_published")
    list_filter = ("status", "is_published")
    search_fields = ("title", "place", "details")
    readonly_fields = ("created_at", "updated_at")


@admin.register(MemberPositionHeld)
class MemberPositionHeldAdmin(admin.ModelAdmin):
    list_display = ("member_record", "title", "date_range", "start_date", "end_date")
    list_filter = ("title",)
    search_fields = ("member_record__name", "title", "date_range", "notes", "source")
    readonly_fields = ("created_at", "updated_at")


@admin.register(BallotingCoinRecord)
class BallotingCoinRecordAdmin(admin.ModelAdmin):
    list_display = (
        "source_row",
        "name",
        "section",
        "six_meetings_rule",
        "three_meetings_rule",
        "wm_coin_75_percent",
    )
    list_filter = ("section",)
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    change_list_template = "admin/api/auditlog/change_list.html"
    list_display = ("actor_email", "created_at", "action", "screen", "event_label", "target_model", "target_id")
    list_display_links = ("actor_email", "created_at")
    list_filter = ("actor", "action", "screen", "target_model")
    search_fields = ("actor__email", "screen", "event_label", "ip_address", "user_agent")
    readonly_fields = ("created_at", "actor_link", "action_badge", "target_link", "changes_display", "ip_address", "user_agent")
    date_hierarchy = "created_at"

    fieldsets = (
        (None, {
            "fields": ("created_at", "actor_link", "action_badge", "screen", "event_label", "target_link", "changes_display")
        }),
        ("Request", {
            "fields": ("ip_address", "user_agent"),
            "classes": ("collapse",),
        }),
    )

    @admin.display(description="Actor")
    def actor_email(self, obj):
        return obj.actor.email if obj.actor else "System"

    actor_email.short_description = "Actor"
    actor_email.admin_order_field = "actor__email"

    @admin.display(description="Actor")
    def actor_link(self, obj):
        if obj.actor:
            from django.urls import reverse
            from django.utils.html import format_html
            url = reverse("admin:api_account_change", args=[obj.actor.pk])
            return format_html('<a href="{}">{}</a>', url, obj.actor.email)
        return "System"

    @admin.display(description="Action")
    def action_badge(self, obj):
        return obj.get_action_display()

    @admin.display(description="Target")
    def target_link(self, obj):
        if obj.target_model == "MemberDatabaseRecord" and obj.target_id:
            from django.urls import reverse
            from django.utils.html import format_html
            url = reverse("admin:api_memberdatabaserecord_change", args=[obj.target_id])
            return format_html('<a href="{}">Member #{} </a>', url, obj.target_id)
        if obj.target_model and obj.target_id:
            return f"{obj.target_model} #{obj.target_id}"
        return "—"

    @admin.display(description="Changes")
    def changes_display(self, obj):
        if not obj.changes:
            return "No changes recorded."

        from django.utils.html import format_html

        rows = []
        updates = obj.changes.get("updated_fields", [])
        if isinstance(updates, list):
            for field in updates:
                rows.append(format_html(
                    '<div style="padding:4px 0;border-bottom:1px solid #eee">'
                    '<strong>{}</strong>'
                    '</div>',
                    field,
                ))
            return format_html("".join(rows)) if rows else "No field-level changes recorded."

        if isinstance(obj.changes, dict):
            for field, change in obj.changes.items():
                if isinstance(change, dict) and "old" in change and "new" in change:
                    rows.append(format_html(
                        '<div style="padding:4px 0;border-bottom:1px solid #eee">'
                        '<strong>{}</strong>: '
                        '<span style="color:#c00;text-decoration:line-through">{}</span>'
                        ' &rarr; '
                        '<span style="color:#060">{}</span>'
                        '</div>',
                        field, str(change["old"]), str(change["new"]),
                    ))
                else:
                    rows.append(format_html(
                        '<div style="padding:4px 0;border-bottom:1px solid #eee">'
                        '<strong>{}</strong>: <code>{}</code>'
                        '</div>',
                        field, str(change),
                    ))
            return format_html("".join(rows)) if rows else "No changes recorded."

        return str(obj.changes)

    def changelist_view(self, request, extra_context=None):
        since = timezone.now() - timezone.timedelta(days=30)
        recent = AuditLog.objects.filter(created_at__gte=since, actor__isnull=False)
        top_screens = list(
            recent.filter(action=AuditLog.Action.SCREEN_VIEW)
            .exclude(screen="")
            .values("screen")
            .annotate(count=Count("id"), users=Count("actor", distinct=True))
            .order_by("-count", "screen")[:10]
        )

        excluded_actions = (
            AuditLog.Action.APP_OPEN,
            AuditLog.Action.SCREEN_VIEW,
            AuditLog.Action.LOGIN_SUCCESS,
            AuditLog.Action.LOGIN_FAILED,
            AuditLog.Action.ACCOUNT_LOCKED,
        )
        action_counts = list(
            recent.exclude(action__in=excluded_actions)
            .values("action", "event_label")
            .annotate(count=Count("id"), users=Count("actor", distinct=True))
            .order_by("-count", "action", "event_label")[:10]
        )
        action_labels = dict(AuditLog.Action.choices)
        for item in action_counts:
            item["label"] = item["event_label"] or action_labels.get(item["action"], item["action"])

        context = {
            "report_days": 30,
            "app_opens": recent.filter(action=AuditLog.Action.APP_OPEN).count(),
            "active_users": recent.filter(
                action__in=(AuditLog.Action.APP_OPEN, AuditLog.Action.SCREEN_VIEW)
            ).values("actor").distinct().count(),
            "top_screens": top_screens,
            "top_actions": action_counts,
        }
        if extra_context:
            context.update(extra_context)
        return super().changelist_view(request, extra_context=context)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("account_email", "created_at")
    search_fields = ("account__email", "token")
    readonly_fields = ("account", "token", "created_at")
    date_hierarchy = "created_at"

    def account_email(self, obj):
        return obj.account.email

    account_email.short_description = "Account"
    account_email.admin_order_field = "account__email"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# Register your models here.
