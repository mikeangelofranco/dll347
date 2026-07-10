from __future__ import annotations

from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from api.excel_members import member_name_match_key
from api.models import MemberDatabaseRecord


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def glp_match_key(value: str) -> str:
    return "".join(value.split()).casefold()


class Command(BaseCommand):
    help = "Import default member profile photos from filenames matching GLP ID or normalized member name."

    def add_arguments(self, parser):
        parser.add_argument("folder", help="Folder containing cropped profile images.")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report matches without saving default profile photos.",
        )

    def handle(self, *args, **options):
        folder = Path(options["folder"]).expanduser()
        dry_run = options["dry_run"]
        if not folder.is_dir():
            raise CommandError(f"Profile photo folder does not exist: {folder}")

        records = list(MemberDatabaseRecord.objects.all())
        glp_index: dict[str, list[MemberDatabaseRecord]] = {}
        name_index: dict[tuple[str, ...], list[MemberDatabaseRecord]] = {}
        no_glp_records: list[MemberDatabaseRecord] = []
        for record in records:
            glp_key = glp_match_key(record.glp_id_number)
            if glp_key:
                glp_index.setdefault(glp_key, []).append(record)
            else:
                no_glp_records.append(record)
                name_key = member_name_match_key(record.name)
                if name_key:
                    name_index.setdefault(name_key, []).append(record)

        matched = 0
        unmatched: list[str] = []
        ambiguous: list[str] = []
        images = sorted(
            path
            for path in folder.iterdir()
            if path.is_file() and path.suffix.casefold() in SUPPORTED_EXTENSIONS
        )

        for image_path in images:
            record = self.resolve_record(image_path.stem, glp_index, name_index, no_glp_records)
            if record is None:
                unmatched.append(image_path.name)
                continue
            if isinstance(record, list):
                ambiguous.append(
                    f"{image_path.name}: {', '.join(candidate.name for candidate in record)}"
                )
                continue

            matched += 1
            if dry_run:
                self.stdout.write(f"MATCH {image_path.name} -> {record.name}")
                continue

            if record.default_profile_photo:
                record.default_profile_photo.delete(save=False)
            with image_path.open("rb") as image_file:
                record.default_profile_photo.save(
                    f"member-{record.pk}{image_path.suffix.lower()}",
                    File(image_file),
                    save=True,
                )
            self.stdout.write(f"IMPORTED {image_path.name} -> {record.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Matched' if dry_run else 'Imported'} {matched} of {len(images)} profile photo file(s)."
            )
        )
        if ambiguous:
            self.stdout.write(self.style.WARNING(f"Ambiguous file(s): {len(ambiguous)}"))
            for item in ambiguous:
                self.stdout.write(f"  {item}")
        if unmatched:
            self.stdout.write(self.style.WARNING(f"Unmatched file(s): {len(unmatched)}"))
            for item in unmatched:
                self.stdout.write(f"  {item}")

    def resolve_record(
        self,
        filename_stem: str,
        glp_index: dict[str, list[MemberDatabaseRecord]],
        name_index: dict[tuple[str, ...], list[MemberDatabaseRecord]],
        no_glp_records: list[MemberDatabaseRecord],
    ) -> MemberDatabaseRecord | list[MemberDatabaseRecord] | None:
        glp_matches = glp_index.get(glp_match_key(filename_stem), [])
        if len(glp_matches) == 1:
            return glp_matches[0]
        if len(glp_matches) > 1:
            return glp_matches

        name_key = member_name_match_key(filename_stem)
        name_matches = name_index.get(name_key, [])
        if len(name_matches) == 1:
            return name_matches[0]
        if len(name_matches) > 1:
            return name_matches

        filename_tokens = set(name_key)
        partial_matches = [
            record
            for record in no_glp_records
            if filename_tokens and filename_tokens.issubset(set(member_name_match_key(record.name)))
        ]
        if len(partial_matches) == 1:
            return partial_matches[0]
        if len(partial_matches) > 1:
            return partial_matches
        return None
