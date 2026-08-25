from urllib.parse import urlencode

from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Account,
    DashboardCardVisibility,
    LodgeActivity,
    LodgeDocument,
    MemberDatabaseRecord,
    MemberPositionHeld,
    PersonalInformationVisibility,
    PreidentifiedEmail,
    TreasurerReportSummary,
)
from .excel_members import find_member_for_account
from .member_groups import member_display_group_from_section


def json_cell_value(item):
    return item.get("value") if isinstance(item, dict) else item


def has_paid_annual_dues_for_year(obj: MemberDatabaseRecord, year: int) -> bool:
    value = json_cell_value(obj.annual_dues.get(f"ANNUAL DUES / {year}"))
    if value in (None, ""):
        return False
    if isinstance(value, str) and value.strip().upper() == "N/A":
        return False
    return True


class MemberPositionHeldSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberPositionHeld
        fields = (
            "id",
            "title",
            "date_range",
            "start_date",
            "end_date",
            "notes",
            "source",
        )


_MONTH_ABBREVIATIONS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def _months_attended(obj: MemberDatabaseRecord, year: str) -> set[str]:
    return {
        key.rsplit(" / ", 1)[-1]
        for key, item in obj.monthly_attendance.items()
        if key.startswith(f"{year} - ")
        and json_cell_value(item) not in (None, "")
    }


def _month_has_attendance(obj: MemberDatabaseRecord, year: str, month_abbr: str) -> bool:
    prefix = f"{year} - "
    suffix = f" / {month_abbr}"
    for key, item in obj.monthly_attendance.items():
        if key.startswith(prefix) and key.endswith(suffix):
            if json_cell_value(item) not in (None, ""):
                return True
    return False


def _months_attended_past_twelve(obj: MemberDatabaseRecord) -> int:
    today = timezone.localdate()
    count = 0
    for i in range(12):
        year = today.year
        month = today.month - i
        if month <= 0:
            month += 12
            year -= 1
        if _month_has_attendance(obj, str(year), _MONTH_ABBREVIATIONS[month - 1]):
            count += 1
    return count


class MemberDashboardProfileSerializer(serializers.ModelSerializer):
    lodge_standing = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    dues_status = serializers.SerializerMethodField()
    attendance_this_year = serializers.SerializerMethodField()
    three_meetings_rule = serializers.SerializerMethodField()
    six_meetings_rule = serializers.SerializerMethodField()
    six_meeting_attendance = serializers.SerializerMethodField()
    proficiency_date = serializers.DateField()
    years_of_membership = serializers.SerializerMethodField()
    member_since = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = MemberDatabaseRecord
        fields = (
            "id",
            "name",
            "email",
            "section",
            "member_number",
            "glp_id_number",
            "lodge_standing",
            "status",
            "dues_status",
            "attendance_this_year",
            "three_meetings_rule",
            "six_meetings_rule",
            "six_meeting_attendance",
            "proficiency_date",
            "years_of_membership",
            "member_since",
            "profile_photo_url",
        )

    def get_lodge_standing(self, obj: MemberDatabaseRecord) -> str:
        if obj.section.startswith("TRESTLE BOARD"):
            return "Trestle Board"
        return "Master Mason"

    def get_status(self, obj: MemberDatabaseRecord) -> str:
        section = obj.section.upper()
        if "DROPED" in section or "DROPPED" in section or "WORKING TOOLS" in section:
            return "Dropped Working Tools"
        if "SUSPENDED" in section:
            return "Suspended"
        if "DEMIT" in section:
            return "Demit"
        if "INACTIVE" in section or "SNPD" in section or "NOT ACTIVE" in section:
            return "Inactive"
        return "Good Standing"

    def get_dues_status(self, obj: MemberDatabaseRecord) -> str:
        current_year = timezone.localdate().year
        if has_paid_annual_dues_for_year(obj, current_year):
            return f"Paid {current_year}"
        return f"Unpaid {current_year}"

    def get_attendance_this_year(self, obj: MemberDatabaseRecord) -> int:
        current_year = str(timezone.localdate().year)
        return len(_months_attended(obj, current_year))

    def get_three_meetings_rule(self, obj: MemberDatabaseRecord) -> bool:
        current_year = str(timezone.localdate().year)
        return len(_months_attended(obj, current_year)) >= 3

    def get_six_meetings_rule(self, obj: MemberDatabaseRecord) -> bool:
        return _months_attended_past_twelve(obj) >= 6

    def get_six_meeting_attendance(self, obj: MemberDatabaseRecord) -> int:
        return _months_attended_past_twelve(obj)

    def get_member_since(self, obj: MemberDatabaseRecord):
        return obj.raising_date or obj.initiation_date

    def get_profile_photo_url(self, obj: MemberDatabaseRecord) -> str | None:
        photo = obj.profile_photo or obj.default_profile_photo
        if not photo:
            return None
        request = self.context.get("request")
        version = int(obj.updated_at.timestamp() * 1000)
        url = f"{photo.url}?{urlencode({'v': version})}"
        return request.build_absolute_uri(url) if request is not None else url

    def get_years_of_membership(self, obj: MemberDatabaseRecord) -> int | None:
        start_date = self.get_member_since(obj)
        if start_date is None:
            return None
        today = timezone.localdate()
        years = today.year - start_date.year
        if (today.month, today.day) < (start_date.month, start_date.day):
            years -= 1
        return max(years, 0)


class MemberListItemSerializer(serializers.ModelSerializer):
    group_key = serializers.SerializerMethodField()
    group_label = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    dues_status = serializers.SerializerMethodField()
    profile_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = MemberDatabaseRecord
        fields = (
            "id",
            "name",
            "glp_id_number",
            "section",
            "group_key",
            "group_label",
            "status",
            "dues_status",
            "profile_photo_url",
        )

    def get_group_key(self, obj: MemberDatabaseRecord) -> str:
        return member_display_group_from_section(obj.section).key

    def get_group_label(self, obj: MemberDatabaseRecord) -> str:
        return member_display_group_from_section(obj.section).label

    def get_status(self, obj: MemberDatabaseRecord) -> str:
        return MemberDashboardProfileSerializer(context=self.context).get_status(obj)

    def get_dues_status(self, obj: MemberDatabaseRecord) -> str:
        return MemberDashboardProfileSerializer(context=self.context).get_dues_status(obj)

    def get_profile_photo_url(self, obj: MemberDatabaseRecord) -> str | None:
        return MemberDashboardProfileSerializer(context=self.context).get_profile_photo_url(obj)


class PetitionerListItemSerializer(MemberListItemSerializer):
    class Meta(MemberListItemSerializer.Meta):
        fields = tuple(
            field for field in MemberListItemSerializer.Meta.fields
            if field != "glp_id_number"
        )


class MemberFullProfileSerializer(MemberDashboardProfileSerializer):
    date_of_birth = serializers.DateField()
    initiation_date = serializers.DateField()
    passing_date = serializers.DateField()
    raising_date = serializers.DateField()
    proficiency_date = serializers.DateField()
    date_presented = serializers.DateField()
    date_balloted = serializers.DateField()
    telephone = serializers.CharField()
    address = serializers.CharField()
    appendant_bodies = serializers.JSONField()
    positions_held = MemberPositionHeldSerializer(many=True, read_only=True)
    years_of_membership = serializers.SerializerMethodField()

    class Meta(MemberDashboardProfileSerializer.Meta):
        fields = MemberDashboardProfileSerializer.Meta.fields + (
            "date_of_birth",
            "initiation_date",
            "passing_date",
            "raising_date",
            "proficiency_date",
            "date_presented",
            "date_balloted",
            "telephone",
            "address",
            "appendant_bodies",
            "positions_held",
            "blood_type",
            "widow_or_sister",
            "years_of_membership",
        )

    def get_years_of_membership(self, obj: MemberDatabaseRecord) -> int | None:
        start_date = self.get_member_since(obj)
        if start_date is None:
            return None

        today = timezone.localdate()
        years = today.year - start_date.year
        if (today.month, today.day) < (start_date.month, start_date.day):
            years -= 1
        return max(years, 0)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", Account.Role.MEMBER)
        visibility = PersonalInformationVisibility.for_role(role)
        if not visibility["birthdate"]:
            representation.pop("date_of_birth", None)
        if not visibility["address"]:
            representation.pop("address", None)
        return representation


class PetitionerFullProfileSerializer(MemberFullProfileSerializer):
    class Meta(MemberFullProfileSerializer.Meta):
        fields = tuple(
            field for field in MemberFullProfileSerializer.Meta.fields
            if field not in {"glp_id_number", "date_presented", "date_balloted"}
        )


class MemberEditableProfileSerializer(MemberFullProfileSerializer):
    class Meta(MemberFullProfileSerializer.Meta):
        fields = MemberFullProfileSerializer.Meta.fields + (
            "suspension",
            "restored",
            "demit",
            "lml",
            "dual_plural_honorary_date",
            "widow_or_sister_date_of_birth",
            "meeting_attendance",
            "monthly_attendance",
            "annual_dues",
        )


class PetitionerEditableProfileSerializer(MemberEditableProfileSerializer):
    class Meta(MemberEditableProfileSerializer.Meta):
        fields = tuple(
            field for field in MemberEditableProfileSerializer.Meta.fields
            if field not in {"glp_id_number", "date_presented", "date_balloted"}
        )


class MemberPositionHeldUpdateSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    title = serializers.CharField(max_length=255, allow_blank=True)
    date_range = serializers.CharField(max_length=150, allow_blank=True, required=False)
    start_date = serializers.DateField(allow_null=True, required=False)
    end_date = serializers.DateField(allow_null=True, required=False)
    notes = serializers.CharField(allow_blank=True, required=False)
    source = serializers.CharField(max_length=100, allow_blank=True, required=False)


class MemberProfileUpdateSerializer(serializers.ModelSerializer):
    positions_held = MemberPositionHeldUpdateSerializer(many=True, required=False)

    class Meta:
        model = MemberDatabaseRecord
        fields = (
            "section",
            "member_number",
            "name",
            "glp_id_number",
            "date_of_birth",
            "initiation_date",
            "passing_date",
            "raising_date",
            "proficiency_date",
            "date_presented",
            "date_balloted",
            "suspension",
            "restored",
            "demit",
            "lml",
            "dual_plural_honorary_date",
            "address",
            "telephone",
            "email",
            "appendant_bodies",
            "blood_type",
            "widow_or_sister",
            "widow_or_sister_date_of_birth",
            "meeting_attendance",
            "monthly_attendance",
            "annual_dues",
            "positions_held",
        )
        extra_kwargs = {
            "section": {"allow_blank": True, "required": False},
            "member_number": {"allow_blank": True, "required": False},
            "name": {"required": True},
            "glp_id_number": {"allow_blank": True, "required": False},
            "date_of_birth": {"allow_null": True, "required": False},
            "initiation_date": {"allow_null": True, "required": False},
            "passing_date": {"allow_null": True, "required": False},
            "raising_date": {"allow_null": True, "required": False},
            "proficiency_date": {"allow_null": True, "required": False},
            "date_presented": {"allow_null": True, "required": False},
            "date_balloted": {"allow_null": True, "required": False},
            "suspension": {"allow_blank": True, "required": False},
            "restored": {"allow_blank": True, "required": False},
            "demit": {"allow_blank": True, "required": False},
            "lml": {"allow_blank": True, "required": False},
            "dual_plural_honorary_date": {"allow_blank": True, "required": False},
            "address": {"allow_blank": True, "required": False},
            "telephone": {"allow_blank": True, "required": False},
            "email": {"allow_blank": True, "required": False},
            "blood_type": {"allow_blank": True, "required": False},
            "widow_or_sister": {"allow_blank": True, "required": False},
            "widow_or_sister_date_of_birth": {"allow_null": True, "required": False},
            "appendant_bodies": {"required": False},
            "meeting_attendance": {"required": False},
            "monthly_attendance": {"required": False},
            "annual_dues": {"required": False},
        }

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required.")
        return value

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", Account.Role.MEMBER)
        visibility = PersonalInformationVisibility.for_role(role)
        errors = {}
        if "date_of_birth" in attrs and not visibility["birthdate"]:
            errors["date_of_birth"] = "Your role is not allowed to view or change birthdates."
        if "address" in attrs and not visibility["address"]:
            errors["address"] = "Your role is not allowed to view or change addresses."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def update(self, instance: MemberDatabaseRecord, validated_data):
        positions = validated_data.pop("positions_held", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if positions is not None:
            instance.positions_held.all().delete()
            position_records = [
                MemberPositionHeld(
                    member_record=instance,
                    title=item["title"].strip(),
                    date_range=item.get("date_range", "").strip(),
                    start_date=item.get("start_date"),
                    end_date=item.get("end_date"),
                    notes=item.get("notes", "").strip(),
                    source=item.get("source", "").strip(),
                )
                for item in positions
                if item.get("title", "").strip()
            ]
            if position_records:
                MemberPositionHeld.objects.bulk_create(position_records)

        return instance


class LodgeActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LodgeActivity
        fields = (
            "id",
            "title",
            "details",
            "place",
            "starts_at",
            "ends_at",
            "status",
        )


class LodgeActivityCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LodgeActivity
        fields = (
            "title",
            "details",
            "place",
            "starts_at",
            "ends_at",
            "status",
            "is_published",
        )

    def validate_title(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title is required.")
        if len(value) > 100:
            raise serializers.ValidationError("Title must be 100 characters or fewer.")
        return value

    def validate_details(self, value: str) -> str:
        value = value.strip()
        if len(value) > 2000:
            raise serializers.ValidationError("Details must be 2000 characters or fewer.")
        return value

    def validate_place(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Place is required.")
        return value

    def validate(self, attrs):
        starts_at = attrs.get("starts_at")
        ends_at = attrs.get("ends_at")
        if ends_at is None:
            raise serializers.ValidationError({"ends_at": "Ends at is required."})
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "Ends at must be after starts at."})
        return attrs


class TreasurerReportSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = TreasurerReportSummary
        fields = (
            "report_month",
            "report_year",
            "previous_report_date",
            "cash_balance_last_report",
            "cash_received_month",
            "cash_to_date",
            "cash_disbursements",
            "remaining_cash",
            "general_fund",
            "specific_purpose_funds",
            "other_sources",
            "grand_lodge_account",
            "other_account",
            "raw_values",
        )


class LodgeDocumentSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    file_url = serializers.SerializerMethodField()
    treasurer_summary = TreasurerReportSummarySerializer(read_only=True)

    class Meta:
        model = LodgeDocument
        fields = (
            "id",
            "category",
            "category_label",
            "original_filename",
            "content_type",
            "size_bytes",
            "notes",
            "file_url",
            "extraction_status",
            "extraction_errors",
            "treasurer_summary",
            "created_at",
            "updated_at",
        )

    def get_file_url(self, obj: LodgeDocument) -> str:
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request is not None else url


class AccountSerializer(serializers.ModelSerializer):
    is_admin = serializers.SerializerMethodField()
    member_profile = serializers.SerializerMethodField()
    dashboard_card_visibility = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id",
            "email",
            "role",
            "can_manage_activities",
            "can_edit_members",
            "can_edit_petitioners",
            "is_active",
            "is_staff",
            "is_admin",
            "dashboard_card_visibility",
            "member_profile",
            "last_login",
            "created_at",
            "updated_at",
        )

    def get_is_admin(self, obj: Account) -> bool:
        return obj.is_superuser

    def get_dashboard_card_visibility(self, obj: Account) -> dict[str, bool]:
        return DashboardCardVisibility.for_role(obj.role)

    def get_member_profile(self, obj: Account):
        member = find_member_for_account(obj)
        if member is None:
            return None
        return MemberDashboardProfileSerializer(member, context=self.context).data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")
        attrs["email"] = email

        account = (
            Account.objects.filter(email=email)
            .only("id", "email", "password", "role", "can_manage_activities", "can_edit_members", "can_edit_petitioners", "is_active", "is_staff", "is_superuser")
            .first()
        )
        attrs["account"] = account
        attrs["preidentified_email"] = (
            PreidentifiedEmail.objects.filter(email=email)
            .only("id", "email", "default_password")
            .first()
        )

        if account and not account.is_active:
            raise serializers.ValidationError("Your account has been deactivated. Please contact your Lodge Secretary.")

        attrs["password"] = password
        attrs["email"] = email
        return attrs


class PasswordSetupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    default_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)
    confirm_password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        default_password = attrs.get("default_password")
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        if Account.objects.filter(email=email).exists():
            raise serializers.ValidationError("This account has already been activated.")

        preidentified_email = (
            PreidentifiedEmail.objects.filter(email=email)
            .only("id", "email", "default_password")
            .first()
        )
        if preidentified_email is None:
            raise serializers.ValidationError("This email is not authorized to use the system.")

        if not preidentified_email.check_default_password(default_password):
            raise serializers.ValidationError({"default_password": "Incorrect default password."})

        temp_user = Account(email=email)
        validate_password(new_password, user=temp_user)

        attrs["email"] = email
        attrs["preidentified_email"] = preidentified_email
        return attrs


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)
    confirm_password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        from .auth_tokens import get_account_from_password_reset_token

        token = attrs.get("token", "")
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        account = get_account_from_password_reset_token(token)
        if account is None:
            raise serializers.ValidationError({"token": "This password reset link is invalid or has expired."})

        validate_password(new_password, user=account)

        attrs["account"] = account
        return attrs


class ResetTokenValidationSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        from .auth_tokens import get_account_from_password_reset_token

        token = attrs.get("token", "")
        account = get_account_from_password_reset_token(token)
        if account is None:
            raise serializers.ValidationError({"token": "This link is expired."})

        attrs["account"] = account
        return attrs


class PreidentifiedEmailSerializer(serializers.ModelSerializer):
    default_password = serializers.SerializerMethodField()

    class Meta:
        model = PreidentifiedEmail
        fields = ("id", "email", "role", "default_password", "created_at", "updated_at")

    def get_default_password(self, obj: PreidentifiedEmail) -> str:
        return ""


class PreidentifiedEmailUpsertSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        trim_whitespace=False,
        write_only=True,
    )

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_password(self, value: str) -> str:
        if not value:
            raise serializers.ValidationError("Password is required.")
        return value

    def save(self, **kwargs) -> tuple[PreidentifiedEmail, bool]:
        email = self.validated_data["email"]
        role = self.validated_data["role"]
        password = self.validated_data["password"]

        instance, created = PreidentifiedEmail.objects.get_or_create(email=email)
        instance.role = role
        instance.set_default_password(password)
        instance.save()
        return instance, created
