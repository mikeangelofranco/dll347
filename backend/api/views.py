from django.conf import settings
from django.contrib.auth import login, logout
from django.db import close_old_connections, transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import logging
import re
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .auth_tokens import build_password_reset_token, build_password_reset_url
from .email_service import EmailDeliveryError, send_password_reset_email
from .document_extraction import extract_treasurer_report
from .excel_members import MembersWorkbookFormatError, update_existing_members_from_workbook
from .models import Account, LodgeActivity, LodgeDocument, MemberDatabaseRecord, MemberPositionHeld, PreidentifiedEmail, ToolAccessLog, TreasurerReportSummary
from .permissions import IsDeveloper
from .serializers import (
    AccountSerializer,
    LoginSerializer,
    LodgeActivityCreateSerializer,
    LodgeActivitySerializer,
    LodgeDocumentSerializer,
    MemberListItemSerializer,
    MemberDashboardProfileSerializer,
    MemberEditableProfileSerializer,
    MemberFullProfileSerializer,
    MemberPositionHeldSerializer,
    MemberProfileUpdateSerializer,
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
DOCUMENT_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}
DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
DOCUMENT_EXTRACTION_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="document-extraction")
logger = logging.getLogger(__name__)
DOCUMENT_MONTH_NAMES = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def clean_database_text(value: str) -> str:
    return value.replace("\x00", "")


def report_period_from_filename(filename: str) -> tuple[int | None, int | None]:
    normalized = filename.lower().replace("_", " ").replace("-", " ")
    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", normalized)
    month = None
    for token, value in DOCUMENT_MONTH_NAMES.items():
        if re.search(rf"\b{re.escape(token)}\b", normalized):
            month = value
            break
    return month, int(year_match.group(1)) if year_match else None


def summary_report_period(summary: TreasurerReportSummary) -> tuple[int | None, int | None]:
    filename_month, filename_year = report_period_from_filename(summary.document.original_filename)
    return (
        filename_month if filename_month is not None else summary.report_month,
        filename_year if filename_year is not None else summary.report_year,
    )


def money_payload(value: Decimal | None) -> str | None:
    return f"{value:.2f}" if value is not None else None


def percent_change(current: Decimal | None, previous: Decimal | None) -> float | None:
    if current is None or previous in (None, Decimal("0")):
        return None
    return float(((current - previous) / abs(previous)) * Decimal("100"))


def rounded_trend(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 1)


def report_period_label(month: int | None, year: int | None) -> str | None:
    if not month or not year:
        return None
    month_names = [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    if month < 1 or month > 12:
        return str(year)
    return f"{month_names[month]} {year}"


def financial_summary_payload() -> dict:
    summaries = sorted(
        TreasurerReportSummary.objects.select_related("document")
        .filter(
            cash_to_date__isnull=False,
            cash_disbursements__isnull=False,
            remaining_cash__isnull=False,
        ),
        key=lambda summary: (
            summary_report_period(summary)[1] or 0,
            summary_report_period(summary)[0] or 0,
            summary.document.created_at,
            summary.id,
        ),
        reverse=True,
    )
    latest = summaries[0] if summaries else None
    previous = summaries[1] if len(summaries) > 1 else None

    if latest is None:
        return {
            "percent": 0,
            "status": "No Treasurer report yet",
            "has_data": False,
            "report_month": None,
            "report_year": None,
            "report_period_label": None,
            "source_date": None,
            "cash_accountability": None,
            "cash_to_date": None,
            "cash_outflow": None,
            "remaining_cash": None,
            "cash_to_date_trend": None,
            "cash_outflow_trend": None,
            "net_trend": None,
            "net_direction": "flat",
        }

    cash_position_trend = rounded_trend(percent_change(latest.remaining_cash, previous.remaining_cash if previous else None))
    cash_outflow_trend = rounded_trend(percent_change(latest.cash_disbursements, previous.cash_disbursements if previous else None))
    net_trend = cash_position_trend
    if net_trend is None or net_trend == 0:
        net_direction = "flat"
    else:
        net_direction = "up" if net_trend > 0 else "down"
    latest_month, latest_year = summary_report_period(latest)

    return {
        "percent": max(0, min(100, round(float(latest.remaining_cash / latest.cash_to_date * 100)))) if latest.cash_to_date else 0,
        "status": "Cash position is up" if net_direction == "up" else "Cash position is down" if net_direction == "down" else "Cash position is flat",
        "has_data": True,
        "report_month": latest_month,
        "report_year": latest_year,
        "report_period_label": report_period_label(latest_month, latest_year),
        "source_date": latest.document.created_at.date().isoformat(),
        "cash_accountability": money_payload(latest.cash_to_date),
        "cash_to_date": money_payload(latest.remaining_cash),
        "cash_outflow": money_payload(latest.cash_disbursements),
        "remaining_cash": money_payload(latest.remaining_cash),
        "cash_to_date_trend": cash_position_trend,
        "cash_outflow_trend": cash_outflow_trend,
        "net_trend": net_trend,
        "net_direction": net_direction,
    }


def user_can_manage_documents(user) -> bool:
    return user.is_authenticated and user.role == Account.Role.SECRETARY


def user_can_manage_activities(user) -> bool:
    return user.is_authenticated and user.can_manage_activities


def user_can_edit_members(user) -> bool:
    return user.is_authenticated and user.can_edit_members


def request_window_label(request) -> str:
    explicit_window = request.headers.get("X-DLL347-Window", "").strip()
    if explicit_window:
        return explicit_window[:255]

    referer = request.headers.get("Referer", "").strip()
    if referer:
        return referer[:255]

    return request.path[:255]


def record_tool_access(request, tool: str) -> None:
    user = request.user
    if not user.is_authenticated:
        return

    defaults = {
        "email": user.email,
        "last_accessed_at": timezone.now(),
        "last_known_window": request_window_label(request),
        "user_agent": request.headers.get("User-Agent", "").strip()[:255],
    }
    _log, created = ToolAccessLog.objects.get_or_create(
        account=user,
        tool=tool,
        defaults={**defaults, "access_count": 1, "first_accessed_at": defaults["last_accessed_at"]},
    )
    if not created:
        ToolAccessLog.objects.filter(account=user, tool=tool).update(
            **defaults,
            access_count=F("access_count") + 1,
        )


def filename_matches_category(filename: str, category: str) -> bool:
    normalized = filename.lower().replace("_", " ").replace("-", " ")
    if category == LodgeDocument.Category.MEMBERS_DATA:
        return filename.lower().endswith(".xlsx") and "member" in normalized
    if category == LodgeDocument.Category.TREASURERS_REPORT:
        return "treasurer" in normalized and "report" in normalized
    if category == LodgeDocument.Category.STATED_MEETING_MINUTES:
        return "minutes" in normalized and "stated" in normalized
    if category == LodgeDocument.Category.SPECIAL_MEETING_MINUTES:
        return "minutes" in normalized and "special" in normalized
    return False


def file_type_matches_category(filename: str, content_type: str, category: str) -> bool:
    if category == LodgeDocument.Category.MEMBERS_DATA:
        return filename.lower().endswith(".xlsx")
    return content_type in {"application/pdf", "image/jpeg", "image/png"}


def process_treasurer_report_document(document_id: int) -> None:
    close_old_connections()
    try:
        document = LodgeDocument.objects.get(pk=document_id)
        extraction = extract_treasurer_report(document.file, document.content_type)
        document.extracted_text = clean_database_text(extraction.text)
        document.extraction_errors = [
            clean_database_text(error) for error in extraction.errors
        ]
        document.extraction_status = (
            LodgeDocument.ExtractionStatus.EXTRACTED
            if extraction.is_complete
            else LodgeDocument.ExtractionStatus.PENDING_REVIEW
        )
        document.save(update_fields=["extracted_text", "extraction_errors", "extraction_status", "updated_at"])

        if extraction.values:
            filename_month, filename_year = report_period_from_filename(document.original_filename)
            summary_values = {
                **extraction.values,
                "raw_values": extraction.raw_values,
            }
            if filename_month is not None:
                summary_values["report_month"] = filename_month
            if filename_year is not None:
                summary_values["report_year"] = filename_year
            TreasurerReportSummary.objects.update_or_create(
                document=document,
                defaults=summary_values,
            )
    except LodgeDocument.DoesNotExist:
        return
    except Exception as exc:
        logger.exception("Unable to extract Treasurer Report document %s", document_id)
        LodgeDocument.objects.filter(pk=document_id).update(
            extraction_status=LodgeDocument.ExtractionStatus.FAILED,
            extraction_errors=[clean_database_text(str(exc) or "Extraction failed.")],
            updated_at=timezone.now(),
        )
    finally:
        close_old_connections()


def queue_treasurer_report_extraction(document_id: int) -> None:
    DOCUMENT_EXTRACTION_EXECUTOR.submit(process_treasurer_report_document, document_id)


def process_members_data_document(document_id: int) -> None:
    close_old_connections()
    try:
        document = LodgeDocument.objects.get(pk=document_id)
        result = update_existing_members_from_workbook(document.file.path)
        messages = [
            f"Updated {result.updated_count} existing member record{'s' if result.updated_count != 1 else ''}.",
            f"Read {result.total_rows} member row{'s' if result.total_rows != 1 else ''} from the workbook.",
        ]
        if result.unmatched_count:
            preview = ", ".join(result.unmatched_names)
            messages.append(
                f"Skipped {result.unmatched_count} uploaded row{'s' if result.unmatched_count != 1 else ''} that did not match an existing member"
                + (f": {preview}." if preview else ".")
            )
        document.extracted_text = "\n".join(messages)
        document.extraction_errors = []
        document.extraction_status = LodgeDocument.ExtractionStatus.EXTRACTED
        document.save(update_fields=["extracted_text", "extraction_errors", "extraction_status", "updated_at"])
    except LodgeDocument.DoesNotExist:
        return
    except MembersWorkbookFormatError as exc:
        LodgeDocument.objects.filter(pk=document_id).update(
            extraction_status=LodgeDocument.ExtractionStatus.FAILED,
            extraction_errors=exc.errors,
            updated_at=timezone.now(),
        )
    except Exception as exc:
        logger.exception("Unable to update members data document %s", document_id)
        LodgeDocument.objects.filter(pk=document_id).update(
            extraction_status=LodgeDocument.ExtractionStatus.FAILED,
            extraction_errors=[clean_database_text(str(exc) or "Members data update failed.")],
            updated_at=timezone.now(),
        )
    finally:
        close_old_connections()


def queue_members_data_update(document_id: int) -> None:
    DOCUMENT_EXTRACTION_EXECUTOR.submit(process_members_data_document, document_id)


def delete_document_file(document: LodgeDocument) -> None:
    if document.file:
        document.file.delete(save=False)


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


@api_view(["GET", "PATCH", "PUT"])
@permission_classes([IsAuthenticated])
def member_edit_profile_view(request, member_id: int):
    if not user_can_edit_members(request.user):
        return Response(
            {
                "code": "MEMBER_EDIT_FORBIDDEN",
                "message": "You do not have permission to edit member records.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    record_tool_access(request, ToolAccessLog.Tool.EDIT_MEMBER)

    member = MemberDatabaseRecord.objects.filter(pk=member_id).first()
    if member is None:
        return Response(
            {
                "code": "MEMBER_PROFILE_NOT_FOUND",
                "message": "We could not find that member profile.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response(
            MemberEditableProfileSerializer(member, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    serializer = MemberProfileUpdateSerializer(
        member,
        data=request.data,
        partial=request.method == "PATCH",
    )
    serializer.is_valid(raise_exception=True)
    updated_member = serializer.save()
    return Response(
        {
            "message": "Member record updated successfully.",
            "member": MemberEditableProfileSerializer(updated_member, context={"request": request}).data,
        },
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
                **financial_summary_payload(),
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


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def lodge_documents_view(request):
    if not user_can_manage_documents(request.user):
        return Response(
            {
                "code": "DOCUMENTS_ACCESS_DENIED",
                "message": "Only the Lodge Secretary can manage documents.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    record_tool_access(request, ToolAccessLog.Tool.DOCUMENTS)

    if request.method == "GET":
        documents = LodgeDocument.objects.select_related("treasurer_summary", "uploaded_by")
        category = request.query_params.get("category", "").strip()
        if category:
            documents = documents.filter(category=category)
        return Response(
            {"documents": LodgeDocumentSerializer(documents, many=True, context={"request": request}).data},
            status=status.HTTP_200_OK,
        )

    category = request.data.get("category", "")
    valid_categories = {choice.value for choice in LodgeDocument.Category}
    if category not in valid_categories:
        return Response(
            {
                "code": "INVALID_DOCUMENT_CATEGORY",
                "message": "Please select a valid document category before uploading.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    uploads = request.FILES.getlist("files")
    if not uploads:
        return Response(
            {
                "code": "DOCUMENTS_REQUIRED",
                "message": "Please choose at least one file to upload.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    notes = str(request.data.get("notes", "")).strip()[:200]
    results = []
    if category == LodgeDocument.Category.MEMBERS_DATA and len(uploads) > 1:
        return Response(
            {
                "message": "Members Data accepts one workbook at a time.",
                "results": [
                    {
                        "filename": upload.name,
                        "status": "rejected",
                        "errors": [
                            "Members Data accepts one workbook at a time because it replaces the current members workbook."
                        ],
                    }
                    for upload in uploads
                ],
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    batch_filename_counts: dict[str, int] = {}
    for upload in uploads:
        normalized_name = upload.name.strip().casefold()
        batch_filename_counts[normalized_name] = batch_filename_counts.get(normalized_name, 0) + 1
    existing_filenames = set(
        LodgeDocument.objects.filter(category=category).values_list("original_filename", flat=True)
    )
    existing_normalized_filenames = {
        filename.strip().casefold() for filename in existing_filenames
    }

    with transaction.atomic():
        for upload in uploads:
            errors = []
            content_type = upload.content_type.lower()
            normalized_filename = upload.name.strip().casefold()

            if content_type not in DOCUMENT_ALLOWED_CONTENT_TYPES:
                errors.append("Allowed file types are PDF, JPG, PNG, and XLSX.")
            if not file_type_matches_category(upload.name, content_type, category):
                errors.append("The selected category requires a .xlsx workbook." if category == LodgeDocument.Category.MEMBERS_DATA else "This category accepts PDF, JPG, or PNG files.")
            if upload.size > DOCUMENT_MAX_BYTES:
                errors.append("Max file size is 20MB per file.")
            if not filename_matches_category(upload.name, category):
                errors.append("Filename does not appear to match the selected category.")
            if batch_filename_counts.get(normalized_filename, 0) > 1:
                errors.append("This filename appears more than once in the selected files.")
            if category != LodgeDocument.Category.MEMBERS_DATA and normalized_filename in existing_normalized_filenames:
                errors.append("A document with this filename has already been uploaded.")

            if errors:
                results.append(
                    {
                        "filename": upload.name,
                        "status": "rejected",
                        "errors": errors,
                    }
                )
                continue

            if category == LodgeDocument.Category.MEMBERS_DATA:
                existing_members_documents = list(
                    LodgeDocument.objects.filter(category=LodgeDocument.Category.MEMBERS_DATA)
                )
                for existing_document in existing_members_documents:
                    delete_document_file(existing_document)
                LodgeDocument.objects.filter(
                    id__in=[document.id for document in existing_members_documents]
                ).delete()

            document = LodgeDocument.objects.create(
                category=category,
                file=upload,
                original_filename=upload.name,
                content_type=content_type,
                size_bytes=upload.size,
                notes=notes,
                uploaded_by=request.user,
                extraction_status=(
                    LodgeDocument.ExtractionStatus.PENDING_REVIEW
                    if category in {LodgeDocument.Category.TREASURERS_REPORT, LodgeDocument.Category.MEMBERS_DATA}
                    else LodgeDocument.ExtractionStatus.NOT_APPLICABLE
                ),
            )
            existing_normalized_filenames.add(normalized_filename)

            if category == LodgeDocument.Category.TREASURERS_REPORT:
                transaction.on_commit(
                    lambda document_id=document.id: queue_treasurer_report_extraction(document_id)
                )
            elif category == LodgeDocument.Category.MEMBERS_DATA:
                transaction.on_commit(
                    lambda document_id=document.id: queue_members_data_update(document_id)
                )

            results.append(
                {
                    "filename": upload.name,
                    "status": "uploaded",
                    "document": LodgeDocumentSerializer(document, context={"request": request}).data,
                    "errors": document.extraction_errors,
                }
            )

    accepted_count = sum(1 for item in results if item["status"] == "uploaded")
    response_status = status.HTTP_201_CREATED if accepted_count else status.HTTP_400_BAD_REQUEST
    return Response(
        {
            "message": f"Uploaded {accepted_count} file{'s' if accepted_count != 1 else ''}.",
            "results": results,
        },
        status=response_status,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def lodge_document_detail_view(request, document_id: int):
    if not user_can_manage_documents(request.user):
        return Response(
            {
                "code": "DOCUMENTS_ACCESS_DENIED",
                "message": "Only the Lodge Secretary can manage documents.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    record_tool_access(request, ToolAccessLog.Tool.DOCUMENTS)

    document = get_object_or_404(LodgeDocument, pk=document_id)
    delete_document_file(document)
    document.delete()
    return Response({"message": "Document deleted successfully."}, status=status.HTTP_200_OK)


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def managed_lodge_activities_view(request):
    if not user_can_manage_activities(request.user):
        return Response(
            {
                "code": "ACTIVITY_ACCESS_DENIED",
                "message": "You do not have permission to manage lodge activities.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    record_tool_access(request, ToolAccessLog.Tool.ACTIVITY)

    search = request.query_params.get("search", "").strip()
    activities = LodgeActivity.objects.all()
    if search:
        activities = activities.filter(
            Q(title__icontains=search)
            | Q(place__icontains=search)
            | Q(details__icontains=search)
        )
    activities = activities.order_by("-starts_at", "-id")[:100]
    return Response(
        {"activities": LodgeActivitySerializer(activities, many=True).data},
        status=status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def lodge_activity_detail_view(request, activity_id: int):
    if not user_can_manage_activities(request.user):
        return Response(
            {
                "code": "ACTIVITY_ACCESS_DENIED",
                "message": "You do not have permission to manage lodge activities.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    record_tool_access(request, ToolAccessLog.Tool.ACTIVITY)

    activity = LodgeActivity.objects.filter(pk=activity_id).first()
    if activity is None:
        return Response(
            {
                "code": "ACTIVITY_NOT_FOUND",
                "message": "We could not find that lodge activity.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    activity.delete()
    return Response(
        {"message": "Activity deleted successfully."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_lodge_activity_view(request):
    if not user_can_manage_activities(request.user):
        return Response(
            {
                "code": "ACTIVITY_ACCESS_DENIED",
                "message": "You do not have permission to create lodge activities.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    record_tool_access(request, ToolAccessLog.Tool.ACTIVITY)

    serializer = LodgeActivityCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    activity = serializer.save(created_by=request.user)
    return Response(
        {
            "message": "Activity saved successfully.",
            "activity": LodgeActivitySerializer(activity).data,
        },
        status=status.HTTP_201_CREATED,
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
