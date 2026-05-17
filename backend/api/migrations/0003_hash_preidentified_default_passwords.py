from django.contrib.auth.hashers import identify_hasher, make_password
from django.db import migrations


def hash_existing_default_passwords(apps, schema_editor):
    PreidentifiedEmail = apps.get_model("api", "PreidentifiedEmail")

    for record in PreidentifiedEmail.objects.all().iterator():
        try:
            identify_hasher(record.default_password)
        except Exception:
            PreidentifiedEmail.objects.filter(pk=record.pk).update(
                default_password=make_password(record.default_password)
            )


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_preidentifiedemail_alter_account_role"),
    ]

    operations = [
        migrations.RunPython(hash_existing_default_passwords, migrations.RunPython.noop),
    ]
