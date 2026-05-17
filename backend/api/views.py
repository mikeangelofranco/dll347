from django.conf import settings
from django.contrib.auth import login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .auth_tokens import build_password_reset_token, build_password_reset_url
from .email_service import EmailDeliveryError, send_password_reset_email
from .models import Account
from .serializers import (
    AccountSerializer,
    LoginSerializer,
    PasswordSetupSerializer,
    ResetTokenValidationSerializer,
    ResetPasswordSerializer,
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
    return Response(AccountSerializer(request.user).data, status=status.HTTP_200_OK)
