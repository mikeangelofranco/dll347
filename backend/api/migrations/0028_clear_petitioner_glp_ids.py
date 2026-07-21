from django.db import migrations
from django.db.models import Q


def clear_petitioner_glp_ids(apps, schema_editor):
    MemberDatabaseRecord = apps.get_model("api", "MemberDatabaseRecord")
    Account = apps.get_model("api", "Account")

    petitioners = MemberDatabaseRecord.objects.filter(
        Q(section__istartswith="TRESTLE BOARD") | Q(section__icontains="PETITIONER")
    )
    petitioner_emails = {
        email.strip().lower()
        for email in petitioners.exclude(email="").values_list("email", flat=True)
        if email and email.strip()
    }
    for email in petitioner_emails:
        Account.objects.filter(email__iexact=email).update(glp_id_number="")

    petitioners.exclude(glp_id_number="").update(glp_id_number="")


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0027_add_edit_petitioner_permission"),
    ]

    operations = [
        migrations.RunPython(clear_petitioner_glp_ids, migrations.RunPython.noop),
    ]
