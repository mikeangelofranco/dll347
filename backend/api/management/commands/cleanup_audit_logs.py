from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import AuditLog


class Command(BaseCommand):
    help = "Delete audit logs older than 30 days to prevent data ballooning."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Delete logs older than this many days (default: 30).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]
        cutoff = timezone.now() - timezone.timedelta(days=days)

        queryset = AuditLog.objects.filter(created_at__lt=cutoff)
        count = queryset.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: {count} audit logs older than {days} days "
                    f"(before {cutoff.strftime('%Y-%m-%d')}) would be deleted."
                )
            )
            return

        deleted, _ = queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} audit logs older than {days} days "
                f"(before {cutoff.strftime('%Y-%m-%d')})."
            )
        )
