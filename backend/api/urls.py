from django.urls import path

from .views import (
    csrf_view,
    current_account_view,
    forgot_password_view,
    healthcheck,
    login_view,
    member_detail_profile_view,
    member_full_profile_view,
    member_list_view,
    member_positions_held_view,
    member_profile_photo_view,
    member_summary_view,
    next_lodge_activity_view,
    preidentified_emails_view,
    reset_password_view,
    logout_view,
    secretary_dashboard_summary_view,
    setup_password_view,
    upcoming_lodge_activities_view,
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
    path("members/me/profile/", member_full_profile_view, name="member-full-profile"),
    path("members/<int:member_id>/profile/", member_detail_profile_view, name="member-detail-profile"),
    path("members/me/positions-held/", member_positions_held_view, name="member-positions-held"),
    path("members/me/profile-photo/", member_profile_photo_view, name="member-profile-photo"),
    path("members/list/", member_list_view, name="member-list"),
    path("members/summary/", member_summary_view, name="member-summary"),
    path("secretary/dashboard-summary/", secretary_dashboard_summary_view, name="secretary-dashboard-summary"),
    path("lodge-activities/next/", next_lodge_activity_view, name="next-lodge-activity"),
    path("lodge-activities/upcoming/", upcoming_lodge_activities_view, name="upcoming-lodge-activities"),
    path("preidentified-emails/", preidentified_emails_view, name="preidentified-emails"),
]
