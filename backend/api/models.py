from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def member_profile_photo_upload_path(instance, filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"member-profile-photos/member-{instance.pk}.{extension}"


def member_default_profile_photo_upload_path(instance, filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"member-default-profile-photos/member-{instance.pk}.{extension}"


def lodge_document_upload_path(instance, filename: str) -> str:
    category = getattr(instance, "category", "document") or "document"
    safe_category = category.replace("_", "-")
    return f"lodge-documents/{safe_category}/{timezone.now():%Y/%m}/{filename}"


class AccountManager(BaseUserManager):
    def create_user(
        self,
        email: str,
        password: str | None = None,
        **extra_fields,
    ):
        if not email:
            raise ValueError("An email address is required.")

        email = self.normalize_email(email).lower()
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault(Account.ROLE_FIELD, Account.Role.MEMBER)

        if Account.is_reserved_developer_email(email):
            extra_fields[Account.ROLE_FIELD] = Account.Role.DEVELOPER
            extra_fields["is_active"] = True
            extra_fields["is_staff"] = True
            extra_fields["is_superuser"] = True

        if (
            extra_fields.get(Account.ROLE_FIELD) == Account.Role.DEVELOPER
            and not extra_fields.get("is_superuser", False)
        ):
            raise ValueError("The developer role is reserved for full-access superusers.")

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault(Account.ROLE_FIELD, Account.Role.DEVELOPER)

        if extra_fields["is_staff"] is not True:
            raise ValueError("Superuser must have is_staff=True.")

        if extra_fields["is_superuser"] is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email=email, password=password, **extra_fields)


class Account(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        SECRETARY = "secretary", "Secretary"
        THREE_LIGHTS = "three_lights", "3 Lights"
        ADMINISTRATOR = "administrator", "Administrator"
        DEVELOPER = "developer", "Developer"

    ROLE_FIELD = "role"

    email = models.EmailField(unique=True)
    glp_id_number = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    can_manage_activities = models.BooleanField(default=False)
    can_edit_members = models.BooleanField(default=False)
    can_edit_petitioners = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AccountManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "accounts"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.email

    @classmethod
    def get_reserved_developer_emails(cls) -> set[str]:
        return {email.strip().lower() for email in getattr(settings, "DEVELOPER_EMAILS", []) if email}

    @classmethod
    def is_reserved_developer_email(cls, email: str) -> bool:
        normalized_email = cls.objects.normalize_email(email).lower()
        return normalized_email in cls.get_reserved_developer_emails()

    def apply_reserved_developer_access(self) -> list[str]:
        if not self.is_reserved_developer_email(self.email):
            return []

        changed_fields: list[str] = []
        desired_values = {
            "role": self.Role.DEVELOPER,
            "is_active": True,
            "is_staff": True,
            "is_superuser": True,
        }

        for field_name, desired_value in desired_values.items():
            if getattr(self, field_name) != desired_value:
                setattr(self, field_name, desired_value)
                changed_fields.append(field_name)

        return changed_fields

    def ensure_reserved_developer_access(self, persist: bool = False) -> bool:
        changed_fields = self.apply_reserved_developer_access()
        if changed_fields and persist:
            self.save(update_fields=[*changed_fields, "updated_at"])
        return bool(changed_fields)

    def clean(self) -> None:
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email).lower()
        self.apply_reserved_developer_access()

        if self.role == self.Role.DEVELOPER and not self.is_superuser:
            raise ValidationError(
                {"role": "The developer role is reserved for full-access superusers."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class DashboardCardVisibility(models.Model):
    role = models.CharField(max_length=20, choices=Account.Role.choices, unique=True)
    lodge_health_indicator = models.BooleanField(default=True)
    members = models.BooleanField(default=True)
    petitioner = models.BooleanField(default=False)
    next_lodge_activity = models.BooleanField(default=True)
    dues_collection = models.BooleanField(default=True)
    financial_summary = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_dashboard_card_visibility"
        ordering = ["role"]
        verbose_name = "dashboard visibility by role"
        verbose_name_plural = "dashboard visibility by role"

    def __str__(self) -> str:
        return self.get_role_display()

    @classmethod
    def defaults(cls, role: str | None = None) -> dict[str, bool]:
        return {
            "lodge_health_indicator": True,
            "members": True,
            "petitioner": role == Account.Role.SECRETARY,
            "next_lodge_activity": True,
            "dues_collection": True,
            "financial_summary": True,
        }

    @classmethod
    def for_role(cls, role: str) -> dict[str, bool]:
        default_values = cls.defaults(role)
        values = cls.objects.filter(role=role).values(*default_values.keys()).first()
        return values or default_values


class ToolAccessLog(models.Model):
    class Tool(models.TextChoices):
        DOCUMENTS = "documents", "Documents"
        ACTIVITY = "activity", "Activity"
        EDIT_MEMBER = "edit_member", "Edit Member"
        EDIT_PETITIONER = "edit_petitioner", "Edit Petitioner"

    account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tool_access_logs",
    )
    email = models.EmailField()
    tool = models.CharField(max_length=40, choices=Tool.choices)
    last_accessed_at = models.DateTimeField(default=timezone.now)
    last_known_window = models.CharField(max_length=255, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    access_count = models.PositiveIntegerField(default=1)
    first_accessed_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "dll347_tool_access_logs"
        ordering = ["-last_accessed_at", "email"]
        constraints = [
            models.UniqueConstraint(fields=["account", "tool"], name="unique_account_tool_access"),
        ]
        indexes = [
            models.Index(fields=["tool", "-last_accessed_at"], name="tool_access_tool_last_idx"),
            models.Index(fields=["email"], name="tool_access_email_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.email} - {self.get_tool_display()}"


class PasswordResetToken(models.Model):
    account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "dll347_password_reset_tokens"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token"], name="pwd_reset_token_idx"),
            models.Index(fields=["account", "-created_at"], name="pwd_reset_account_created_idx"),
        ]

    def __str__(self) -> str:
        return self.token


class AuditLog(models.Model):
    class Action(models.TextChoices):
        APP_OPEN = "app_open", "App Opened"
        SCREEN_VIEW = "screen_view", "Screen Viewed"
        USER_ACTION = "user_action", "User Action"
        LOGOUT = "logout", "Logout"
        LOGIN_SUCCESS = "login_success", "Login Success"
        LOGIN_FAILED = "login_failed", "Login Failed"
        ACCOUNT_LOCKED = "account_locked", "Account Locked"
        PASSWORD_SETUP = "password_setup", "Password Setup"
        PASSWORD_RESET_REQUESTED = "password_reset_requested", "Password Reset Requested"
        PASSWORD_RESET = "password_reset", "Password Reset"
        MEMBER_UPDATED = "member_updated", "Member Updated"
        PETITIONER_UPDATED = "petitioner_updated", "Petitioner Updated"
        DOCUMENT_UPLOADED = "document_uploaded", "Document Uploaded"
        DOCUMENT_DELETED = "document_deleted", "Document Deleted"
        ACTIVITY_CREATED = "activity_created", "Activity Created"
        ACTIVITY_DELETED = "activity_deleted", "Activity Deleted"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=40, choices=Action.choices)
    target_model = models.CharField(max_length=100, blank=True)
    target_id = models.PositiveIntegerField(null=True, blank=True)
    screen = models.CharField(max_length=100, blank=True)
    event_label = models.CharField(max_length=100, blank=True)
    changes = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "dll347_audit_logs"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["actor", "-created_at"], name="audit_actor_created_idx"),
            models.Index(fields=["action", "-created_at"], name="audit_action_created_idx"),
            models.Index(fields=["screen", "-created_at"], name="audit_screen_created_idx"),
            models.Index(fields=["target_model", "target_id"], name="audit_target_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_action_display()} at {self.created_at}"


class PreidentifiedEmail(models.Model):
    ROLE_CHOICES = [
        (Account.Role.MEMBER, Account.Role.MEMBER.label),
        (Account.Role.SECRETARY, Account.Role.SECRETARY.label),
        (Account.Role.THREE_LIGHTS, Account.Role.THREE_LIGHTS.label),
        (Account.Role.ADMINISTRATOR, Account.Role.ADMINISTRATOR.label),
    ]

    email = models.EmailField(unique=True)
    default_password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=Account.Role.MEMBER)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "preidentified_emails"
        ordering = ["id"]

    def __str__(self) -> str:
        return self.email

    def set_default_password(self, raw_password: str) -> None:
        self.default_password = make_password(raw_password)

    def check_default_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.default_password)

    def save(self, *args, **kwargs):
        try:
            identify_hasher(self.default_password)
        except Exception:
            self.default_password = make_password(self.default_password)

        return super().save(*args, **kwargs)


class MembersWorkbookImport(models.Model):
    filename = models.CharField(max_length=255)
    file_sha256 = models.CharField(max_length=64, unique=True)
    sheet_summaries = models.JSONField(default=dict)
    imported_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        db_table = "members_workbook_imports"
        ordering = ["-imported_at", "-id"]

    def __str__(self) -> str:
        return self.filename


class MembersWorkbookSheetSchema(models.Model):
    workbook_import = models.ForeignKey(
        MembersWorkbookImport,
        on_delete=models.CASCADE,
        related_name="sheet_schemas",
    )
    sheet_name = models.CharField(max_length=100)
    table_key = models.CharField(max_length=50)
    dimension = models.CharField(max_length=30, blank=True)
    freeze_panes = models.JSONField(default=dict)
    merged_ranges = models.JSONField(default=list)
    columns = models.JSONField(default=list)
    row_formats = models.JSONField(default=list)

    class Meta:
        db_table = "members_workbook_sheet_schemas"
        constraints = [
            models.UniqueConstraint(
                fields=("workbook_import", "sheet_name"),
                name="unique_members_workbook_sheet_schema",
            )
        ]

    def __str__(self) -> str:
        return self.sheet_name


class MemberDatabaseRecord(models.Model):
    workbook_import = models.ForeignKey(
        MembersWorkbookImport,
        on_delete=models.PROTECT,
        related_name="member_records",
    )
    source_row = models.PositiveIntegerField(unique=True)
    is_test_record = models.BooleanField(default=False)
    section = models.CharField(max_length=150, blank=True)
    member_number = models.CharField(max_length=50, blank=True)
    name = models.CharField(max_length=255)
    glp_id_number = models.CharField(max_length=100, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    initiation_date = models.DateField(null=True, blank=True)
    passing_date = models.DateField(null=True, blank=True)
    raising_date = models.DateField(null=True, blank=True)
    proficiency_date = models.DateField(null=True, blank=True)
    suspension = models.CharField(max_length=100, blank=True)
    restored = models.CharField(max_length=100, blank=True)
    demit = models.CharField(max_length=100, blank=True)
    lml = models.CharField(max_length=100, blank=True)
    dual_plural_honorary_date = models.CharField(max_length=150, blank=True)
    address = models.TextField(blank=True)
    telephone = models.CharField(max_length=100, blank=True)
    email = models.CharField(max_length=255, blank=True)
    profile_photo = models.FileField(upload_to=member_profile_photo_upload_path, blank=True)
    default_profile_photo = models.FileField(upload_to=member_default_profile_photo_upload_path, blank=True)
    appendant_bodies = models.JSONField(default=dict)
    blood_type = models.CharField(max_length=30, blank=True)
    widow_or_sister = models.CharField(max_length=255, blank=True)
    widow_or_sister_date_of_birth = models.DateField(null=True, blank=True)
    meeting_attendance = models.JSONField(default=dict)
    monthly_attendance = models.JSONField(default=dict)
    annual_dues = models.JSONField(default=dict)
    raw_cells = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_member_database_records"
        ordering = ["source_row"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        normalized_section = self.section.strip().upper()
        if normalized_section.startswith("TRESTLE BOARD") or "PETITIONER" in normalized_section:
            self.glp_id_number = ""
        return super().save(*args, **kwargs)


class LodgeVisitorRecord(models.Model):
    workbook_import = models.ForeignKey(
        MembersWorkbookImport,
        on_delete=models.PROTECT,
        related_name="lodge_visitor_records",
    )
    source_row = models.PositiveIntegerField(unique=True)
    meeting = models.CharField(max_length=255, blank=True)
    meeting_date = models.DateField(null=True, blank=True)
    name = models.CharField(max_length=255)
    lodge = models.CharField(max_length=255, blank=True)
    raw_cells = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_lodge_visitor_records"
        ordering = ["source_row"]

    def __str__(self) -> str:
        return self.name


class LodgeActivity(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    title = models.CharField(max_length=255)
    details = models.TextField(blank=True)
    place = models.CharField(max_length=255)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    is_published = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_lodge_activities",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_lodge_activities"
        ordering = ["starts_at", "id"]
        indexes = [
            models.Index(fields=["starts_at"], name="lodge_activity_starts_idx"),
            models.Index(fields=["status", "is_published"], name="lodge_activity_status_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class MemberPositionHeld(models.Model):
    member_record = models.ForeignKey(
        MemberDatabaseRecord,
        on_delete=models.CASCADE,
        related_name="positions_held",
    )
    title = models.CharField(max_length=255)
    date_range = models.CharField(max_length=150)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    source = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_member_positions_held"
        ordering = ["member_record_id", "-start_date", "-end_date", "title"]
        indexes = [
            models.Index(fields=["member_record", "title"], name="mem_pos_member_title_idx"),
            models.Index(fields=["start_date", "end_date"], name="mem_pos_dates_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.date_range})"


class BallotingCoinRecord(models.Model):
    workbook_import = models.ForeignKey(
        MembersWorkbookImport,
        on_delete=models.PROTECT,
        related_name="balloting_coin_records",
    )
    member_record = models.ForeignKey(
        MemberDatabaseRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="balloting_coin_records",
    )
    source_row = models.PositiveIntegerField(unique=True)
    section = models.CharField(max_length=150, blank=True)
    member_number = models.CharField(max_length=50, blank=True)
    name = models.CharField(max_length=255)
    member_match_status = models.CharField(max_length=30, default="unmatched")
    member_match_notes = models.JSONField(default=dict)
    proficiency_date = models.DateField(null=True, blank=True)
    meeting_attendance = models.JSONField(default=dict)
    six_meetings_rule = models.IntegerField(null=True, blank=True)
    three_meetings_rule = models.IntegerField(null=True, blank=True)
    wm_coin_75_percent = models.IntegerField(null=True, blank=True)
    raw_cells = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_balloting_coin_records"
        ordering = ["source_row"]

    def __str__(self) -> str:
        return self.name


class LodgeDocument(models.Model):
    class Category(models.TextChoices):
        TREASURERS_REPORT = "treasurers_report", "Treasurers Report"
        STATED_MEETING_MINUTES = "minutes_stated_meeting", "Minutes of the Stated Meeting"
        SPECIAL_MEETING_MINUTES = "minutes_special_meeting", "Minutes of the Special Meeting"
        MEMBERS_DATA = "members_data", "Members Data"

    class ExtractionStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        PENDING_REVIEW = "pending_review", "Pending Review"
        EXTRACTED = "extracted", "Extracted"
        FAILED = "failed", "Failed"

    category = models.CharField(max_length=40, choices=Category.choices)
    file = models.FileField(upload_to=lodge_document_upload_path)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size_bytes = models.PositiveIntegerField()
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_lodge_documents",
    )
    extraction_status = models.CharField(
        max_length=30,
        choices=ExtractionStatus.choices,
        default=ExtractionStatus.NOT_APPLICABLE,
    )
    extraction_errors = models.JSONField(default=list)
    extracted_text = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_lodge_documents"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["category", "created_at"], name="lodge_doc_category_created_idx"),
        ]

    def __str__(self) -> str:
        return self.original_filename


class TreasurerReportSummary(models.Model):
    document = models.OneToOneField(
        LodgeDocument,
        on_delete=models.CASCADE,
        related_name="treasurer_summary",
    )
    report_month = models.PositiveSmallIntegerField(null=True, blank=True)
    report_year = models.PositiveSmallIntegerField(null=True, blank=True)
    previous_report_date = models.DateField(null=True, blank=True)
    cash_balance_last_report = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cash_received_month = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cash_to_date = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    cash_disbursements = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    remaining_cash = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    general_fund = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    specific_purpose_funds = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    other_sources = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    grand_lodge_account = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    other_account = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    raw_values = models.JSONField(default=dict)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dll347_treasurer_report_summaries"
        ordering = ["-report_year", "-report_month", "-id"]

    def __str__(self) -> str:
        if self.report_month and self.report_year:
            return f"Treasurer Report {self.report_month}/{self.report_year}"
        return f"Treasurer Report #{self.pk}"
