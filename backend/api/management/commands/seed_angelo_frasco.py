from datetime import date

from django.core.management.base import BaseCommand, CommandError

from api.models import Account, MemberDatabaseRecord, MemberPositionHeld, MembersWorkbookImport


class Command(BaseCommand):
    help = "Create or refresh the Angelo Frasco secretary test account and linked member data."

    def handle(self, *args, **options):
        workbook_import = MembersWorkbookImport.objects.first()
        if workbook_import is None:
            raise CommandError("Import the members workbook before seeding Angelo Frasco.")

        email = "angelofranco@noemail.com"
        attendance = {
            "2026 - WB Joel Alili / Jan": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / Feb": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / Mar": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / Apr": {"value": "a", "formula": None},
            "2026 - WB Joel Alili / May": {"value": "a", "formula": None},
        }
        annual_dues = {
            "ANNUAL DUES / 2024": {"value": 45295, "formula": None},
            "ANNUAL DUES / 2025": {"value": 45660, "formula": None},
            "ANNUAL DUES / 2026": {"value": 45977, "formula": None},
        }
        appendant_bodies = {
            "APPENDANT BODIES / CLUB / BAGWIS": {"value": "a", "formula": None},
            "APPENDANT BODIES / CLUB / A&ASR": {"value": "a", "formula": None},
            "APPENDANT BODIES / CLUB / York Rite": {"value": "a", "formula": None},
            "APPENDANT BODIES / CLUB / GGOKCS": {"value": "a", "formula": None},
            "APPENDANT BODIES / CLUB / PNPA BEST": {"value": "a", "formula": None},
        }
        defaults = {
            "workbook_import": workbook_import,
            "is_test_record": True,
            "section": "MASTER MASONS - ACTIVE",
            "member_number": "59",
            "name": "Frasco, Angelo M.",
            "glp_id_number": "TEST-RVIIA-347-50002",
            "date_of_birth": date(1987, 6, 18),
            "initiation_date": date(2018, 3, 10),
            "passing_date": date(2018, 6, 16),
            "raising_date": date(2018, 9, 22),
            "proficiency_date": date(2019, 1, 19),
            "address": "Cordova, Cebu",
            "telephone": "0917-000-0348",
            "email": email,
            "appendant_bodies": appendant_bodies,
            "blood_type": "A+",
            "widow_or_sister": "",
            "meeting_attendance": {},
            "monthly_attendance": attendance,
            "annual_dues": annual_dues,
            "raw_cells": {
                "B": {"value": 59},
                "C": {"value": "Frasco, Angelo M."},
                "D": {"value": "TEST-RVIIA-347-50002"},
                "O": {"value": "Cordova, Cebu"},
                "P": {"value": "0917-000-0348"},
                "Q": {"value": email},
                "AC": {"value": "A+"},
            },
        }
        member, created = MemberDatabaseRecord.objects.update_or_create(
            source_row=10002,
            defaults=defaults,
        )

        account = Account.objects.filter(email=email).first()
        account_created = account is None
        if account is None:
            account = Account(email=email)
        account.role = Account.Role.SECRETARY
        account.is_active = True
        account.is_staff = False
        account.is_superuser = False
        account.set_password("dll347")
        account.save()

        MemberPositionHeld.objects.update_or_create(
            member_record=member,
            title="Past Master",
            defaults={
                "date_range": "2025 - 2026",
                "start_date": date(2025, 1, 1),
                "end_date": date(2026, 12, 31),
                "notes": "Secretary test data: Past Master term spanning last year through this year.",
                "source": "local seed",
            },
        )

        member_action = "Created" if created else "Updated"
        account_action = "Created" if account_created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{member_action} {member.name} ({email})"))
        self.stdout.write(self.style.SUCCESS(f"{account_action} secretary login account ({email})"))
        self.stdout.write("Password: dll347")
