from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
import tempfile
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from unittest.mock import patch

from .auth_tokens import build_password_reset_token
from .excel_members import (
    ParsedCell,
    ParsedSheet,
    column_name,
    column_number,
    excel_date,
    is_numbered_record,
    member_name_match_key,
    normalize_member_name,
    sheet_columns,
    update_existing_members_from_workbook,
)
from .models import LodgeActivity, LodgeDocument, MemberDatabaseRecord, MemberPositionHeld, MembersWorkbookImport, PreidentifiedEmail, ToolAccessLog, TreasurerReportSummary


class ExcelMemberImportHelpersTests(SimpleTestCase):
    def test_excel_column_names_round_trip(self):
        for name in ("B", "Z", "AA", "GZ"):
            self.assertEqual(column_name(column_number(name)), name)

    def test_excel_date_uses_excel_1900_date_system(self):
        self.assertEqual(excel_date(25429), date(1969, 8, 14))
        self.assertIsNone(excel_date("N/A"))

    def test_sheet_columns_preserve_merged_headers_and_cell_styles(self):
        sheet = ParsedSheet(
            name="Test",
            dimension="A1:B2",
            cells={
                "A1": ParsedCell("Group", None, 7, "builtin:0"),
                "A2": ParsedCell("First", None, 8, "builtin:0"),
                "B2": ParsedCell("Second", None, 9, "builtin:0"),
            },
            merged_ranges=["A1:B1"],
            columns=[
                {
                    "min": 1,
                    "max": 2,
                    "width": 12.0,
                    "hidden": False,
                    "outline_level": 0,
                    "collapsed": False,
                    "style_id": 0,
                }
            ],
            row_formats=[],
            freeze_panes={},
        )

        columns = sheet_columns(sheet, "A", "B", (1, 2))

        self.assertEqual(columns[0]["header"], "Group / First")
        self.assertEqual(columns[1]["header"], "Group / Second")
        self.assertEqual(columns[0]["header_cells"]["1"]["style_id"], 7)

    def test_numbered_record_excludes_legend_rows(self):
        sheet = ParsedSheet(
            name="Test",
            dimension="B1:C2",
            cells={
                "B1": ParsedCell(1, None, 0, "builtin:0"),
                "C1": ParsedCell("Actual Member", None, 0, "builtin:0"),
                "B2": ParsedCell("*", None, 0, "builtin:0"),
                "C2": ParsedCell("- WM / PM", None, 0, "builtin:0"),
            },
            merged_ranges=[],
            columns=[],
            row_formats=[],
            freeze_panes={},
        )

        self.assertTrue(is_numbered_record(sheet, 1, "B", "C"))
        self.assertFalse(is_numbered_record(sheet, 2, "B", "C"))

    def test_member_name_match_key_handles_reordered_names(self):
        self.assertEqual(
            member_name_match_key("Martinez, Mike A. *"),
            member_name_match_key("Bro. Mike A Martinez"),
        )

    def test_member_name_normalization_removes_noise_tokens(self):
        self.assertEqual(
            normalize_member_name("FCM Dano, Cyrus Gil Q. Jr. +"),
            ("dano", "cyrus", "gil", "q"),
        )


class HealthcheckTests(SimpleTestCase):
    def test_healthcheck_returns_ok(self):
        response = self.client.get(reverse("api:healthcheck"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.json()["status"], "ok")
        self.assertNotIn("database", response.json())


class AccountModelTests(TestCase):
    def test_create_user_normalizes_email_and_hashes_password(self):
        user = get_user_model().objects.create_user(
            email="Admin@DLL347.org",
            password="StrongPass123!",
        )

        self.assertEqual(user.email, "admin@dll347.org")
        self.assertNotEqual(user.password, "StrongPass123!")
        self.assertTrue(user.check_password("StrongPass123!"))
        self.assertEqual(user.role, "member")
        self.assertFalse(user.is_staff)
        self.assertTrue(user.is_active)

    def test_three_lights_role_is_supported(self):
        user = get_user_model().objects.create_user(
            email="lights@dll347.org",
            password="StrongPass123!",
            role="three_lights",
        )

        self.assertEqual(user.role, "three_lights")
        self.assertEqual(user.get_role_display(), "3 Lights")

    def test_developer_role_is_reserved_for_superusers(self):
        with self.assertRaisesMessage(
            ValueError,
            "The developer role is reserved for full-access superusers.",
        ):
            get_user_model().objects.create_user(
                email="reserved@dll347.org",
                password="StrongPass123!",
                role="developer",
            )

    def test_non_superuser_cannot_be_saved_with_developer_role(self):
        user = get_user_model()(
            email="reserved2@dll347.org",
            role="developer",
            is_staff=True,
            is_superuser=False,
        )
        user.set_password("StrongPass123!")

        with self.assertRaises(ValidationError):
            user.save()

    def test_preidentified_email_hashes_default_password(self):
        record = PreidentifiedEmail.objects.create(
            email="pending@dll347.org",
            default_password="dll347",
        )

        self.assertNotEqual(record.default_password, "dll347")
        self.assertTrue(record.check_default_password("dll347"))

    @override_settings(DEVELOPER_EMAILS=["mikeangelofranco@outlook.com"])
    def test_reserved_developer_email_is_promoted_on_create(self):
        user = get_user_model().objects.create_user(
            email="MikeAngeloFranco@Outlook.com",
            password="StrongPass123!",
        )

        self.assertEqual(user.role, "developer")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)


class AuthApiTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = get_user_model().objects.create_user(
            email="member@dll347.org",
            password=self.password,
            role="administrator",
            is_staff=True,
        )

    def test_login_returns_account_payload(self):
        response = self.client.post(
            reverse("api:login"),
            {"email": self.user.email, "password": self.password},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["account"]["email"], self.user.email)
        self.assertEqual(payload["account"]["role"], "administrator")
        self.assertTrue(payload["account"]["is_staff"])
        self.assertFalse(payload["account"]["is_admin"])
        self.assertFalse(payload["account"]["can_edit_members"])
        self.assertEqual(payload["code"], "LOGIN_SUCCESS")

    def test_login_returns_three_lights_role(self):
        three_lights = get_user_model().objects.create_user(
            email="three-lights@dll347.org",
            password=self.password,
            role="three_lights",
        )

        response = self.client.post(
            reverse("api:login"),
            {"email": three_lights.email, "password": self.password},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["account"]["role"], "three_lights")

    def test_login_rejects_wrong_password_for_existing_account(self):
        response = self.client.post(
            reverse("api:login"),
            {"email": self.user.email, "password": "WrongPass123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "INVALID_CREDENTIALS")

    def test_login_requires_password_setup_for_preidentified_email(self):
        PreidentifiedEmail.objects.create(
            email="pending@dll347.org",
            default_password="Starter123!",
        )

        response = self.client.post(
            reverse("api:login"),
            {"email": "pending@dll347.org", "password": "Starter123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "PASSWORD_SETUP_REQUIRED")

    def test_preidentified_email_with_wrong_default_password_fails(self):
        PreidentifiedEmail.objects.create(
            email="pending2@dll347.org",
            default_password="Starter123!",
        )

        response = self.client.post(
            reverse("api:login"),
            {"email": "pending2@dll347.org", "password": "WrongStarter123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], "INVALID_CREDENTIALS")

    def test_login_rejects_unrecognized_email(self):
        response = self.client.post(
            reverse("api:login"),
            {"email": "outsider@dll347.org", "password": "Anything123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "NOT_AUTHORIZED")

    def test_setup_password_creates_account_and_consumes_preidentified_email(self):
        PreidentifiedEmail.objects.create(
            email="setup@dll347.org",
            default_password="dll347",
        )

        response = self.client.post(
            reverse("api:setup-password"),
            {
                "email": "setup@dll347.org",
                "default_password": "dll347",
                "new_password": "ValidPass123!",
                "confirm_password": "ValidPass123!",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["code"], "PASSWORD_UPDATED")
        account = get_user_model().objects.get(email="setup@dll347.org")
        self.assertTrue(account.check_password("ValidPass123!"))
        self.assertEqual(account.role, "member")
        self.assertFalse(PreidentifiedEmail.objects.filter(email="setup@dll347.org").exists())

    def test_setup_password_uses_preidentified_email_role(self):
        PreidentifiedEmail.objects.create(
            email="secretary-setup@dll347.org",
            default_password="dll347",
            role="secretary",
        )

        response = self.client.post(
            reverse("api:setup-password"),
            {
                "email": "secretary-setup@dll347.org",
                "default_password": "dll347",
                "new_password": "ValidPass123!",
                "confirm_password": "ValidPass123!",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        account = get_user_model().objects.get(email="secretary-setup@dll347.org")
        self.assertEqual(account.role, "secretary")

    def test_setup_password_rejects_wrong_default_password(self):
        PreidentifiedEmail.objects.create(
            email="setup2@dll347.org",
            default_password="dll347",
        )

        response = self.client.post(
            reverse("api:setup-password"),
            {
                "email": "setup2@dll347.org",
                "default_password": "wrong",
                "new_password": "ValidPass123!",
                "confirm_password": "ValidPass123!",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("default_password", response.json())

    @patch("api.views.send_password_reset_email")
    def test_forgot_password_sends_email_for_existing_account(self, mock_send_password_reset_email):
        response = self.client.post(
            reverse("api:forgot-password"),
            {"email": "member@dll347.org"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], "RESET_LINK_REQUESTED")
        self.assertIn("expire after", response.json()["message"])
        mock_send_password_reset_email.assert_called_once()

    @patch("api.views.send_password_reset_email")
    def test_forgot_password_rejects_unknown_email(self, mock_send_password_reset_email):
        response = self.client.post(
            reverse("api:forgot-password"),
            {"email": "unknown@dll347.org"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "EMAIL_NOT_FOUND")
        mock_send_password_reset_email.assert_not_called()

    def test_reset_password_updates_existing_account(self):
        token = build_password_reset_token(self.user)

        response = self.client.post(
            reverse("api:reset-password"),
            {
                "token": token,
                "new_password": "FreshPass123!",
                "confirm_password": "FreshPass123!",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], "PASSWORD_RESET_SUCCESS")
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("FreshPass123!"))

    def test_reset_password_rejects_invalid_token(self):
        response = self.client.post(
            reverse("api:reset-password"),
            {
                "token": "invalid-token",
                "new_password": "FreshPass123!",
                "confirm_password": "FreshPass123!",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("token", response.json())

    def test_validate_reset_password_token_accepts_valid_token(self):
        token = build_password_reset_token(self.user)

        response = self.client.get(
            reverse("api:validate-reset-password-token"),
            {"token": token},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], "RESET_LINK_VALID")

    def test_validate_reset_password_token_rejects_invalid_token(self):
        response = self.client.get(
            reverse("api:validate-reset-password-token"),
            {"token": "invalid-token"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("token", response.json())

    def test_csrf_endpoint_sets_cookie(self):
        response = self.client.get(reverse("api:csrf"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)

    def test_current_account_requires_login(self):
        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 403)

    def test_current_account_returns_logged_in_user(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], self.user.email)

    def test_current_account_returns_member_profile_matched_by_email(self):
        member_user = get_user_model().objects.create_user(
            email="mapped@dll347.org",
            password=self.password,
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="test.xlsx",
            file_sha256="a" * 64,
        )
        current_year = timezone.localdate().year
        previous_year = current_year - 1
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10001,
            name="Mapped Member",
            email="mapped@dll347.org",
            section="MASTER MASONS - ACTIVE",
            initiation_date=date(2019, 5, 12),
            monthly_attendance={
                f"{current_year} - WB Test / Jan": {"value": "a"},
                f"{current_year} - WB Test / Feb": {"value": "a"},
                f"{previous_year} - WB Test / Dec": {"value": "a"},
            },
            annual_dues={f"ANNUAL DUES / {current_year}": {"value": 45977}},
        )
        self.client.force_login(member_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        profile = response.json()["member_profile"]
        self.assertEqual(profile["name"], "Mapped Member")
        self.assertEqual(profile["status"], "Active Member")
        self.assertEqual(profile["dues_status"], f"Paid {current_year}")
        self.assertEqual(profile["attendance_this_year"], 2)
        self.assertIsNone(profile["profile_photo_url"])

    def test_current_account_uses_default_profile_photo_when_no_upload_exists(self):
        member_user = get_user_model().objects.create_user(
            email="default-photo@dll347.org",
            password=self.password,
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="default-photo.xlsx",
            file_sha256="c" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10004,
            name="Default Photo",
            email="default-photo@dll347.org",
            section="MASTER MASONS - ACTIVE",
            default_profile_photo="member-default-profile-photos/member-10004.png",
        )
        self.client.force_login(member_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        photo_url = response.json()["member_profile"]["profile_photo_url"]
        self.assertIn(member.default_profile_photo.url, photo_url)

    def test_uploaded_profile_photo_overrides_default_profile_photo(self):
        member_user = get_user_model().objects.create_user(
            email="override-photo@dll347.org",
            password=self.password,
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="override-photo.xlsx",
            file_sha256="e" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10005,
            name="Override Photo",
            email="override-photo@dll347.org",
            section="MASTER MASONS - ACTIVE",
            profile_photo="member-profile-photos/member-10005.jpg",
            default_profile_photo="member-default-profile-photos/member-10005.png",
        )
        self.client.force_login(member_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        photo_url = response.json()["member_profile"]["profile_photo_url"]
        self.assertIn(member.profile_photo.url, photo_url)
        self.assertNotIn(member.default_profile_photo.url, photo_url)

    def test_current_account_returns_member_profile_for_linked_secretary(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-profile@dll347.org",
            password=self.password,
            role="secretary",
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="secretary-profile.xlsx",
            file_sha256="9" * 64,
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10011,
            name="Secretary Profile",
            email="secretary-profile@dll347.org",
            section="MASTER MASONS - ACTIVE",
        )
        self.client.force_login(secretary_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["member_profile"]["name"], "Secretary Profile")

    def test_member_can_upload_profile_photo_for_linked_record(self):
        member_user = get_user_model().objects.create_user(
            email="photo@dll347.org",
            password=self.password,
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="test.xlsx",
            file_sha256="b" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10002,
            name="Photo Member",
            email="photo@dll347.org",
            section="MASTER MASONS - ACTIVE",
        )
        self.client.force_login(member_user)

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                response = self.client.post(
                    reverse("api:member-profile-photo"),
                    {
                        "photo": SimpleUploadedFile(
                            "profile.jpg",
                            b"fake-image-bytes",
                            content_type="image/jpeg",
                        )
                    },
                )

        self.assertEqual(response.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.profile_photo.name.startswith("member-profile-photos/member-"))
        self.assertIn("profile_photo_url", response.json()["member_profile"])

    def test_secretary_can_upload_profile_photo_for_linked_record(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-photo@dll347.org",
            password=self.password,
            role="secretary",
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="secretary-photo.xlsx",
            file_sha256="7" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10021,
            name="Secretary Photo",
            email="secretary-photo@dll347.org",
            section="MASTER MASONS - ACTIVE",
        )
        self.client.force_login(secretary_user)

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                response = self.client.post(
                    reverse("api:member-profile-photo"),
                    {
                        "photo": SimpleUploadedFile(
                            "profile.jpg",
                            b"fake-image-bytes",
                            content_type="image/jpeg",
                        )
                    },
                )

        self.assertEqual(response.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.profile_photo.name.startswith("member-profile-photos/member-"))

    def test_import_member_profile_photos_matches_glp_id_and_normalized_name(self):
        workbook_import = MembersWorkbookImport.objects.create(
            filename="profile-import.xlsx",
            file_sha256="f" * 64,
        )
        glp_member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10022,
            name="GLP Photo",
            email="glp-photo@dll347.org",
            section="MASTER MASONS - ACTIVE",
            glp_id_number="RVIIA-347-12345",
        )
        name_member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10023,
            name="Bro. Juan Miguel Dela Cruz Jr.",
            email="name-photo@dll347.org",
            section="MASTER MASONS - ACTIVE",
        )

        with tempfile.TemporaryDirectory() as image_folder, tempfile.TemporaryDirectory() as media_root:
            image_folder_path = Path(image_folder)
            (image_folder_path / "RVIIA-347-12345.png").write_bytes(b"glp-image")
            (image_folder_path / "Juan Dela Cruz.jpg").write_bytes(b"name-image")

            with override_settings(MEDIA_ROOT=media_root):
                call_command("import_member_profile_photos", image_folder)

                glp_member.refresh_from_db()
                name_member.refresh_from_db()

                self.assertTrue(glp_member.default_profile_photo.name.endswith(".png"))
                self.assertTrue(name_member.default_profile_photo.name.endswith(".jpg"))
                self.assertTrue(Path(media_root, glp_member.default_profile_photo.name).exists())
                self.assertTrue(Path(media_root, name_member.default_profile_photo.name).exists())

    def test_member_full_profile_returns_current_logged_in_member_details(self):
        member_user = get_user_model().objects.create_user(
            email="full-profile@dll347.org",
            password=self.password,
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="full-profile.xlsx",
            file_sha256="d" * 64,
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10003,
            name="Full Profile Member",
            email="full-profile@dll347.org",
            section="MASTER MASONS - ACTIVE",
            member_number="42",
            glp_id_number="GLP-42",
            date_of_birth=date(1985, 3, 15),
            initiation_date=date(2019, 5, 12),
            passing_date=date(2019, 6, 15),
            raising_date=date(2019, 7, 20),
            telephone="+1 555 123 4567",
            address="123 Masonic Way",
            monthly_attendance={f"{timezone.localdate().year} - WB Test / Jan": {"value": "a"}},
        )
        self.client.force_login(member_user)

        response = self.client.get(reverse("api:member-full-profile"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["name"], "Full Profile Member")
        self.assertEqual(payload["member_number"], "42")
        self.assertEqual(payload["glp_id_number"], "GLP-42")
        self.assertEqual(payload["date_of_birth"], "1985-03-15")
        self.assertEqual(payload["initiation_date"], "2019-05-12")
        self.assertEqual(payload["passing_date"], "2019-06-15")
        self.assertEqual(payload["raising_date"], "2019-07-20")
        self.assertEqual(payload["telephone"], "+1 555 123 4567")
        self.assertEqual(payload["address"], "123 Masonic Way")
        self.assertEqual(payload["attendance_this_year"], 1)

    def test_secretary_can_view_own_linked_member_profile(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-full-profile@dll347.org",
            password=self.password,
            role="secretary",
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="secretary-full-profile.xlsx",
            file_sha256="8" * 64,
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10012,
            name="Secretary Full Profile",
            email="secretary-full-profile@dll347.org",
            section="MASTER MASONS - ACTIVE",
            glp_id_number="GLP-S",
        )
        self.client.force_login(secretary_user)

        response = self.client.get(reverse("api:member-full-profile"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Secretary Full Profile")

    def test_current_account_returns_unpaid_dues_status_when_current_year_dues_are_blank_or_na(self):
        member_user = get_user_model().objects.create_user(
            email="unpaid-dues@dll347.org",
            password=self.password,
        )
        workbook_import = MembersWorkbookImport.objects.create(
            filename="unpaid-dues.xlsx",
            file_sha256="f" * 64,
        )
        current_year = timezone.localdate().year
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=10004,
            name="Unpaid Dues Member",
            email="unpaid-dues@dll347.org",
            section="MASTER MASONS - ACTIVE",
            annual_dues={f"ANNUAL DUES / {current_year}": {"value": "N/A"}},
        )
        self.client.force_login(member_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["member_profile"]["dues_status"], f"Unpaid {current_year}")

    def test_member_profile_photo_requires_linked_record(self):
        member_user = get_user_model().objects.create_user(
            email="unlinked-photo@dll347.org",
            password=self.password,
        )
        self.client.force_login(member_user)

        response = self.client.post(
            reverse("api:member-profile-photo"),
            {
                "photo": SimpleUploadedFile(
                    "profile.jpg",
                    b"fake-image-bytes",
                    content_type="image/jpeg",
                )
            },
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["code"], "MEMBER_PROFILE_NOT_LINKED")

    def test_member_summary_returns_counts_by_excel_section(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="summary.xlsx",
            file_sha256="c" * 64,
        )
        sections = [
            "MASTER MASONS - ACTIVE",
            "TRESTLE BOARD - ACTIVE",
            "MASTER MASONS (DUAL/PLURAL) - ACTIVE",
            "MASTER MASONS (HONORARY)",
            "MASTER MASONS - INACTIVE, SNPD, DEMIT",
            "TRESTLE BOARD - NOT ACTIVE",
            "DROPED THE WORKING TOOLS",
        ]
        for index, section in enumerate(sections, start=1):
            MemberDatabaseRecord.objects.create(
                workbook_import=workbook_import,
                source_row=11000 + index,
                name=f"Member {index}",
                email=f"member{index}@dll347.org",
                section=section,
            )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12000,
            name="Test Record",
            email="testrecord@dll347.org",
            section="MASTER MASONS - ACTIVE",
            is_test_record=True,
        )

        response = self.client.get(reverse("api:member-summary"))

        self.assertEqual(response.status_code, 200)
        counts = {item["key"]: item["count"] for item in response.json()["groups"]}
        self.assertEqual(counts["active"], 2)
        self.assertEqual(counts["dual_plural"], 1)
        self.assertEqual(counts["honorary"], 1)
        self.assertEqual(counts["inactive_snpd_demit"], 1)
        self.assertEqual(counts["dropped_working_tools"], 1)

    def test_member_summary_and_list_include_dynamic_excel_sections(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="dynamic-sections.xlsx",
            file_sha256="d" * 64,
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=13001,
            name="Custom Section One",
            email="custom-one@dll347.org",
            section="LODGE AFFILIATE - ACTIVE",
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=13002,
            name="Custom Section Two",
            email="custom-two@dll347.org",
            section="LODGE AFFILIATE - ACTIVE",
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=13003,
            name="Emeritus Member",
            email="emeritus@dll347.org",
            section="EMERITUS MEMBERS",
        )

        summary_response = self.client.get(reverse("api:member-summary"))

        self.assertEqual(summary_response.status_code, 200)
        groups = summary_response.json()["groups"]
        affiliate_group = next(item for item in groups if item["section"] == "LODGE AFFILIATE - ACTIVE")
        emeritus_group = next(item for item in groups if item["section"] == "EMERITUS MEMBERS")
        self.assertEqual(affiliate_group["label"], "Lodge Affiliate - Active")
        self.assertEqual(affiliate_group["count"], 2)
        self.assertEqual(emeritus_group["label"], "Emeritus Members")
        self.assertEqual(emeritus_group["count"], 1)

        list_response = self.client.get(reverse("api:member-list"), {"group": affiliate_group["key"]})

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["count"], 2)
        self.assertEqual(
            [member["group_label"] for member in list_response.json()["members"]],
            ["Lodge Affiliate - Active", "Lodge Affiliate - Active"],
        )

    def test_member_workbook_update_prefers_name_when_member_numbers_repeat(self):
        workbook_import = MembersWorkbookImport.objects.create(
            filename="duplicate-member-numbers.xlsx",
            file_sha256="e" * 64,
        )
        first_member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=14,
            member_number="3",
            name="Almagro, Erwin Ian V.",
            section="MASTER MASONS - ACTIVE",
        )
        target_member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=95,
            member_number="3",
            name="Limpangog. Jay Neil A. - SNPD",
            section="MASTER MASONS - INACTIVE, SNPD, DEMIT",
        )
        incoming_member = MemberDatabaseRecord(
            source_row=95,
            member_number="3",
            name="Limpangog. Jay Neil A. - SNPD",
            section="MASTER MASONS - INACTIVE",
        )

        with tempfile.NamedTemporaryFile(suffix=".xlsx") as workbook_file:
            workbook_file.write(b"workbook bytes")
            workbook_file.flush()
            with patch(
                "api.excel_members.parsed_member_records_from_workbook",
                return_value=([incoming_member], {"DLL 347 Members Database": {"records": 1, "columns": 207}}),
            ):
                result = update_existing_members_from_workbook(workbook_file.name)

        self.assertEqual(result.updated_count, 1)
        first_member.refresh_from_db()
        target_member.refresh_from_db()
        self.assertEqual(first_member.section, "MASTER MASONS - ACTIVE")
        self.assertEqual(target_member.section, "MASTER MASONS - INACTIVE")

    def test_member_list_includes_test_records_and_excludes_trestle_board(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="member-list.xlsx",
            file_sha256="1" * 64,
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12501,
            name="Searchable Test Member",
            email="searchable-test@dll347.org",
            section="MASTER MASONS - ACTIVE",
            is_test_record=True,
        )
        MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12502,
            name="Searchable Trestle Member",
            email="searchable-trestle@dll347.org",
            section="TRESTLE BOARD - ACTIVE",
            is_test_record=True,
        )

        response = self.client.get(reverse("api:member-list"), {"group": "active", "search": "Searchable"})

        self.assertEqual(response.status_code, 200)
        members = response.json()["members"]
        self.assertEqual([member["name"] for member in members], ["Searchable Test Member"])

    def test_member_detail_profile_returns_selected_non_trestle_member(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="member-detail.xlsx",
            file_sha256="6" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12511,
            name="Selected Detail Member",
            email="selected-detail@dll347.org",
            section="MASTER MASONS - ACTIVE",
            glp_id_number="GLP-D",
        )

        response = self.client.get(reverse("api:member-detail-profile", args=[member.id]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Selected Detail Member")
        self.assertEqual(response.json()["glp_id_number"], "GLP-D")

    def test_member_detail_profile_excludes_trestle_board_member(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="member-detail-trestle.xlsx",
            file_sha256="5" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12512,
            name="Selected Trestle Member",
            email="selected-trestle@dll347.org",
            section="TRESTLE BOARD - ACTIVE",
        )

        response = self.client.get(reverse("api:member-detail-profile", args=[member.id]))

        self.assertEqual(response.status_code, 404)

    def test_secretary_dashboard_summary_uses_live_member_metrics(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="secretary-dashboard.xlsx",
            file_sha256="e" * 64,
        )
        current_year = timezone.localdate().year
        member_rows = [
            (
                "MASTER MASONS - ACTIVE",
                {f"{current_year} - WB Test / Jan": {"value": "a"}, f"{current_year} - WB Test / Feb": {"value": "a"}},
                {f"ANNUAL DUES / {current_year}": {"value": f"Jan {current_year}"}},
            ),
            (
                "MASTER MASONS (DUAL/PLURAL) - ACTIVE",
                {f"{current_year} - WB Test / Jan": {"value": "a"}},
                {f"ANNUAL DUES / {current_year}": {"value": f"Feb {current_year}"}},
            ),
            ("MASTER MASONS (HONORARY)", {}, {}),
            ("MASTER MASONS - INACTIVE, SNPD, DEMIT", {f"{current_year} - WB Test / Jan": {"value": "a"}}, {}),
            ("DROPED THE WORKING TOOLS", {f"{current_year} - WB Test / Jan": {"value": "a"}}, {}),
            ("TRESTLE BOARD - ACTIVE", {f"{current_year} - WB Test / Jan": {"value": "a"}}, {}),
            ("TRESTLE BOARD - ACTIVE", {f"{current_year} - WB Test / Jan": {"value": "a"}}, {}),
            ("TRESTLE BOARD - NOT ACTIVE", {}, {}),
        ]
        for index, (section, monthly_attendance, annual_dues) in enumerate(member_rows, start=1):
            prefix = "EAM " if index in (6, 8) else "FCM " if index == 7 else ""
            MemberDatabaseRecord.objects.create(
                workbook_import=workbook_import,
                source_row=13000 + index,
                name=f"{prefix}Dashboard Member {index}",
                email=f"dashboard{index}@dll347.org",
                section=section,
                annual_dues=annual_dues,
                monthly_attendance=monthly_attendance,
            )

        response = self.client.get(reverse("api:secretary-dashboard-summary"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["membership"], {"active_count": 1, "total_count": 5, "percent": 20})
        self.assertEqual(payload["growth"], {"progressing_count": 2, "total_count": 2, "percent": 100})
        self.assertEqual(payload["finances"]["percent"], 0)
        self.assertEqual(payload["finances"]["status"], "No Treasurer report yet")
        self.assertFalse(payload["finances"]["has_data"])
        self.assertEqual(
            payload["attendance"],
            {"average_count": 2, "total_count": 3, "meeting_count": 2, "percent": 67},
        )
        self.assertEqual(
            payload["dues_collection"],
            {"paid_count": 2, "unpaid_count": 1, "total_count": 3, "percent": 67},
        )
        self.assertEqual(payload["overall_percent"], 64)

    def test_three_lights_can_load_secretary_dashboard_summary(self):
        three_lights_user = get_user_model().objects.create_user(
            email="three-lights-dashboard@dll347.org",
            password=self.password,
            role="three_lights",
        )
        self.client.force_login(three_lights_user)

        response = self.client.get(reverse("api:secretary-dashboard-summary"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("overall_percent", response.json())

    def test_financial_summary_uses_filename_period_when_extracted_year_is_wrong(self):
        three_lights_user = get_user_model().objects.create_user(
            email="three-lights-finances@dll347.org",
            password=self.password,
            role="three_lights",
        )
        self.client.force_login(three_lights_user)
        june_document = LodgeDocument.objects.create(
            category=LodgeDocument.Category.TREASURERS_REPORT,
            file=SimpleUploadedFile("06 DLL 347 Treasurers Report June 2025.pdf", b"%PDF-1.4\n", content_type="application/pdf"),
            original_filename="06 DLL 347 Treasurers Report June 2025.pdf",
            content_type="application/pdf",
            size_bytes=9,
            uploaded_by=three_lights_user,
            extraction_status=LodgeDocument.ExtractionStatus.EXTRACTED,
        )
        december_document = LodgeDocument.objects.create(
            category=LodgeDocument.Category.TREASURERS_REPORT,
            file=SimpleUploadedFile("12 DLL 347 Treasurers Report December 2025.pdf", b"%PDF-1.4\n", content_type="application/pdf"),
            original_filename="12 DLL 347 Treasurers Report December 2025.pdf",
            content_type="application/pdf",
            size_bytes=9,
            uploaded_by=three_lights_user,
            extraction_status=LodgeDocument.ExtractionStatus.EXTRACTED,
        )
        TreasurerReportSummary.objects.create(
            document=june_document,
            report_month=6,
            report_year=2026,
            cash_to_date=Decimal("243875.61"),
            cash_disbursements=Decimal("63915.71"),
            remaining_cash=Decimal("179959.90"),
        )
        TreasurerReportSummary.objects.create(
            document=december_document,
            report_month=12,
            report_year=2025,
            cash_to_date=Decimal("559344.51"),
            cash_disbursements=Decimal("211040.00"),
            remaining_cash=Decimal("348304.51"),
        )

        response = self.client.get(reverse("api:secretary-dashboard-summary"))

        self.assertEqual(response.status_code, 200)
        finances = response.json()["finances"]
        self.assertEqual(finances["report_month"], 12)
        self.assertEqual(finances["report_year"], 2025)
        self.assertEqual(finances["report_period_label"], "December 2025")
        self.assertEqual(finances["cash_to_date"], "348304.51")

    def test_next_lodge_activity_returns_nearest_upcoming_published_activity(self):
        self.client.force_login(self.user)
        later = LodgeActivity.objects.create(
            title="Later Activity",
            place="Lodge Hall",
            starts_at=timezone.now() + timedelta(days=10),
        )
        nearest = LodgeActivity.objects.create(
            title="Nearest Activity",
            place="Temple",
            starts_at=timezone.now() + timedelta(days=2),
        )
        LodgeActivity.objects.create(
            title="Past Activity",
            place="Lodge Hall",
            starts_at=timezone.now() - timedelta(days=1),
        )
        LodgeActivity.objects.create(
            title="Hidden Activity",
            place="Lodge Hall",
            starts_at=timezone.now() + timedelta(days=1),
            is_published=False,
        )
        LodgeActivity.objects.create(
            title="Cancelled Activity",
            place="Lodge Hall",
            starts_at=timezone.now() + timedelta(hours=6),
            status=LodgeActivity.Status.CANCELLED,
        )

        response = self.client.get(reverse("api:next-lodge-activity"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["activity"]["id"], nearest.id)
        self.assertNotEqual(response.json()["activity"]["id"], later.id)

    def test_next_lodge_activity_returns_null_when_none_upcoming(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("api:next-lodge-activity"))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["activity"])

    def test_current_account_returns_null_profile_when_email_is_unmapped(self):
        member_user = get_user_model().objects.create_user(
            email="unmapped@dll347.org",
            password=self.password,
        )
        self.client.force_login(member_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["member_profile"])

    def test_secretary_can_access_lodge_documents(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-documents@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        response = self.client.get(reverse("api:lodge-documents"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"documents": []})

    def test_non_secretary_cannot_access_lodge_documents(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse("api:lodge-documents"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "DOCUMENTS_ACCESS_DENIED")

    def test_treasurer_report_upload_queues_extraction(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-upload@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            upload = SimpleUploadedFile(
                "02 DLL 347 Treasurers Report Feb 2025.pdf",
                b"%PDF-1.4\n% test treasurer report\n",
                content_type="application/pdf",
            )

            with patch("api.views.queue_treasurer_report_extraction") as queue_extraction:
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(
                        reverse("api:lodge-documents"),
                        {
                            "category": LodgeDocument.Category.TREASURERS_REPORT,
                            "notes": "",
                            "files": [upload],
                        },
                    )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["results"][0]["status"], "uploaded")
        self.assertEqual(response.json()["results"][0]["document"]["extraction_status"], "pending_review")
        queue_extraction.assert_called_once()

    def test_members_data_upload_queues_update(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-members-data@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            upload = SimpleUploadedFile(
                "DLL 347 Members Data.xlsx",
                b"not a real workbook",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

            with patch("api.views.process_members_data_document") as process_members_data:
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(
                        reverse("api:lodge-documents"),
                        {
                            "category": LodgeDocument.Category.MEMBERS_DATA,
                            "notes": "",
                            "files": [upload],
                        },
                    )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["results"][0]["status"], "uploaded")
        self.assertEqual(response.json()["results"][0]["document"]["category"], "members_data")
        self.assertEqual(response.json()["results"][0]["document"]["extraction_status"], "pending_review")
        process_members_data.assert_called_once()
        self.assertEqual(process_members_data.call_args.kwargs, {"manage_connections": False})

    def test_members_data_upload_replaces_existing_members_workbook(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-members-data-replace@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            existing = LodgeDocument.objects.create(
                category=LodgeDocument.Category.MEMBERS_DATA,
                file=SimpleUploadedFile(
                    "old-members.xlsx",
                    b"old workbook",
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
                original_filename="old-members.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                size_bytes=12,
                uploaded_by=secretary_user,
            )
            old_file_path = existing.file.path
            upload = SimpleUploadedFile(
                "DLL 347 Members Data.xlsx",
                b"new workbook",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

            with patch("api.views.process_members_data_document") as process_members_data:
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(
                        reverse("api:lodge-documents"),
                        {
                            "category": LodgeDocument.Category.MEMBERS_DATA,
                            "notes": "",
                            "files": [upload],
                        },
                    )

            self.assertEqual(response.status_code, 201)
            self.assertFalse(Path(old_file_path).exists())
            self.assertEqual(LodgeDocument.objects.filter(category=LodgeDocument.Category.MEMBERS_DATA).count(), 1)
            self.assertEqual(LodgeDocument.objects.get(category=LodgeDocument.Category.MEMBERS_DATA).original_filename, "DLL 347 Members Data.xlsx")
            process_members_data.assert_called_once()
            self.assertEqual(process_members_data.call_args.kwargs, {"manage_connections": False})

    def test_members_data_rejects_non_xlsx_upload(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-members-data-invalid@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        upload = SimpleUploadedFile(
            "DLL 347 Members Data.pdf",
            b"%PDF-1.4\n",
            content_type="application/pdf",
        )

        response = self.client.post(
            reverse("api:lodge-documents"),
            {
                "category": LodgeDocument.Category.MEMBERS_DATA,
                "notes": "",
                "files": [upload],
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["results"][0]["status"], "rejected")
        self.assertIn(".xlsx", " ".join(response.json()["results"][0]["errors"]))

    def test_secretary_can_delete_lodge_document(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-delete-document@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            document = LodgeDocument.objects.create(
                category=LodgeDocument.Category.STATED_MEETING_MINUTES,
                file=SimpleUploadedFile("minutes.pdf", b"%PDF-1.4\n", content_type="application/pdf"),
                original_filename="minutes.pdf",
                content_type="application/pdf",
                size_bytes=9,
                uploaded_by=secretary_user,
            )
            file_path = document.file.path

            response = self.client.delete(reverse("api:lodge-document-detail", args=[document.id]))

            self.assertEqual(response.status_code, 200)
            self.assertFalse(LodgeDocument.objects.filter(pk=document.id).exists())
            self.assertFalse(Path(file_path).exists())

    def test_document_tool_access_is_logged_for_authorized_user(self):
        secretary_user = get_user_model().objects.create_user(
            email="secretary-tool-log@dll347.org",
            password=self.password,
            role="secretary",
        )
        self.client.force_login(secretary_user)

        response = self.client.get(
            reverse("api:lodge-documents"),
            HTTP_X_DLL347_WINDOW="/dashboard?view=documents",
            HTTP_USER_AGENT="DLL347 PWA",
        )
        second_response = self.client.get(
            reverse("api:lodge-documents"),
            HTTP_X_DLL347_WINDOW="/dashboard?view=documents&tab=list",
            HTTP_USER_AGENT="DLL347 PWA",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        log = ToolAccessLog.objects.get(account=secretary_user, tool=ToolAccessLog.Tool.DOCUMENTS)
        self.assertEqual(log.email, "secretary-tool-log@dll347.org")
        self.assertEqual(log.last_known_window, "/dashboard?view=documents&tab=list")
        self.assertEqual(log.user_agent, "DLL347 PWA")
        self.assertEqual(log.access_count, 2)

    def test_denied_tool_access_is_not_logged(self):
        self.client.force_login(self.user)

        response = self.client.get(
            reverse("api:lodge-documents"),
            HTTP_X_DLL347_WINDOW="/dashboard?view=documents",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(ToolAccessLog.objects.filter(account=self.user).exists())

    def test_activity_create_requires_activity_permission(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("api:create-lodge-activity"),
            {
                "title": "Stated Meeting",
                "details": "Monthly stated meeting.",
                "place": "Lodge Hall",
                "starts_at": "2026-07-10T18:00:00+08:00",
                "ends_at": "2026-07-10T21:00:00+08:00",
                "status": "scheduled",
                "is_published": True,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "ACTIVITY_ACCESS_DENIED")

    def test_activity_manager_can_create_activity(self):
        activity_manager = get_user_model().objects.create_user(
            email="activity-manager@dll347.org",
            password=self.password,
            can_manage_activities=True,
        )
        self.client.force_login(activity_manager)

        response = self.client.post(
            reverse("api:create-lodge-activity"),
            {
                "title": "Stated Meeting",
                "details": "Monthly stated meeting.",
                "place": "Lodge Hall",
                "starts_at": "2026-07-10T18:00:00+08:00",
                "ends_at": "2026-07-10T21:00:00+08:00",
                "status": "scheduled",
                "is_published": True,
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["activity"]["title"], "Stated Meeting")
        self.assertTrue(LodgeActivity.objects.filter(title="Stated Meeting", created_by=activity_manager).exists())

    def test_activity_manager_can_list_and_search_activities_latest_first(self):
        activity_manager = get_user_model().objects.create_user(
            email="activity-list-manager@dll347.org",
            password=self.password,
            can_manage_activities=True,
        )
        self.client.force_login(activity_manager)
        older = LodgeActivity.objects.create(
            title="Older Fellowship",
            place="Lodge Hall",
            starts_at=timezone.now() + timedelta(days=1),
        )
        newer = LodgeActivity.objects.create(
            title="Latest Degree Work",
            place="Temple",
            starts_at=timezone.now() + timedelta(days=3),
        )

        response = self.client.get(reverse("api:managed-lodge-activities"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()["activities"][:2]], [newer.id, older.id])

        search_response = self.client.get(reverse("api:managed-lodge-activities"), {"search": "degree"})
        self.assertEqual(search_response.status_code, 200)
        self.assertEqual([item["id"] for item in search_response.json()["activities"]], [newer.id])

    def test_activity_manager_can_delete_activity(self):
        activity_manager = get_user_model().objects.create_user(
            email="activity-delete-manager@dll347.org",
            password=self.password,
            can_manage_activities=True,
        )
        self.client.force_login(activity_manager)
        activity = LodgeActivity.objects.create(
            title="Delete Me",
            place="Lodge Hall",
            starts_at=timezone.now() + timedelta(days=1),
        )

        response = self.client.delete(reverse("api:lodge-activity-detail", args=[activity.id]))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(LodgeActivity.objects.filter(pk=activity.id).exists())

    def test_member_edit_requires_member_edit_permission(self):
        self.client.force_login(self.user)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="member-edit-permission.xlsx",
            file_sha256="e" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12001,
            name="Readonly Member",
            section="MASTER MASONS - ACTIVE",
        )

        response = self.client.get(reverse("api:member-edit-profile", args=[member.id]))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "MEMBER_EDIT_FORBIDDEN")

    def test_member_editor_can_update_member_record(self):
        editor = get_user_model().objects.create_user(
            email="member-editor@dll347.org",
            password=self.password,
            can_edit_members=True,
        )
        self.client.force_login(editor)
        workbook_import = MembersWorkbookImport.objects.create(
            filename="member-edit.xlsx",
            file_sha256="f" * 64,
        )
        member = MemberDatabaseRecord.objects.create(
            workbook_import=workbook_import,
            source_row=12002,
            name="Original Member",
            email="original@dll347.org",
            section="MASTER MASONS - ACTIVE",
            member_number="12",
            glp_id_number="GLP-OLD",
            date_of_birth=date(1980, 1, 2),
            initiation_date=date(2010, 3, 4),
            passing_date=date(2010, 5, 6),
            raising_date=date(2010, 7, 8),
            proficiency_date=date(2011, 9, 10),
            suspension="Old suspension",
            restored="Old restored",
            demit="Old demit",
            lml="Old lml",
            dual_plural_honorary_date="Old dual",
            widow_or_sister="Old widow",
            widow_or_sister_date_of_birth=date(1981, 2, 3),
            appendant_bodies={
                "APPENDANT BODIES / CLUB / YORK RITE": {
                    "value": "",
                    "formula": None,
                    "style_id": 83,
                    "number_format": "builtin:0",
                }
            },
            meeting_attendance={
                "2026 - WB Test / UD": {
                    "value": "",
                    "formula": None,
                    "style_id": 93,
                    "number_format": "builtin:0",
                }
            },
            monthly_attendance={
                "2026 - WB Test / Jan": {
                    "value": "",
                    "formula": None,
                    "style_id": 62,
                    "number_format": "builtin:0",
                }
            },
            annual_dues={
                "ANNUAL DUES / 2026": {
                    "value": "",
                    "formula": None,
                    "style_id": 75,
                    "number_format": "builtin:0",
                }
            },
        )
        MemberPositionHeld.objects.create(
            member_record=member,
            title="Old Role",
            date_range="2020",
        )

        response = self.client.patch(
            reverse("api:member-edit-profile", args=[member.id]),
            {
                "name": "Updated Member",
                "section": "DUAL / PLURAL",
                "member_number": "34",
                "glp_id_number": "GLP-NEW",
                "date_of_birth": "1985-01-02",
                "initiation_date": "2015-03-04",
                "passing_date": "2015-05-06",
                "raising_date": "2015-07-08",
                "proficiency_date": "2016-09-10",
                "suspension": "Updated suspension",
                "restored": "Updated restored",
                "demit": "Updated demit",
                "lml": "Updated lml",
                "dual_plural_honorary_date": "Updated dual",
                "email": "Updated@DLL347.org",
                "telephone": "0917 000 0000",
                "address": "Updated address",
                "blood_type": "O+",
                "widow_or_sister": "Updated widow",
                "widow_or_sister_date_of_birth": "1986-02-03",
                "appendant_bodies": {
                    "APPENDANT BODIES / CLUB / YORK RITE": {
                        "value": "a",
                        "formula": None,
                        "style_id": 83,
                        "number_format": "builtin:0",
                    }
                },
                "meeting_attendance": {
                    "2026 - WB Test / UD": {
                        "value": "a",
                        "formula": None,
                        "style_id": 93,
                        "number_format": "builtin:0",
                    }
                },
                "monthly_attendance": {
                    "2026 - WB Test / Jan": {
                        "value": "a",
                        "formula": None,
                        "style_id": 62,
                        "number_format": "builtin:0",
                    }
                },
                "annual_dues": {
                    "ANNUAL DUES / 2026": {
                        "value": "Paid",
                        "formula": None,
                        "style_id": 75,
                        "number_format": "builtin:0",
                    }
                },
                "positions_held": [
                    {
                        "title": "Secretary",
                        "date_range": "2025 - Present",
                        "start_date": "2025-01-01",
                        "end_date": None,
                        "notes": "Elected",
                        "source": "manual",
                    }
                ],
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["member"]["name"], "Updated Member")
        self.assertEqual(payload["member"]["email"], "updated@dll347.org")
        member.refresh_from_db()
        self.assertEqual(member.section, "DUAL / PLURAL")
        self.assertEqual(member.member_number, "34")
        self.assertEqual(member.glp_id_number, "GLP-NEW")
        self.assertEqual(member.date_of_birth, date(1985, 1, 2))
        self.assertEqual(member.initiation_date, date(2015, 3, 4))
        self.assertEqual(member.passing_date, date(2015, 5, 6))
        self.assertEqual(member.raising_date, date(2015, 7, 8))
        self.assertEqual(member.proficiency_date, date(2016, 9, 10))
        self.assertEqual(member.suspension, "Updated suspension")
        self.assertEqual(member.restored, "Updated restored")
        self.assertEqual(member.demit, "Updated demit")
        self.assertEqual(member.lml, "Updated lml")
        self.assertEqual(member.dual_plural_honorary_date, "Updated dual")
        self.assertEqual(member.telephone, "0917 000 0000")
        self.assertEqual(member.address, "Updated address")
        self.assertEqual(member.blood_type, "O+")
        self.assertEqual(member.widow_or_sister, "Updated widow")
        self.assertEqual(member.widow_or_sister_date_of_birth, date(1986, 2, 3))
        self.assertEqual(member.appendant_bodies["APPENDANT BODIES / CLUB / YORK RITE"]["value"], "a")
        self.assertEqual(member.appendant_bodies["APPENDANT BODIES / CLUB / YORK RITE"]["style_id"], 83)
        self.assertEqual(member.meeting_attendance["2026 - WB Test / UD"]["value"], "a")
        self.assertEqual(member.meeting_attendance["2026 - WB Test / UD"]["style_id"], 93)
        self.assertEqual(member.monthly_attendance["2026 - WB Test / Jan"]["value"], "a")
        self.assertEqual(member.monthly_attendance["2026 - WB Test / Jan"]["style_id"], 62)
        self.assertEqual(member.annual_dues["ANNUAL DUES / 2026"]["value"], "Paid")
        self.assertEqual(member.annual_dues["ANNUAL DUES / 2026"]["style_id"], 75)
        self.assertEqual(member.positions_held.count(), 1)
        self.assertEqual(member.positions_held.first().title, "Secretary")

    def test_logout_clears_session(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse("api:logout"))

        self.assertEqual(response.status_code, 200)
        follow_up = self.client.get(reverse("api:current-account"))
        self.assertEqual(follow_up.status_code, 403)

    @override_settings(DEVELOPER_EMAILS=["mikeangelofranco@outlook.com"])
    def test_login_promotes_reserved_developer_account(self):
        reserved_user = get_user_model().objects.create_user(
            email="mikeangelofranco@outlook.com",
            password="StrongPass123!",
        )
        get_user_model().objects.filter(pk=reserved_user.pk).update(
            role="member",
            is_staff=False,
            is_superuser=False,
        )

        response = self.client.post(
            reverse("api:login"),
            {"email": reserved_user.email, "password": "StrongPass123!"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["account"]["role"], "developer")
        reserved_user.refresh_from_db()
        self.assertTrue(reserved_user.is_staff)
        self.assertTrue(reserved_user.is_superuser)

    @override_settings(DEVELOPER_EMAILS=["mikeangelofranco@outlook.com"])
    def test_current_account_promotes_reserved_developer_account(self):
        reserved_user = get_user_model().objects.create_user(
            email="mikeangelofranco@outlook.com",
            password="StrongPass123!",
        )
        get_user_model().objects.filter(pk=reserved_user.pk).update(
            role="member",
            is_staff=False,
            is_superuser=False,
        )
        self.client.force_login(reserved_user)

        response = self.client.get(reverse("api:current-account"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "developer")
        reserved_user.refresh_from_db()
        self.assertTrue(reserved_user.is_staff)
        self.assertTrue(reserved_user.is_superuser)


class PreidentifiedEmailAdminApiTests(TestCase):
    def setUp(self):
        self.developer = get_user_model().objects.create_superuser(
            email="developer@dll347.org",
            password="StrongPass123!",
        )
        self.member = get_user_model().objects.create_user(
            email="member2@dll347.org",
            password="StrongPass123!",
            role="member",
            is_staff=False,
        )

    def test_preidentified_emails_requires_authentication(self):
        response = self.client.get(reverse("api:preidentified-emails"))

        self.assertEqual(response.status_code, 403)

    def test_preidentified_emails_requires_developer_role(self):
        self.client.force_login(self.member)

        response = self.client.get(reverse("api:preidentified-emails"))

        self.assertEqual(response.status_code, 403)

    def test_developer_can_list_preidentified_emails(self):
        PreidentifiedEmail.objects.create(email="zeta@dll347.org", default_password="dll347")
        PreidentifiedEmail.objects.create(email="alpha@dll347.org", default_password="dll347", role="secretary")
        self.client.force_login(self.developer)

        response = self.client.get(reverse("api:preidentified-emails"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual([item["email"] for item in payload], ["alpha@dll347.org", "zeta@dll347.org"])
        self.assertTrue(all(item["default_password"] == "dll347" for item in payload))
        self.assertEqual([item["role"] for item in payload], ["secretary", "member"])

    def test_developer_can_save_preidentified_email(self):
        self.client.force_login(self.developer)

        response = self.client.post(
            reverse("api:preidentified-emails"),
            {"email": "pending@dll347.org", "password": "dll347", "role": "three_lights"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        record = PreidentifiedEmail.objects.get(email="pending@dll347.org")
        self.assertTrue(record.check_default_password("dll347"))
        self.assertEqual(record.role, "three_lights")
        self.assertEqual(response.json()["record"]["default_password"], "dll347")
        self.assertEqual(response.json()["record"]["role"], "three_lights")

    def test_developer_save_updates_existing_preidentified_email(self):
        PreidentifiedEmail.objects.create(email="pending@dll347.org", default_password="OldPass123!")
        self.client.force_login(self.developer)

        response = self.client.post(
            reverse("api:preidentified-emails"),
            {"email": "pending@dll347.org", "password": "dll347"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        record = PreidentifiedEmail.objects.get(email="pending@dll347.org")
        self.assertTrue(record.check_default_password("dll347"))
