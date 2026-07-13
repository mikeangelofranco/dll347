from django.core.management.base import BaseCommand

from api.excel_members import build_member_name_index, resolve_member_name_match
from api.models import Account, MemberDatabaseRecord, PreidentifiedEmail


class Command(BaseCommand):
    help = "Repair broken Account↔MemberDatabaseRecord mappings by syncing Account emails to match their linked member."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        members = list(MemberDatabaseRecord.objects.all())
        accounts = list(Account.objects.all())
        member_emails = {
            record.email.strip().casefold(): record
            for record in members
            if record.email.strip()
        }
        name_index = build_member_name_index(members)

        orphaned_accounts: list[Account] = []
        relinked: list[tuple[Account, MemberDatabaseRecord]] = []
        unmatched_accounts: list[Account] = []

        for account in accounts:
            account_email = account.email.strip().casefold()
            member = member_emails.get(account_email)
            if member is not None:
                continue
            orphaned_accounts.append(account)

        for account in orphaned_accounts:
            matched_member, match_status, _notes = resolve_member_name_match(
                account.email, name_index
            )
            if match_status == "matched":
                relinked.append((account, matched_member))
            else:
                unmatched_accounts.append(account)

        unlinked_members: list[MemberDatabaseRecord] = []
        linked_emails = set()
        for record in members:
            if record.email.strip():
                linked_emails.add(record.email.strip().casefold())

        all_account_emails = {a.email.strip().casefold() for a in accounts}
        preidentified_emails = set(
            PreidentifiedEmail.objects.values_list("email", flat=True)
        )
        for record in members:
            email = record.email.strip().casefold() if record.email else ""
            if email and email not in all_account_emails and email not in preidentified_emails:
                unlinked_members.append(record)

        self.stdout.write(self.style.SUCCESS(f"Total member records: {len(members)}"))
        self.stdout.write(self.style.SUCCESS(f"Total accounts: {len(accounts)}"))
        self.stdout.write(f"Orphaned accounts (no member by email): {len(orphaned_accounts)}")
        self.stdout.write(f"Accounts relinked by name: {len(relinked)}")
        self.stdout.write(f"Accounts that could not be matched: {len(unmatched_accounts)}")
        self.stdout.write(f"Members without an account or pre-identified email: {len(unlinked_members)}")

        if relinked:
            self.stdout.write("\n--- Accounts to be relinked ---")
            for account, member in relinked:
                self.stdout.write(
                    f"  Account {account.email} -> Member {member.name} (new email: {member.email})"
                )

        if unmatched_accounts:
            self.stdout.write("\n--- Orphaned accounts (no match found) ---")
            for account in unmatched_accounts:
                self.stdout.write(f"  {account.email} (role: {account.role})")

        if unlinked_members:
            self.stdout.write("\n--- Members without accounts ---")
            for member in unlinked_members:
                self.stdout.write(
                    f"  {member.name} (email: {member.email}, GLP: {member.glp_id_number})"
                )

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDry run – no changes applied."))
            return

        if relinked:
            accounts_to_update: list[Account] = []
            for account, member in relinked:
                account.email = member.email.strip()
                accounts_to_update.append(account)
            Account.objects.bulk_update(accounts_to_update, ["email", "updated_at"])
            self.stdout.write(self.style.SUCCESS(f"\nRelinked {len(accounts_to_update)} account(s)."))
