from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from unittest.mock import patch

from .auth_tokens import build_password_reset_token
from .models import PreidentifiedEmail


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
        self.assertEqual(payload["code"], "LOGIN_SUCCESS")

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
        self.assertFalse(PreidentifiedEmail.objects.filter(email="setup@dll347.org").exists())

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

    def test_logout_clears_session(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse("api:logout"))

        self.assertEqual(response.status_code, 200)
        follow_up = self.client.get(reverse("api:current-account"))
        self.assertEqual(follow_up.status_code, 403)
