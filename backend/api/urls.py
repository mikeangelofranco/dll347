from django.urls import path

from .views import (
    csrf_view,
    current_account_view,
    forgot_password_view,
    healthcheck,
    login_view,
    preidentified_emails_view,
    reset_password_view,
    logout_view,
    setup_password_view,
    validate_reset_password_token_view,
)

app_name = "api"

urlpatterns = [
    path("health/", healthcheck, name="healthcheck"),
    path("auth/csrf/", csrf_view, name="csrf"),
    path("auth/forgot-password/", forgot_password_view, name="forgot-password"),
    path("auth/login/", login_view, name="login"),
    path("auth/reset-password/validate/", validate_reset_password_token_view, name="validate-reset-password-token"),
    path("auth/reset-password/", reset_password_view, name="reset-password"),
    path("auth/setup-password/", setup_password_view, name="setup-password"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/me/", current_account_view, name="current-account"),
    path("preidentified-emails/", preidentified_emails_view, name="preidentified-emails"),
]
