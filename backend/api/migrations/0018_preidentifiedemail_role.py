from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0017_repair_treasurer_summary_periods"),
    ]

    operations = [
        migrations.AddField(
            model_name="preidentifiedemail",
            name="role",
            field=models.CharField(
                choices=[
                    ("member", "Member"),
                    ("secretary", "Secretary"),
                    ("three_lights", "3 Lights"),
                    ("administrator", "Administrator"),
                ],
                default="member",
                max_length=20,
            ),
        ),
    ]
