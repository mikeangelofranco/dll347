from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

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
    list_display = ("id", "email", "role", "can_manage_activities", "can_edit_members", "is_active", "is_staff", "failed_login_attempts", "locked_until", "last_login")
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
    list_display = ("created_at", "action", "actor_email", "target_model", "target_id")
    list_filter = ("action", "target_model")
    search_fields = ("actor__email", "ip_address", "user_agent")
    readonly_fields = ("actor", "action", "target_model", "target_id", "changes", "ip_address", "user_agent", "created_at")
    date_hierarchy = "created_at"

    def actor_email(self, obj):
        return obj.actor.email if obj.actor else ""

    actor_email.short_description = "Actor"
    actor_email.admin_order_field = "actor__email"

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
