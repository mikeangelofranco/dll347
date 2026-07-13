import re
from collections import Counter
from django.core.management.base import BaseCommand

from api.models import Account, MemberDatabaseRecord, PreidentifiedEmail


_ALPHA_PREFIX_RE = re.compile(r"^([a-zA-Z]+)")


def _alpha_prefix(text: str) -> str:
    local = text.split("@")[0] if "@" in text else text
    match = _ALPHA_PREFIX_RE.match(local)
    return match.group(1).casefold() if match else local.casefold()


class Command(BaseCommand):
    help = "Repair broken Account↔MemberDatabaseRecord mappings after member data updates change emails."

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
        member_by_email = {
            record.email.strip().casefold(): record
            for record in members
            if record.email.strip()
        }

        orphaned: list[Account] = []
        for account in accounts:
            if account.email.strip().casefold() not in member_by_email:
                orphaned.append(account)

        member_alpha_prefixes: dict[str, list[MemberDatabaseRecord]] = {}
        member_name_lookup: dict[str, MemberDatabaseRecord] = {}
        for record in members:
            name_key = record.name.strip().casefold()
            key = f"_name_{name_key}" if name_key else ""
            if key and key not in member_name_lookup:
                member_name_lookup[key] = record

            if record.email.strip():
                prefix = _alpha_prefix(record.email)
                if prefix:
                    member_alpha_prefixes.setdefault(prefix, []).append(record)

        relinked: list[tuple[Account, MemberDatabaseRecord]] = []
        unmatched: list[Account] = []

        for account in orphaned:
            found = False
            account_prefix = _alpha_prefix(account.email)

            if account_prefix and account_prefix in member_alpha_prefixes:
                candidates = member_alpha_prefixes[account_prefix]
                if len(candidates) == 1:
                    relinked.append((account, candidates[0]))
                    found = True

            if not found:
                unmatched.append(account)

        self.stdout.write(self.style.SUCCESS(f"Member records: {len(members)}"))
        self.stdout.write(self.style.SUCCESS(f"Accounts: {len(accounts)}"))
        self.stdout.write(f"Orphaned accounts: {len(orphaned)}")
        self.stdout.write(f"Relinked by email prefix: {len(relinked)}")
        self.stdout.write(f"Still unmatched: {len(unmatched)}")

        all_account_emails = {a.email.strip().casefold() for a in accounts}
        existing_preidentified = set(
            PreidentifiedEmail.objects.values_list("email", flat=True)
        )
        unlinked = [
            r for r in members
            if r.email.strip()
            and r.email.strip().casefold() not in all_account_emails
            and r.email.strip().casefold() not in existing_preidentified
        ]
        self.stdout.write(f"Members without account: {len(unlinked)}")

        if relinked:
            self.stdout.write("\n--- Relinking ---")
            for account, member in relinked:
                self.stdout.write(
                    f"  {account.email} → {member.name} ({member.email})"
                )

        if unmatched:
            self.stdout.write("\n--- Still orphaned ---")
            for account in unmatched:
                self.stdout.write(f"  {account.email} (role: {account.role})")

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDry run – no changes applied."))
            return

        if relinked:
            accounts_to_update: list[Account] = []
            for account, member in relinked:
                account.email = member.email.strip()
                accounts_to_update.append(account)
            Account.objects.bulk_update(accounts_to_update, ["email", "updated_at"])
            self.stdout.write(
                self.style.SUCCESS(f"\nRelinked {len(accounts_to_update)} account(s).")
            )
