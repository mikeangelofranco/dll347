from django.db import migrations, models

import api.models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0021_add_audit_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="memberdatabaserecord",
            name="default_profile_photo",
            field=models.FileField(blank=True, upload_to=api.models.member_default_profile_photo_upload_path),
        ),
    ]
