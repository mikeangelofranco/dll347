from django.db import migrations, models


def enable_for_secretary(apps, schema_editor):
    DashboardCardVisibility = apps.get_model("api", "DashboardCardVisibility")
    DashboardCardVisibility.objects.filter(role="secretary").update(petitioner=True)


def disable_for_all_roles(apps, schema_editor):
    DashboardCardVisibility = apps.get_model("api", "DashboardCardVisibility")
    DashboardCardVisibility.objects.update(petitioner=False)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0025_dashboardcardvisibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="dashboardcardvisibility",
            name="petitioner",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(enable_for_secretary, disable_for_all_roles),
    ]
