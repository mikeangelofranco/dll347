from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Account, AuditLog, ScreenLog


class Command(BaseCommand):
    help = "Cleanup audit logs and screen logs to maintain rolling records (5,000 audit logs, 200 screen logs per account)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Delete logs older than this many days (default: 30).",
        )
        parser.add_argument(
            "--max-audit-logs",
            type=int,
            default=5000,
            help="Maximum rolling audit logs to keep (default: 5000).",
        )
        parser.add_argument(
            "--max-screen-logs",
            type=int,
            default=200,
            help="Maximum rolling screen logs per account to keep (default: 200).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        max_audit_logs = options["max_audit_logs"]
        max_screen_logs = options["max_screen_logs"]
        dry_run = options["dry_run"]

        # 1. Prune AuditLog by age
        cutoff = timezone.now() - timezone.timedelta(days=days)
        age_queryset = AuditLog.objects.filter(created_at__lt=cutoff)
        age_count = age_queryset.count()
        if age_count > 0:
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f"DRY RUN: {age_count} audit logs older than {days} days would be deleted."
                    )
                )
            else:
                deleted, _ = age_queryset.delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} audit logs older than {days} days."))

        # 2. Prune AuditLog by rolling limit
        total_audit = AuditLog.objects.count()
        if total_audit > max_audit_logs:
            excess_audit = total_audit - max_audit_logs
            old_audit_ids = list(
                AuditLog.objects.order_by("created_at", "id")
                .values_list("id", flat=True)[:excess_audit]
            )
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f"DRY RUN: {len(old_audit_ids)} excess audit logs beyond {max_audit_logs} would be deleted."
                    )
                )
            else:
                deleted, _ = AuditLog.objects.filter(id__in=old_audit_ids).delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} excess audit logs (kept rolling {max_audit_logs})."))

        # 3. Prune ScreenLog per account
        total_screen_deleted = 0
        for account in Account.objects.all():
            acc_count = ScreenLog.objects.filter(account=account).count()
            if acc_count > max_screen_logs:
                excess_screen = acc_count - max_screen_logs
                old_screen_ids = list(
                    ScreenLog.objects.filter(account=account)
                    .order_by("created_at", "id")
                    .values_list("id", flat=True)[:excess_screen]
                )
                if dry_run:
                    self.stdout.write(
                        self.style.WARNING(
                            f"DRY RUN: Account {account.email} has {excess_screen} excess screen logs that would be deleted."
                        )
                    )
                else:
                    deleted, _ = ScreenLog.objects.filter(id__in=old_screen_ids).delete()
                    total_screen_deleted += deleted

        if not dry_run and total_screen_deleted > 0:
            self.stdout.write(self.style.SUCCESS(f"Deleted {total_screen_deleted} excess screen logs across accounts."))

