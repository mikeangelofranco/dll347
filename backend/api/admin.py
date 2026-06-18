from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Account,
    BallotingCoinRecord,
    LodgeActivity,
    LodgeVisitorRecord,
    MemberDatabaseRecord,
    MemberPositionHeld,
    MembersWorkbookImport,
    MembersWorkbookSheetSchema,
    PreidentifiedEmail,
)


@admin.register(Account)
class AccountAdmin(UserAdmin):
    ordering = ("id",)
    list_display = ("id", "email", "role", "is_active", "is_staff", "last_login")
    search_fields = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Access", {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
        ("Audit", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    readonly_fields = ("last_login", "created_at", "updated_at")

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "role", "password1", "password2", "is_active", "is_staff"),
            },
        ),
    )


@admin.register(PreidentifiedEmail)
class PreidentifiedEmailAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "updated_at")
    search_fields = ("email",)


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

# Register your models here.
