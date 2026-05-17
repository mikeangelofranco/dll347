from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Account, PreidentifiedEmail


class AccountSerializer(serializers.ModelSerializer):
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id",
            "email",
            "role",
            "is_active",
            "is_staff",
            "is_admin",
            "last_login",
            "created_at",
            "updated_at",
        )

    def get_is_admin(self, obj: Account) -> bool:
        return obj.is_superuser


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")
        attrs["email"] = email

        account = (
            Account.objects.filter(email=email)
            .only("id", "email", "password", "role", "is_active", "is_staff", "is_superuser")
            .first()
        )
        attrs["account"] = account
        attrs["preidentified_email"] = (
            PreidentifiedEmail.objects.filter(email=email)
            .only("id", "email", "default_password")
            .first()
        )

        if account and not account.is_active:
            raise serializers.ValidationError("This account is inactive.")

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
