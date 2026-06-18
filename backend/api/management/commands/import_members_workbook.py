from django.core.management.base import BaseCommand, CommandError

from api.excel_members import import_members_workbook, schema_report


class Command(BaseCommand):
    help = "Synchronize the three DLL 347 member workbook sheets into local database tables."

    def add_arguments(self, parser):
        parser.add_argument("workbook_path")
        parser.add_argument(
            "--show-columns",
            action="store_true",
            help="Print the imported workbook column metadata as JSON.",
        )

    def handle(self, *args, **options):
        try:
            workbook_import = import_members_workbook(options["workbook_path"])
        except (OSError, ValueError, KeyError) as error:
            raise CommandError(str(error)) from error

        self.stdout.write(self.style.SUCCESS(f"Imported {workbook_import.filename}"))
        for sheet_name, summary in workbook_import.sheet_summaries.items():
            self.stdout.write(
                f"{sheet_name}: {summary['records']} records, {summary['columns']} columns"
            )
        if options["show_columns"]:
            self.stdout.write(schema_report(workbook_import))
