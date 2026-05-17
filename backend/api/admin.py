from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Account, PreidentifiedEmail


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
    readonly_fields = ("created_at", "updated_at")

# Register your models here.
