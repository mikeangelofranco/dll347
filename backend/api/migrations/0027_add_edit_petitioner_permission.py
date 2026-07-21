from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0026_add_petitioner_dashboard_visibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="can_edit_petitioners",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="toolaccesslog",
            name="tool",
            field=models.CharField(
                choices=[
                    ("documents", "Documents"),
                    ("activity", "Activity"),
                    ("edit_member", "Edit Member"),
                    ("edit_petitioner", "Edit Petitioner"),
                ],
                max_length=40,
            ),
        ),
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("app_open", "App Opened"),
                    ("screen_view", "Screen Viewed"),
                    ("user_action", "User Action"),
                    ("logout", "Logout"),
                    ("login_success", "Login Success"),
                    ("login_failed", "Login Failed"),
                    ("account_locked", "Account Locked"),
                    ("password_setup", "Password Setup"),
                    ("password_reset_requested", "Password Reset Requested"),
                    ("password_reset", "Password Reset"),
                    ("member_updated", "Member Updated"),
                    ("petitioner_updated", "Petitioner Updated"),
                    ("document_uploaded", "Document Uploaded"),
                    ("document_deleted", "Document Deleted"),
                    ("activity_created", "Activity Created"),
                    ("activity_deleted", "Activity Deleted"),
                ],
                max_length=40,
            ),
        ),
    ]
