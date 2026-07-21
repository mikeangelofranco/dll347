from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0028_clear_petitioner_glp_ids"),
    ]

    operations = [
        migrations.AddField(
            model_name="memberdatabaserecord",
            name="date_presented",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="memberdatabaserecord",
            name="date_balloted",
            field=models.DateField(blank=True, null=True),
        ),
    ]
