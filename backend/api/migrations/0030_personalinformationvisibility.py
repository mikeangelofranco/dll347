from django.db import migrations, models


def create_default_visibility(apps, schema_editor):
    PersonalInformationVisibility = apps.get_model("api", "PersonalInformationVisibility")
    for role in ("member", "secretary", "three_lights", "administrator", "developer"):
        PersonalInformationVisibility.objects.get_or_create(role=role)


def remove_default_visibility(apps, schema_editor):
    PersonalInformationVisibility = apps.get_model("api", "PersonalInformationVisibility")
    PersonalInformationVisibility.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0029_add_petitioner_date_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="PersonalInformationVisibility",
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
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("member", "Member"),
                            ("secretary", "Secretary"),
                            ("three_lights", "3 Lights"),
                            ("administrator", "Administrator"),
                            ("developer", "Developer"),
                        ],
                        max_length=20,
                        unique=True,
                    ),
                ),
                ("birthdate", models.BooleanField(default=True)),
                ("address", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "personal information visibility by role",
                "verbose_name_plural": "personal information visibility by role",
                "db_table": "dll347_personal_information_visibility",
                "ordering": ["role"],
            },
        ),
        migrations.RunPython(create_default_visibility, remove_default_visibility),
    ]
