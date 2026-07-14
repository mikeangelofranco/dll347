from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0023_add_account_glp_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditlog",
            name="event_label",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="auditlog",
            name="screen",
            field=models.CharField(blank=True, max_length=100),
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
                    ("document_uploaded", "Document Uploaded"),
                    ("document_deleted", "Document Deleted"),
                    ("activity_created", "Activity Created"),
                    ("activity_deleted", "Activity Deleted"),
                ],
                max_length=40,
            ),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["screen", "-created_at"], name="audit_screen_created_idx"),
        ),
    ]
