from django.conf import settings
from django.contrib.auth import login, logout
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .auth_tokens import build_password_reset_token, build_password_reset_url
from .email_service import EmailDeliveryError, send_password_reset_email
from .models import Account, LodgeActivity, MemberDatabaseRecord, MemberPositionHeld, PreidentifiedEmail
from .permissions import IsDeveloper
from .serializers import (
    AccountSerializer,
    LoginSerializer,
    LodgeActivitySerializer,
    MemberListItemSerializer,
    MemberDashboardProfileSerializer,
    MemberFullProfileSerializer,
    MemberPositionHeldSerializer,
    PasswordSetupSerializer,
    PreidentifiedEmailSerializer,
    PreidentifiedEmailUpsertSerializer,
    ResetTokenValidationSerializer,
    ResetPasswordSerializer,
)


PROFILE_PHOTO_ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024


def classify_member_group(section: str) -> str:
    normalized = section.upper()
    if "DROPED" in normalized or "DROPPED" in normalized or "WORKING TOOLS" in normalized:
        return "dropped_working_tools"
    if "INACTIVE, SNPD, DEMIT" in normalized or "NOT ACTIVE" in normalized:
        return "inactive_snpd_demit"
    if "DUAL" in normalized or "PLURAL" in normalized:
        return "dual_plural"
    if "HONORARY" in normalized:
        return "honorary"
    return "active"


def is_trestle_board_member(section: str) -> bool:
    return section.upper().startswith("TRESTLE BOARD")


def is_active_trestle_board_member(section: str) -> bool:
    return section.upper().startswith("TRESTLE BOARD - ACTIVE")


def json_cell_has_value(item) -> bool:
    value = item.get("value") if isinstance(item, dict) else item
    return value not in (None, "")


def has_annual_dues_value(item) -> bool:
    value = item.get("value") if isinstance(item, dict) else item
    if value in (None, ""):
        return False
    if isinstance(value, str) and value.strip().upper() == "N/A":
        return False
    return True


def percent_of(part: int | float, whole: int | float) -> int:
    if whole <= 0:
        return 0
    return round((part / whole) * 100)


def rounded_average_percent(values: list[int]) -> int:
    if not values:
        return 0
    return int((sum(values) / len(values)) + 0.5)


def is_progressing_member(name: str, section: str) -> bool:
    normalized_name = name.strip().upper()
    normalized_section = section.upper()
    return (
        normalized_name.startswith("EAM ")
        or normalized_name.startswith("FCM ")
        or "EAM" in normalized_section
        or "FCM" in normalized_section
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def healthcheck(request):
    return Response(
        {
            "status": "ok",
            "project": "dll347",
            "communication": "REST API",
            "version": "v1",
            "service": "backend",
        }
    )


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_view(request):
    return Response({"message": "CSRF cookie set."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    account = serializer.validated_data["account"]
    preidentified_email = serializer.validated_data["preidentified_email"]
    password = serializer.validated_data["password"]

    if account is None:
        if preidentified_email is not None:
            if not preidentified_email.check_default_password(password):
                return Response(
                    {
                        "code": "INVALID_CREDENTIALS",
                        "message": "Incorrect email or password.",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            return Response(
                {
                    "code": "PASSWORD_SETUP_REQUIRED",
                    "message": "Your email is pre-approved. Please set your password to activate your account.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {
                "code": "NOT_AUTHORIZED",
                "message": "This email is not authorized to use the system.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if not account.check_password(password):
        return Response(
            {
                "code": "INVALID_CREDENTIALS",
                "message": "Incorrect email or password.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    account.ensure_reserved_developer_access(persist=True)
    login(request, account)

    return Response(
        {
            "code": "LOGIN_SUCCESS",
            "message": "Login successful.",
            "account": AccountSerializer(account).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def setup_password_view(request):
    serializer = PasswordSetupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    new_password = serializer.validated_data["new_password"]
    preidentified_email = serializer.validated_data["preidentified_email"]

    account = Account.objects.create_user(
        email=email,
        password=new_password,
        role=Account.Role.MEMBER,
        is_active=True,
        is_staff=False,
    )
    preidentified_email.delete()

    return Response(
        {
            "code": "PASSWORD_UPDATED",
            "message": "Your password has been updated successfully.",
            "account": AccountSerializer(account).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password_view(request):
    email = str(request.data.get("email", "")).strip().lower()

    if not email:
        return Response(
            {
                "code": "EMAIL_REQUIRED",
                "message": "Email is required.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    account = Account.objects.filter(email=email, is_active=True).first()
    if account is None:
        return Response(
            {
                "code": "EMAIL_NOT_FOUND",
                "message": "No account was found for that email address.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    token = build_password_reset_token(account)
    reset_url = build_password_reset_url(token)

    try:
        send_password_reset_email(email, reset_url)
    except EmailDeliveryError:
        return Response(
            {
                "code": "EMAIL_SEND_FAILED",
                "message": "Unable to send the password reset email right now.",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(
        {
            "code": "RESET_LINK_REQUESTED",
            "message": (
                f"A password reset link has been sent to {email}. "
                f"The link will expire after {settings.PASSWORD_RESET_LINK_EXPIRY_MINUTES} minutes. "
                "Please also check your spam or junk folders."
            ),
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def validate_reset_password_token_view(request):
    serializer = ResetTokenValidationSerializer(data={"token": request.query_params.get("token", "")})
    serializer.is_valid(raise_exception=True)
    account = serializer.validated_data["account"]

    return Response(
        {
            "code": "RESET_LINK_VALID",
            "message": "The reset link is valid.",
            "email": account.email,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_view(request):
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    account = serializer.validated_data["account"]
    new_password = serializer.validated_data["new_password"]
    account.set_password(new_password)
    account.save(update_fields=["password", "updated_at"])

    return Response(
        {
            "code": "PASSWORD_RESET_SUCCESS",
            "message": "Your password has been reset successfully.",
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"message": "Logout successful."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_account_view(request):
    request.user.ensure_reserved_developer_access(persist=True)
    return Response(AccountSerializer(request.user, context={"request": request}).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def member_profile_photo_view(request):
    member = MemberDatabaseRecord.objects.filter(email__iexact=request.user.email.strip()).first()
    if member is None:
        return Response(
            {
                "code": "MEMBER_PROFILE_NOT_LINKED",
                "message": "Your member record is not linked yet. Please contact the Lodge Secretary.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    upload = request.FILES.get("photo")
    if upload is None:
        return Response(
            {"code": "PHOTO_REQUIRED", "message": "Please select a profile photo to upload."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    content_type = upload.content_type.lower()
    extension = PROFILE_PHOTO_ALLOWED_CONTENT_TYPES.get(content_type)
    if extension is None:
        return Response(
            {
                "code": "UNSUPPORTED_PHOTO_TYPE",
                "message": "Please upload a JPEG, PNG, or WebP image.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if upload.size > PROFILE_PHOTO_MAX_BYTES:
        return Response(
            {
                "code": "PHOTO_TOO_LARGE",
                "message": "Profile photos must be 5 MB or smaller.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if member.profile_photo:
        member.profile_photo.delete(save=False)

    upload.name = f"member-{member.pk}.{extension}"
    member.profile_photo.save(upload.name, upload, save=True)

    return Response(
        {
            "message": "Profile photo updated.",
            "member_profile": MemberDashboardProfileSerializer(
                member,
                context={"request": request},
            ).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def member_full_profile_view(request):
    member = MemberDatabaseRecord.objects.filter(email__iexact=request.user.email.strip()).first()
    if member is None:
        return Response(
            {
                "code": "MEMBER_PROFILE_NOT_LINKED",
                "message": "Your member record is not linked yet. Please contact the Lodge Secretary.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        MemberFullProfileSerializer(member, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def member_detail_profile_view(request, member_id: int):
    member = (
        MemberDatabaseRecord.objects.exclude(section__istartswith="TRESTLE BOARD")
        .filter(pk=member_id)
        .first()
    )
    if member is None:
        return Response(
            {
                "code": "MEMBER_PROFILE_NOT_FOUND",
                "message": "We could not find that member profile.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        MemberFullProfileSerializer(member, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def member_positions_held_view(request):
    member = MemberDatabaseRecord.objects.filter(email__iexact=request.user.email.strip()).first()
    if member is None:
        return Response(
            {
                "code": "MEMBER_PROFILE_NOT_LINKED",
                "message": "Your member record is not linked yet. Please contact the Lodge Secretary.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    positions = MemberPositionHeld.objects.filter(member_record=member)
    return Response(
        {"positions": MemberPositionHeldSerializer(positions, many=True).data},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def member_summary_view(request):
    counts = {
        "active": 0,
        "dual_plural": 0,
        "honorary": 0,
        "inactive_snpd_demit": 0,
        "dropped_working_tools": 0,
    }
    records = MemberDatabaseRecord.objects.exclude(section__istartswith="TRESTLE BOARD").only("section")
    for record in records:
        counts[classify_member_group(record.section)] += 1

    return Response(
        {
            "groups": [
                {"key": "active", "label": "Active", "count": counts["active"]},
                {"key": "dual_plural", "label": "Dual / Plural", "count": counts["dual_plural"]},
                {"key": "honorary", "label": "Honorary", "count": counts["honorary"]},
                {
                    "key": "inactive_snpd_demit",
                    "label": "Inactive / SNPD / Demit",
                    "count": counts["inactive_snpd_demit"],
                },
                {
                    "key": "dropped_working_tools",
                    "label": "Dropped Working Tools",
                    "count": counts["dropped_working_tools"],
                },
            ],
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def secretary_dashboard_summary_view(request):
    current_year = str(timezone.localdate().year)
    records = list(
        MemberDatabaseRecord.objects.filter(is_test_record=False).only(
            "id",
            "name",
            "section",
            "annual_dues",
            "monthly_attendance",
        )
    )
    regular_members = [
        record for record in records if not is_trestle_board_member(record.section)
    ]
    active_trestle_board_members = [
        record for record in records if is_active_trestle_board_member(record.section)
    ]
    active_regular_members = [
        record
        for record in regular_members
        if classify_member_group(record.section) == "active"
    ]
    attendance_members = [
        record
        for record in regular_members
        if classify_member_group(record.section)
        not in {"inactive_snpd_demit", "dropped_working_tools"}
    ]
    dues_eligible_members = attendance_members

    monthly_meeting_counts: dict[str, int] = {}
    for record in attendance_members:
        for key, item in record.monthly_attendance.items():
            if key.startswith(f"{current_year} -") and json_cell_has_value(item):
                monthly_meeting_counts[key] = monthly_meeting_counts.get(key, 0) + 1

    average_attendance = (
        round(sum(monthly_meeting_counts.values()) / len(monthly_meeting_counts))
        if monthly_meeting_counts
        else 0
    )

    progressing_count = sum(
        1
        for record in active_trestle_board_members
        if is_progressing_member(record.name, record.section)
    )

    membership_percent = percent_of(len(active_regular_members), len(regular_members))
    growth_percent = percent_of(progressing_count, len(active_trestle_board_members))
    attendance_percent = percent_of(average_attendance, len(attendance_members))
    dues_paid_count = sum(
        1
        for record in dues_eligible_members
        if has_annual_dues_value(record.annual_dues.get(f"ANNUAL DUES / {current_year}"))
    )
    dues_percent = percent_of(dues_paid_count, len(dues_eligible_members))

    return Response(
        {
            "year": int(current_year),
            "overall_percent": rounded_average_percent(
                [
                    membership_percent,
                    growth_percent,
                    attendance_percent,
                    dues_percent,
                ]
            ),
            "membership": {
                "active_count": len(active_regular_members),
                "total_count": len(regular_members),
                "percent": membership_percent,
            },
            "growth": {
                "progressing_count": progressing_count,
                "total_count": len(active_trestle_board_members),
                "percent": growth_percent,
            },
            "finances": {
                "percent": 0,
                "status": "Coming soon",
            },
            "attendance": {
                "average_count": average_attendance,
                "total_count": len(attendance_members),
                "meeting_count": len(monthly_meeting_counts),
                "percent": attendance_percent,
            },
            "dues_collection": {
                "paid_count": dues_paid_count,
                "unpaid_count": len(dues_eligible_members) - dues_paid_count,
                "total_count": len(dues_eligible_members),
                "percent": dues_percent,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def member_list_view(request):
    group = request.query_params.get("group", "active")
    search = request.query_params.get("search", "").strip()
    valid_groups = {
        "active",
        "dual_plural",
        "honorary",
        "inactive_snpd_demit",
        "dropped_working_tools",
    }
    if group not in valid_groups:
        return Response(
            {
                "code": "INVALID_MEMBER_GROUP",
                "message": "Please choose a valid member group.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    records = MemberDatabaseRecord.objects.exclude(section__istartswith="TRESTLE BOARD")
    if search:
        records = records.filter(name__icontains=search)

    if not search:
        records = [record for record in records if classify_member_group(record.section) == group]

    records = sorted(records, key=lambda record: record.name.casefold())

    return Response(
        {
            "group": group,
            "count": len(records),
            "members": MemberListItemSerializer(records, many=True, context={"request": request}).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def next_lodge_activity_view(request):
    activity = (
        LodgeActivity.objects.filter(
            is_published=True,
            status=LodgeActivity.Status.SCHEDULED,
            starts_at__gte=timezone.now(),
        )
        .order_by("starts_at", "id")
        .first()
    )
    return Response(
        {"activity": LodgeActivitySerializer(activity).data if activity is not None else None},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def upcoming_lodge_activities_view(request):
    try:
        limit = int(request.query_params.get("limit", "2"))
    except (TypeError, ValueError):
        limit = 2
    limit = max(1, min(limit, 10))

    activities = LodgeActivity.objects.filter(
        is_published=True,
        status=LodgeActivity.Status.SCHEDULED,
        starts_at__gte=timezone.now(),
    )

    exclude_id = request.query_params.get("exclude_id")
    if exclude_id:
        activities = activities.exclude(id=exclude_id)

    activities = activities.order_by("starts_at", "id")[:limit]
    return Response(
        {"activities": LodgeActivitySerializer(activities, many=True).data},
        status=status.HTTP_200_OK,
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsDeveloper])
def preidentified_emails_view(request):
    if request.method == "GET":
        records = PreidentifiedEmail.objects.all().order_by("email")
        return Response(PreidentifiedEmailSerializer(records, many=True).data, status=status.HTTP_200_OK)

    serializer = PreidentifiedEmailUpsertSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    record, created = serializer.save()

    return Response(
        {
            "message": "Preidentified email saved successfully.",
            "record": PreidentifiedEmailSerializer(record).data,
        },
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
