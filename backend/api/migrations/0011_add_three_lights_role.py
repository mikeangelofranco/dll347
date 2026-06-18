from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0010_memberpositionheld"),
    ]

    operations = [
        migrations.AlterField(
            model_name="account",
            name="role",
            field=models.CharField(
                choices=[
                    ("member", "Member"),
                    ("secretary", "Secretary"),
                    ("three_lights", "3 Lights"),
                    ("administrator", "Administrator"),
                    ("developer", "Developer"),
                ],
                default="member",
                max_length=20,
            ),
        ),
    ]
