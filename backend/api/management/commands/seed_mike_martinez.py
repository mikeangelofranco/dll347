from datetime import date

from django.core.management.base import BaseCommand, CommandError

from api.models import MemberDatabaseRecord, MembersWorkbookImport, PreidentifiedEmail


class Command(BaseCommand):
    help = "Create or refresh the Mike Martinez local member-login test data."

    def handle(self, *args, **options):
        workbook_import = MembersWorkbookImport.objects.first()
        if workbook_import is None:
            raise CommandError("Import the members workbook before seeding Mike Martinez.")

        email = "mikemartinez@noemail.com"
        attendance = {
            "2026 - WB Joel Alili / Jan": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / Feb": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / Mar": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / Apr": {"value": "a", "formula": None},
        }
        annual_dues = {
            "ANNUAL DUES / 2024": {"value": 45295, "formula": None},
            "ANNUAL DUES / 2025": {"value": 45660, "formula": None},
            "ANNUAL DUES / 2026": {"value": 45977, "formula": None},
        }
        defaults = {
            "workbook_import": workbook_import,
            "is_test_record": True,
            "section": "MASTER MASONS - ACTIVE",
            "member_number": "58",
            "name": "Martinez, Mike A.",
            "glp_id_number": "TEST-RVIIA-347-50001",
            "date_of_birth": date(1988, 9, 21),
            "initiation_date": date(2019, 5, 12),
            "passing_date": date(2019, 8, 17),
            "raising_date": date(2019, 11, 23),
            "proficiency_date": date(2020, 2, 15),
            "address": "Pilipog, Cordova, Cebu",
            "telephone": "0917-000-0347",
            "email": email,
            "appendant_bodies": {},
            "blood_type": "O+",
            "widow_or_sister": "",
            "meeting_attendance": {},
            "monthly_attendance": attendance,
            "annual_dues": annual_dues,
            "raw_cells": {
                "B": {"value": 58},
                "C": {"value": "Martinez, Mike A."},
                "D": {"value": "TEST-RVIIA-347-50001"},
                "O": {"value": "Pilipog, Cordova, Cebu"},
                "P": {"value": "0917-000-0347"},
                "Q": {"value": email},
                "AC": {"value": "O+"},
            },
        }
        member, created = MemberDatabaseRecord.objects.update_or_create(
            source_row=10001,
            defaults=defaults,
        )
        preidentified, _ = PreidentifiedEmail.objects.get_or_create(email=email)
        preidentified.set_default_password("dll347")
        preidentified.save()

        action = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} {member.name} ({email})"))
        self.stdout.write("Default preidentified password: dll347")
