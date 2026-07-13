import re
from django.core.management.base import BaseCommand

from api.models import Account, MemberDatabaseRecord, PreidentifiedEmail


_ALPHA_PREFIX_RE = re.compile(r"^([a-zA-Z]+)")


def _alpha_prefix(text: str) -> str:
    local = text.split("@")[0] if "@" in text else text
    match = _ALPHA_PREFIX_RE.match(local)
    return match.group(1).casefold() if match else local.casefold()


class Command(BaseCommand):
    help = "Repair broken Account↔MemberDatabaseRecord mappings and sync GLP IDs."

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
        member_by_glp: dict[str, MemberDatabaseRecord] = {}
        glp_counts: dict[str, int] = {}
        for record in members:
            glp = record.glp_id_number.strip().casefold()
            if glp:
                glp_counts[glp] = glp_counts.get(glp, 0) + 1
        for record in members:
            glp = record.glp_id_number.strip().casefold()
            if glp and glp_counts[glp] == 1:
                member_by_glp[glp] = record

        orphaned: list[Account] = []
        for account in accounts:
            if account.email.strip().casefold() not in member_by_email:
                orphaned.append(account)

        member_prefixes: dict[str, list[MemberDatabaseRecord]] = {}
        for record in members:
            if record.email.strip():
                prefix = _alpha_prefix(record.email)
                if prefix:
                    member_prefixes.setdefault(prefix, []).append(record)

        relinked: list[tuple[Account, MemberDatabaseRecord]] = []
        unmatched: list[Account] = []

        for account in orphaned:
            found = False

            account_glp = account.glp_id_number.strip().casefold()
            if account_glp and account_glp in member_by_glp:
                relinked.append((account, member_by_glp[account_glp]))
                found = True

            if not found:
                account_prefix = _alpha_prefix(account.email)
                if account_prefix and account_prefix in member_prefixes:
                    candidates = member_prefixes[account_prefix]
                    if len(candidates) == 1:
                        relinked.append((account, candidates[0]))
                        found = True

            if not found:
                unmatched.append(account)

        glp_updates: list[Account] = []
        for account in accounts:
            member = member_by_email.get(account.email.strip().casefold())
            if member is None:
                continue
            member_glp = member.glp_id_number.strip()
            if not member_glp:
                continue
            if account.glp_id_number.strip().casefold() == member_glp.casefold():
                continue
            account.glp_id_number = member_glp
            glp_updates.append(account)

        self.stdout.write(self.style.SUCCESS(f"Member records: {len(members)}"))
        self.stdout.write(self.style.SUCCESS(f"Accounts: {len(accounts)}"))
        self.stdout.write(f"Orphaned accounts: {len(orphaned)}")
        self.stdout.write(f"Relinked: {len(relinked)}")
        self.stdout.write(f"Unmatched: {len(unmatched)}")
        self.stdout.write(f"GLP ID syncs: {len(glp_updates)}")

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

        if glp_updates:
            self.stdout.write("\n--- GLP ID syncs ---")
            for account in glp_updates:
                member = member_by_email.get(account.email.strip().casefold())
                self.stdout.write(
                    f"  {account.email}: {account.glp_id_number or '(none)'} → {member.glp_id_number.strip() if member else '?'}"
                )

        if unmatched:
            self.stdout.write("\n--- Still orphaned ---")
            for account in unmatched:
                self.stdout.write(f"  {account.email} (role: {account.role})")

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDry run – no changes applied."))
            return

        entries_updated = 0
        if relinked:
            email_updates: list[Account] = []
            for account, member in relinked:
                account.email = member.email.strip()
                email_updates.append(account)
            Account.objects.bulk_update(email_updates, ["email", "updated_at"])
            entries_updated += len(email_updates)
            self.stdout.write(
                self.style.SUCCESS(f"Relinked {len(email_updates)} account(s).")
            )

        if glp_updates:
            Account.objects.bulk_update(glp_updates, ["glp_id_number", "updated_at"])
            entries_updated += len(glp_updates)
            self.stdout.write(
                self.style.SUCCESS(f"Synced GLP IDs on {len(glp_updates)} account(s).")
            )

        if entries_updated == 0:
            self.stdout.write("No changes needed.")
