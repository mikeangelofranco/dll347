import re

from django.db import migrations


DOCUMENT_MONTH_NAMES = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def report_period_from_filename(filename):
    normalized = filename.lower().replace("_", " ").replace("-", " ")
    year_match = re.search(r"\b(19\d{2}|20\d{2})\b", normalized)
    month = None
    for token, value in DOCUMENT_MONTH_NAMES.items():
        if re.search(rf"\b{re.escape(token)}\b", normalized):
            month = value
            break
    return month, int(year_match.group(1)) if year_match else None


def repair_treasurer_summary_periods(apps, _schema_editor):
    TreasurerReportSummary = apps.get_model("api", "TreasurerReportSummary")
    for summary in TreasurerReportSummary.objects.select_related("document").all():
        month, year = report_period_from_filename(summary.document.original_filename)
        changed_fields = []
        if month is not None and summary.report_month != month:
            summary.report_month = month
            changed_fields.append("report_month")
        if year is not None and summary.report_year != year:
            summary.report_year = year
            changed_fields.append("report_year")
        if changed_fields:
            summary.save(update_fields=changed_fields)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0016_toolaccesslog"),
    ]

    operations = [
        migrations.RunPython(repair_treasurer_summary_periods, migrations.RunPython.noop),
    ]
