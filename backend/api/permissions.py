from rest_framework.permissions import BasePermission


class IsDeveloper(BasePermission):
    message = "Developer access is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "role", None) == "developer"
        )
