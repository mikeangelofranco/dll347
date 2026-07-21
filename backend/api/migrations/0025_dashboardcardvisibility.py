from django.db import migrations, models


def create_default_visibility(apps, schema_editor):
    DashboardCardVisibility = apps.get_model("api", "DashboardCardVisibility")
    for role in ("member", "secretary", "three_lights", "administrator", "developer"):
        DashboardCardVisibility.objects.get_or_create(role=role)


def remove_default_visibility(apps, schema_editor):
    DashboardCardVisibility = apps.get_model("api", "DashboardCardVisibility")
    DashboardCardVisibility.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0024_auditlog_activity_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="DashboardCardVisibility",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("member", "Member"), ("secretary", "Secretary"), ("three_lights", "3 Lights"), ("administrator", "Administrator"), ("developer", "Developer")], max_length=20, unique=True)),
                ("lodge_health_indicator", models.BooleanField(default=True)),
                ("members", models.BooleanField(default=True)),
                ("next_lodge_activity", models.BooleanField(default=True)),
                ("dues_collection", models.BooleanField(default=True)),
                ("financial_summary", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "dashboard visibility by role",
                "verbose_name_plural": "dashboard visibility by role",
                "db_table": "dll347_dashboard_card_visibility",
                "ordering": ["role"],
            },
        ),
        migrations.RunPython(create_default_visibility, remove_default_visibility),
    ]
