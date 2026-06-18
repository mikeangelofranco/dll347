import api.models
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0011_add_three_lights_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="LodgeDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("treasurers_report", "Treasurers Report"),
                            ("minutes_stated_meeting", "Minutes of the Stated Meeting"),
                            ("minutes_special_meeting", "Minutes of the Special Meeting"),
                        ],
                        max_length=40,
                    ),
                ),
                ("file", models.FileField(upload_to=api.models.lodge_document_upload_path)),
                ("original_filename", models.CharField(max_length=255)),
                ("content_type", models.CharField(max_length=100)),
                ("size_bytes", models.PositiveIntegerField()),
                ("notes", models.TextField(blank=True)),
                (
                    "extraction_status",
                    models.CharField(
                        choices=[
                            ("not_applicable", "Not Applicable"),
                            ("pending_review", "Pending Review"),
                            ("extracted", "Extracted"),
                            ("failed", "Failed"),
                        ],
                        default="not_applicable",
                        max_length=30,
                    ),
                ),
                ("extraction_errors", models.JSONField(default=list)),
                ("extracted_text", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_lodge_documents",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "dll347_lodge_documents",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="TreasurerReportSummary",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("report_month", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("report_year", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("previous_report_date", models.DateField(blank=True, null=True)),
                ("cash_balance_last_report", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("cash_received_month", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("cash_to_date", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("cash_disbursements", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("remaining_cash", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("general_fund", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("specific_purpose_funds", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("other_sources", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("grand_lodge_account", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("other_account", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("raw_values", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "document",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="treasurer_summary",
                        to="api.lodgedocument",
                    ),
                ),
            ],
            options={
                "db_table": "dll347_treasurer_report_summaries",
                "ordering": ["-report_year", "-report_month", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="lodgedocument",
            index=models.Index(fields=["category", "created_at"], name="lodge_doc_category_created_idx"),
        ),
    ]
