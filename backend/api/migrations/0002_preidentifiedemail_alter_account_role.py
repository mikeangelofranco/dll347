import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="account",
            name="role",
            field=models.CharField(
                choices=[
                    ("member", "Member"),
                    ("secretary", "Secretary"),
                    ("administrator", "Administrator"),
                    ("developer", "Developer"),
                ],
                default="member",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="PreidentifiedEmail",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("default_password", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "preidentified_emails",
                "ordering": ["id"],
            },
        ),
    ]
