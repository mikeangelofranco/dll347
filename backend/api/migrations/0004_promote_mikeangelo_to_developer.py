from django.db import migrations


def promote_mikeangelo_to_developer(apps, schema_editor):
    Account = apps.get_model("api", "Account")
    Account.objects.filter(email="mikeangelofranco@outlook.com").update(
        role="developer",
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0003_hash_preidentified_default_passwords"),
    ]

    operations = [
        migrations.RunPython(promote_mikeangelo_to_developer, migrations.RunPython.noop),
    ]
