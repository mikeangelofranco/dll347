from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from django.db import transaction

from .models import (
    Account,
    BallotingCoinRecord,
    LodgeVisitorRecord,
    MemberDatabaseRecord,
    MembersWorkbookImport,
    MembersWorkbookSheetSchema,
)


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS, "pr": PACKAGE_REL_NS}
CELL_REFERENCE_RE = re.compile(r"([A-Z]+)(\d+)")
@dataclass(frozen=True)
class ParsedCell:
    value: Any
    formula: str | None
    style_id: int
    number_format: str


@dataclass
class ParsedSheet:
    name: str
    dimension: str
    cells: dict[str, ParsedCell]
    merged_ranges: list[str]
    columns: list[dict[str, Any]]
    row_formats: list[dict[str, Any]]
    freeze_panes: dict[str, Any]

    def cell(self, reference: str) -> ParsedCell | None:
        return self.cells.get(reference)

    def value(self, reference: str, default: Any = "") -> Any:
        cell = self.cell(reference)
        if cell is None or cell.value is None:
            return default
        return cell.value


class MembersWorkbookFormatError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass
class MembersWorkbookUpdateResult:
    total_rows: int
    updated_count: int
    unmatched_count: int
    unmatched_names: list[str]


@dataclass(frozen=True)
class MemberSheetLayout:
    header_row: int
    subheader_row: int
    first_data_row: int


def column_number(column_name: str) -> int:
    result = 0
    for character in column_name:
        result = result * 26 + ord(character) - 64
    return result


def column_name(column_number_value: int) -> str:
    result = ""
    while column_number_value:
        column_number_value, remainder = divmod(column_number_value - 1, 26)
        result = chr(65 + remainder) + result
    return result


def split_reference(reference: str) -> tuple[str, int]:
    match = CELL_REFERENCE_RE.fullmatch(reference)
    if match is None:
        raise ValueError(f"Invalid Excel cell reference: {reference}")
    return match.group(1), int(match.group(2))


def excel_date(value: Any) -> date | None:
    if value in (None, "", "N/A"):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        serial = float(value)
    except (TypeError, ValueError):
        return None
    return (datetime(1899, 12, 30) + timedelta(days=serial)).date()


def text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def normalized_header_value(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]+", "", text_value(value).upper())


def integer_value(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def is_numbered_record(sheet: ParsedSheet, row: int, number_column: str, name_column: str) -> bool:
    return (
        integer_value(sheet.value(f"{number_column}{row}")) is not None
        and bool(text_value(sheet.value(f"{name_column}{row}")))
    )


NAME_PREFIXES = {
    "bro",
    "brother",
    "wb",
    "mw",
    "vw",
    "mr",
    "fcm",
    "eam",
}

NAME_SUFFIXES = {
    "jr",
    "sr",
    "ii",
    "iii",
    "iv",
    "lml",
    "snpd",
    "snc",
    "sna",
}


def normalize_member_name(name: str) -> tuple[str, ...]:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", ascii_name.lower())
    tokens = [token for token in cleaned.split() if token]
    return tuple(
        token
        for token in tokens
        if token not in NAME_PREFIXES and token not in NAME_SUFFIXES
    )


def member_name_match_key(name: str) -> tuple[str, ...]:
    return tuple(sorted(normalize_member_name(name)))


def build_member_name_index(records: list[MemberDatabaseRecord]) -> dict[tuple[str, ...], list[MemberDatabaseRecord]]:
    index: dict[tuple[str, ...], list[MemberDatabaseRecord]] = {}
    for record in records:
        key = member_name_match_key(record.name)
        if key:
            index.setdefault(key, []).append(record)
    return index


def resolve_member_name_match(
    name: str,
    index: dict[tuple[str, ...], list[MemberDatabaseRecord]],
) -> tuple[MemberDatabaseRecord | None, str, dict[str, Any]]:
    key = member_name_match_key(name)
    matches = index.get(key, [])
    notes = {
        "normalized_tokens": list(key),
        "candidate_count": len(matches),
        "candidate_names": [match.name for match in matches],
    }
    if len(matches) == 1:
        return matches[0], "matched", notes
    if len(matches) > 1:
        return None, "ambiguous", notes
    return None, "unmatched", notes


class OOXMLWorkbook:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.archive = zipfile.ZipFile(self.path)
        self.shared_strings = self._read_shared_strings()
        self.number_formats = self._read_number_formats()
        self.sheet_paths = self._read_sheet_paths()

    def close(self) -> None:
        self.archive.close()

    def __enter__(self) -> "OOXMLWorkbook":
        return self

    def __exit__(self, *_args) -> None:
        self.close()

    def _xml(self, path: str) -> ElementTree.Element:
        return ElementTree.fromstring(self.archive.read(path))

    def _read_shared_strings(self) -> list[str]:
        if "xl/sharedStrings.xml" not in self.archive.namelist():
            return []
        root = self._xml("xl/sharedStrings.xml")
        return [
            "".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t"))
            for item in root.findall("m:si", NS)
        ]

    def _read_number_formats(self) -> list[str]:
        root = self._xml("xl/styles.xml")
        custom_formats = {
            int(item.get("numFmtId", "0")): item.get("formatCode", "")
            for item in root.findall("m:numFmts/m:numFmt", NS)
        }
        formats: list[str] = []
        for item in root.findall("m:cellXfs/m:xf", NS):
            format_id = int(item.get("numFmtId", "0"))
            formats.append(custom_formats.get(format_id, f"builtin:{format_id}"))
        return formats

    def _read_sheet_paths(self) -> dict[str, str]:
        workbook = self._xml("xl/workbook.xml")
        relationships = self._xml("xl/_rels/workbook.xml.rels")
        targets = {
            item.get("Id"): item.get("Target", "")
            for item in relationships.findall("pr:Relationship", NS)
        }
        result: dict[str, str] = {}
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            target = targets[sheet.get(f"{{{REL_NS}}}id")]
            result[sheet.get("name", "")] = f"xl/{target.lstrip('/')}"
        return result

    def read_sheet(self, name: str) -> ParsedSheet:
        root = self._xml(self.sheet_paths[name])
        cells: dict[str, ParsedCell] = {}
        for cell_node in root.findall(".//m:sheetData/m:row/m:c", NS):
            reference = cell_node.get("r", "")
            cell_type = cell_node.get("t")
            style_id = int(cell_node.get("s", "0"))
            value_node = cell_node.find("m:v", NS)
            formula_node = cell_node.find("m:f", NS)
            raw_value = value_node.text if value_node is not None else None

            if cell_type == "s" and raw_value is not None:
                value: Any = self.shared_strings[int(raw_value)]
            elif cell_type == "inlineStr":
                value = "".join(
                    node.text or "" for node in cell_node.iter(f"{{{MAIN_NS}}}t")
                )
            elif cell_type == "b":
                value = raw_value == "1"
            elif cell_type in {"str", "e"}:
                value = raw_value or ""
            elif raw_value is None:
                value = ""
            else:
                try:
                    numeric_value = float(raw_value)
                    value = int(numeric_value) if numeric_value.is_integer() else numeric_value
                except ValueError:
                    value = raw_value

            number_format = (
                self.number_formats[style_id] if style_id < len(self.number_formats) else ""
            )
            cells[reference] = ParsedCell(
                value=value,
                formula=formula_node.text if formula_node is not None else None,
                style_id=style_id,
                number_format=number_format,
            )

        merged_ranges_node = root.find("m:mergeCells", NS)
        merged_ranges = (
            [item.get("ref", "") for item in merged_ranges_node.findall("m:mergeCell", NS)]
            if merged_ranges_node is not None
            else []
        )
        columns = [
            {
                "min": int(item.get("min", "0")),
                "max": int(item.get("max", "0")),
                "width": float(item.get("width", "0")),
                "hidden": item.get("hidden") == "1",
                "outline_level": int(item.get("outlineLevel", "0")),
                "collapsed": item.get("collapsed") == "1",
                "style_id": int(item.get("style", "0")),
            }
            for item in root.findall("m:cols/m:col", NS)
        ]
        row_formats = [
            {
                "row": int(item.get("r", "0")),
                "height": float(item.get("ht", "0")) if item.get("ht") else None,
                "hidden": item.get("hidden") == "1",
                "outline_level": int(item.get("outlineLevel", "0")),
                "style_id": int(item.get("s", "0")),
            }
            for item in root.findall("m:sheetData/m:row", NS)
        ]
        pane = root.find("m:sheetViews/m:sheetView/m:pane", NS)
        freeze_panes = dict(pane.attrib) if pane is not None else {}
        dimension = root.find("m:dimension", NS)
        return ParsedSheet(
            name=name,
            dimension=dimension.get("ref", "") if dimension is not None else "",
            cells=cells,
            merged_ranges=merged_ranges,
            columns=columns,
            row_formats=row_formats,
            freeze_panes=freeze_panes,
        )


def merged_header_value(sheet: ParsedSheet, column: str, row: int) -> str:
    direct_value = text_value(sheet.value(f"{column}{row}"))
    if direct_value:
        return direct_value
    target_number = column_number(column)
    for merged_range in sheet.merged_ranges:
        start, end = merged_range.split(":") if ":" in merged_range else (merged_range, merged_range)
        start_column, start_row = split_reference(start)
        end_column, end_row = split_reference(end)
        if (
            start_row <= row <= end_row
            and column_number(start_column) <= target_number <= column_number(end_column)
        ):
            return text_value(sheet.value(start))
    return ""


def column_format(sheet: ParsedSheet, column_index: int) -> dict[str, Any]:
    for item in sheet.columns:
        if item["min"] <= column_index <= item["max"]:
            return item
    return {}


def serialize_cell(cell: ParsedCell) -> dict[str, Any]:
    return {
        "value": cell.value,
        "formula": cell.formula,
        "style_id": cell.style_id,
        "number_format": cell.number_format,
    }


def raw_row(sheet: ParsedSheet, row: int, first_column: str, last_column: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for index in range(column_number(first_column), column_number(last_column) + 1):
        column = column_name(index)
        cell = sheet.cell(f"{column}{row}")
        if cell is not None:
            result[column] = serialize_cell(cell)
    return result


def sheet_columns(
    sheet: ParsedSheet,
    first_column: str,
    last_column: str,
    header_rows: tuple[int, ...],
) -> list[dict[str, Any]]:
    definitions = []
    for index in range(column_number(first_column), column_number(last_column) + 1):
        column = column_name(index)
        header_parts = []
        for row in header_rows:
            value = merged_header_value(sheet, column, row)
            if value and value not in header_parts:
                header_parts.append(value)
        definitions.append(
            {
                "column": column,
                "index": index,
                "header": " / ".join(header_parts),
                "header_parts": header_parts,
                "header_cells": {
                    str(row): serialize_cell(sheet.cell(f"{column}{row}"))
                    for row in header_rows
                    if sheet.cell(f"{column}{row}") is not None
                },
                **column_format(sheet, index),
            }
        )
    return definitions


def members_section_rows(sheet: ParsedSheet) -> dict[int, str]:
    sections = {}
    for merged_range in sheet.merged_ranges:
        match = re.fullmatch(r"B(\d+):Q\1", merged_range)
        if match:
            row = int(match.group(1))
            value = text_value(sheet.value(f"B{row}"))
            if value:
                sections[row] = value
    return sections


def current_section(sections: dict[int, str], row: int) -> str:
    applicable_rows = [section_row for section_row in sections if section_row < row]
    return sections[max(applicable_rows)] if applicable_rows else ""


def find_member_sheet_layout(sheet: ParsedSheet) -> MemberSheetLayout:
    required_headers = {
        "B": "NO",
        "C": "NAME",
        "D": "GLPIDNUMBER",
        "E": "DATEOFBIRTH",
    }
    for row in range(1, 25):
        if all(normalized_header_value(sheet.value(f"{column}{row}")) == expected for column, expected in required_headers.items()):
            subheader_row = row + 1
            missing_helpful_headers = []
            email_header = normalized_header_value(sheet.value(f"Q{subheader_row}"))
            if email_header not in {"EMAIL", "EMAILADDRESS"}:
                missing_helpful_headers.append(f"Q{subheader_row}")
            blood_type_header = normalized_header_value(sheet.value(f"AC{row}"))
            if blood_type_header != "BLOODTYPE":
                missing_helpful_headers.append(f"AC{row}")
            if missing_helpful_headers:
                raise MembersWorkbookFormatError(
                    [
                        "Members Data format issue: the member table was found, but expected supporting columns are missing or moved "
                        f"({', '.join(missing_helpful_headers)}). Please use the DLL 347 Members workbook template."
                    ]
                )
            return MemberSheetLayout(
                header_row=row,
                subheader_row=subheader_row,
                first_data_row=row + 3,
            )

    raise MembersWorkbookFormatError(
        [
            "Members Data format issue: the worksheet was found, but the member table header row was not recognized. "
            "Expected NO., NAME, GLP ID NUMBER, and DATE OF BIRTH near the top of the DLL 347 Members Database sheet."
        ]
    )


def keyed_values(
    sheet: ParsedSheet,
    row: int,
    columns: list[dict[str, Any]],
    included_columns: set[str],
) -> dict[str, Any]:
    result = {}
    for definition in columns:
        column = definition["column"]
        if column not in included_columns:
            continue
        cell = sheet.cell(f"{column}{row}")
        if cell is None or cell.value in (None, ""):
            continue
        key = definition["header"] or f"Column {column}"
        if key in result:
            key = f"{key} [{column}]"
        result[key] = serialize_cell(cell)
    return result


def parsed_member_records_from_workbook(path: str | Path) -> tuple[list[MemberDatabaseRecord], dict[str, Any]]:
    workbook_path = Path(path)

    try:
        with OOXMLWorkbook(workbook_path) as workbook:
            missing_sheets = sorted({"DLL 347 Members Database"} - set(workbook.sheet_paths))
            if missing_sheets:
                raise MembersWorkbookFormatError(
                    [f"Missing required worksheet: {', '.join(missing_sheets)}."]
                )
            members = workbook.read_sheet("DLL 347 Members Database")
    except MembersWorkbookFormatError:
        raise
    except zipfile.BadZipFile:
        raise MembersWorkbookFormatError(["The uploaded file is not a valid .xlsx workbook."])
    except Exception as exc:
        raise MembersWorkbookFormatError([f"Unable to read members workbook: {exc}"])

    layout = find_member_sheet_layout(members)
    member_columns = sheet_columns(members, "B", "GZ", (layout.header_row, layout.subheader_row))
    member_sections = members_section_rows(members)
    max_row = max(
        [row for _column, row in (split_reference(reference) for reference in members.cells)]
        or [layout.first_data_row]
    )

    member_records = []
    for row in range(layout.first_data_row, max_row + 1):
        if not is_numbered_record(members, row, "B", "C"):
            continue
        name = text_value(members.value(f"C{row}"))
        member_records.append(
            MemberDatabaseRecord(
                source_row=row,
                section=current_section(member_sections, row),
                member_number=text_value(members.value(f"B{row}")),
                name=name,
                glp_id_number=text_value(members.value(f"D{row}")),
                date_of_birth=excel_date(members.value(f"E{row}")),
                initiation_date=excel_date(members.value(f"F{row}")),
                passing_date=excel_date(members.value(f"G{row}")),
                raising_date=excel_date(members.value(f"H{row}")),
                proficiency_date=excel_date(members.value(f"I{row}")),
                suspension=text_value(members.value(f"J{row}")),
                restored=text_value(members.value(f"K{row}")),
                demit=text_value(members.value(f"L{row}")),
                lml=text_value(members.value(f"M{row}")),
                dual_plural_honorary_date=text_value(members.value(f"N{row}")),
                address=text_value(members.value(f"O{row}")),
                telephone=text_value(members.value(f"P{row}")),
                email=text_value(members.value(f"Q{row}")),
                appendant_bodies=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(19, 28))
                ),
                blood_type=text_value(members.value(f"AC{row}")),
                widow_or_sister=text_value(members.value(f"AD{row}")),
                widow_or_sister_date_of_birth=excel_date(members.value(f"AE{row}")),
                meeting_attendance=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(33, 81))
                ),
                monthly_attendance=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(83, 175))
                ),
                annual_dues=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(177, 208))
                ),
                raw_cells=raw_row(members, row, "B", "GZ"),
            )
        )

    if not member_records:
        raise MembersWorkbookFormatError(["No member rows were found in the expected member table range."])

    return member_records, {
        members.name: {"records": len(member_records), "columns": len(member_columns)},
    }


_MEMBER_NAME_INDEX: dict[str, list[MemberDatabaseRecord]] | None = None


def _cached_member_name_index() -> dict[str, list[MemberDatabaseRecord]]:
    global _MEMBER_NAME_INDEX
    if _MEMBER_NAME_INDEX is None:
        _MEMBER_NAME_INDEX = _rebuild_member_name_index()
    return _MEMBER_NAME_INDEX


def _rebuild_member_name_index() -> dict[str, list[MemberDatabaseRecord]]:
    return build_member_name_index(MemberDatabaseRecord.objects.all())


def invalidate_member_name_index_cache() -> None:
    global _MEMBER_NAME_INDEX
    _MEMBER_NAME_INDEX = None


def find_member_for_account(account: Account) -> MemberDatabaseRecord | None:
    account_email = account.email.strip()
    member = MemberDatabaseRecord.objects.filter(email__iexact=account_email).first()
    if member is not None:
        return member

    if account.glp_id_number.strip():
        member = MemberDatabaseRecord.objects.filter(
            glp_id_number__iexact=account.glp_id_number.strip()
        ).first()
        if member is not None:
            return member

    name_hint = account.email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
    if len(name_hint) >= 3:
        name_index = _cached_member_name_index()
        matched, match_status, _notes = resolve_member_name_match(name_hint, name_index)
        if match_status == "matched":
            return matched

    return None


def _sync_member_accounts(updated_records: list[MemberDatabaseRecord], old_emails: dict[int, str]) -> None:
    accounts_by_old_email: dict[str, Account] = {}
    old_emails_set = {old_email for old_email in old_emails.values() if old_email}
    if old_emails_set:
        for account in Account.objects.filter(email__iexact__in=old_emails_set):
            accounts_by_old_email[account.email.strip().casefold()] = account

    accounts_by_new_email: dict[str, Account] = {}
    new_emails_set = {record.email.strip().casefold() for record in updated_records if record.email.strip()}
    if new_emails_set:
        for account in Account.objects.filter(email__iexact__in=new_emails_set):
            accounts_by_new_email[account.email.strip().casefold()] = account

    accounts_to_update: list[Account] = []

    for record in updated_records:
        new_email = record.email.strip().casefold() if record.email else ""
        old_email = old_emails.get(record.pk, "")

        if not new_email:
            continue
        if new_email == old_email:
            continue

        account = accounts_by_old_email.get(old_email) if old_email else None

        if account is None:
            continue

        if new_email in accounts_by_new_email:
            if account.is_active:
                account.is_active = False
                accounts_to_update.append(account)
            continue

        account.email = record.email.strip()
        accounts_to_update.append(account)
        accounts_by_new_email[new_email] = account

    if accounts_to_update:
        Account.objects.bulk_update(accounts_to_update, ["email", "is_active", "updated_at"])

    _sync_account_glp_ids(updated_records)


def _sync_account_glp_ids(updated_records: list[MemberDatabaseRecord]) -> None:
    member_emails = {record.email.strip().casefold() for record in updated_records if record.email.strip()}
    if not member_emails:
        return
    accounts = list(Account.objects.filter(email__iexact__in=member_emails))
    account_by_email = {a.email.strip().casefold(): a for a in accounts}
    accounts_to_update: list[Account] = []

    for record in updated_records:
        if not record.email.strip():
            continue
        if not record.glp_id_number.strip():
            continue
        account = account_by_email.get(record.email.strip().casefold())
        if account is None:
            continue
        if account.glp_id_number.strip().casefold() == record.glp_id_number.strip().casefold():
            continue
        account.glp_id_number = record.glp_id_number.strip()
        accounts_to_update.append(account)

    if accounts_to_update:
        Account.objects.bulk_update(accounts_to_update, ["glp_id_number", "updated_at"])


def update_existing_members_from_workbook(path: str | Path) -> MembersWorkbookUpdateResult:
    incoming_records, summaries = parsed_member_records_from_workbook(path)
    workbook_path = Path(path)
    file_sha256 = hashlib.sha256(workbook_path.read_bytes()).hexdigest()
    existing_records = list(MemberDatabaseRecord.objects.all())
    email_counts = Counter(record.email.strip().casefold() for record in existing_records if record.email.strip())
    glp_counts = Counter(record.glp_id_number.strip().casefold() for record in existing_records if record.glp_id_number.strip())
    member_number_counts = Counter(record.member_number.strip().casefold() for record in existing_records if record.member_number.strip())
    by_email = {
        record.email.strip().casefold(): record
        for record in existing_records
        if record.email.strip() and email_counts[record.email.strip().casefold()] == 1
    }
    by_glp = {
        record.glp_id_number.strip().casefold(): record
        for record in existing_records
        if record.glp_id_number.strip() and glp_counts[record.glp_id_number.strip().casefold()] == 1
    }
    by_member_number = {
        record.member_number.strip().casefold(): record
        for record in existing_records
        if record.member_number.strip() and member_number_counts[record.member_number.strip().casefold()] == 1
    }
    by_name = build_member_name_index(existing_records)
    mutable_fields = [
        "section",
        "member_number",
        "name",
        "glp_id_number",
        "date_of_birth",
        "initiation_date",
        "passing_date",
        "raising_date",
        "proficiency_date",
        "suspension",
        "restored",
        "demit",
        "lml",
        "dual_plural_honorary_date",
        "address",
        "telephone",
        "email",
        "appendant_bodies",
        "blood_type",
        "widow_or_sister",
        "widow_or_sister_date_of_birth",
        "meeting_attendance",
        "monthly_attendance",
        "annual_dues",
        "raw_cells",
    ]

    updated_records = []
    unmatched_names = []
    old_emails: dict[int, str] = {}
    with transaction.atomic():
        workbook_import, _created = MembersWorkbookImport.objects.update_or_create(
            file_sha256=file_sha256,
            defaults={
                "filename": workbook_path.name,
                "sheet_summaries": summaries,
            },
        )
        for incoming in incoming_records:
            existing = None
            if incoming.email.strip():
                existing = by_email.get(incoming.email.strip().casefold())
            if existing is None and incoming.glp_id_number.strip():
                existing = by_glp.get(incoming.glp_id_number.strip().casefold())
            if existing is None:
                matched_member, match_status, _notes = resolve_member_name_match(incoming.name, by_name)
                if match_status == "matched":
                    existing = matched_member
            if existing is None and incoming.member_number.strip():
                existing = by_member_number.get(incoming.member_number.strip().casefold())

            if existing is None:
                unmatched_names.append(incoming.name)
                continue

            if existing.pk not in old_emails:
                old_emails[existing.pk] = existing.email.strip().casefold() if existing.email else ""
            existing.workbook_import = workbook_import
            for field in mutable_fields:
                setattr(existing, field, getattr(incoming, field))
            updated_records.append(existing)

        if updated_records:
            MemberDatabaseRecord.objects.bulk_update(
                updated_records,
                ["workbook_import", *mutable_fields, "updated_at"],
            )

        _sync_member_accounts(updated_records, old_emails)

    return MembersWorkbookUpdateResult(
        total_rows=len(incoming_records),
        updated_count=len(updated_records),
        unmatched_count=len(unmatched_names),
        unmatched_names=unmatched_names[:10],
    )


def import_members_workbook(path: str | Path) -> MembersWorkbookImport:
    workbook_path = Path(path)
    file_sha256 = hashlib.sha256(workbook_path.read_bytes()).hexdigest()

    with OOXMLWorkbook(workbook_path) as workbook:
        members = workbook.read_sheet("DLL 347 Members Database")
        visitors = workbook.read_sheet("Lodge Visitor")
        balloting = workbook.read_sheet("Balloting & Coin")

    member_columns = sheet_columns(members, "B", "GZ", (9, 10))
    visitor_columns = sheet_columns(visitors, "B", "E", (3,))
    balloting_columns = sheet_columns(balloting, "B", "Z", (3, 4))
    member_sections = members_section_rows(members)
    balloting_sections = {
        row: text_value(balloting.value(f"B{row}"))
        for row in (5, 63, 73)
        if text_value(balloting.value(f"B{row}"))
    }

    member_records = []
    for row in range(12, 179):
        if not is_numbered_record(members, row, "B", "C"):
            continue
        name = text_value(members.value(f"C{row}"))
        member_records.append(
            MemberDatabaseRecord(
                source_row=row,
                section=current_section(member_sections, row),
                member_number=text_value(members.value(f"B{row}")),
                name=name,
                glp_id_number=text_value(members.value(f"D{row}")),
                date_of_birth=excel_date(members.value(f"E{row}")),
                initiation_date=excel_date(members.value(f"F{row}")),
                passing_date=excel_date(members.value(f"G{row}")),
                raising_date=excel_date(members.value(f"H{row}")),
                proficiency_date=excel_date(members.value(f"I{row}")),
                suspension=text_value(members.value(f"J{row}")),
                restored=text_value(members.value(f"K{row}")),
                demit=text_value(members.value(f"L{row}")),
                lml=text_value(members.value(f"M{row}")),
                dual_plural_honorary_date=text_value(members.value(f"N{row}")),
                address=text_value(members.value(f"O{row}")),
                telephone=text_value(members.value(f"P{row}")),
                email=text_value(members.value(f"Q{row}")),
                appendant_bodies=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(19, 28))
                ),
                blood_type=text_value(members.value(f"AC{row}")),
                widow_or_sister=text_value(members.value(f"AD{row}")),
                widow_or_sister_date_of_birth=excel_date(members.value(f"AE{row}")),
                meeting_attendance=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(33, 81))
                ),
                monthly_attendance=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(83, 175))
                ),
                annual_dues=keyed_values(
                    members, row, member_columns, set(column_name(i) for i in range(177, 208))
                ),
                raw_cells=raw_row(members, row, "B", "GZ"),
            )
        )

    merged_values: dict[str, dict[int, Any]] = {"B": {}, "C": {}}
    for merged_range in visitors.merged_ranges:
        start, end = merged_range.split(":")
        start_column, start_row = split_reference(start)
        end_column, end_row = split_reference(end)
        if start_column in merged_values and end_column == start_column:
            for row in range(start_row, end_row + 1):
                merged_values[start_column][row] = visitors.value(start)

    visitor_records = []
    for row in range(4, 214):
        name = text_value(visitors.value(f"D{row}"))
        lodge = text_value(visitors.value(f"E{row}"))
        if not name and not lodge:
            continue
        visitor_records.append(
            LodgeVisitorRecord(
                source_row=row,
                meeting=text_value(merged_values["B"].get(row, visitors.value(f"B{row}"))),
                meeting_date=excel_date(
                    merged_values["C"].get(row, visitors.value(f"C{row}"))
                ),
                name=name,
                lodge=lodge,
                raw_cells=raw_row(visitors, row, "B", "E"),
            )
        )

    balloting_records = []
    member_name_index = build_member_name_index(member_records)
    attendance_columns = set(column_name(i) for i in range(5, 22))
    for row in range(6, 85):
        if not is_numbered_record(balloting, row, "B", "C"):
            continue
        name = text_value(balloting.value(f"C{row}"))
        matched_member, match_status, match_notes = resolve_member_name_match(
            name,
            member_name_index,
        )
        balloting_records.append(
            BallotingCoinRecord(
                member_record=matched_member,
                source_row=row,
                section=current_section(balloting_sections, row),
                member_number=text_value(balloting.value(f"B{row}")),
                name=name,
                member_match_status=match_status,
                member_match_notes=match_notes,
                proficiency_date=excel_date(balloting.value(f"D{row}")),
                meeting_attendance=keyed_values(
                    balloting, row, balloting_columns, attendance_columns
                ),
                six_meetings_rule=integer_value(balloting.value(f"V{row}")),
                three_meetings_rule=integer_value(balloting.value(f"X{row}")),
                wm_coin_75_percent=integer_value(balloting.value(f"Z{row}")),
                raw_cells=raw_row(balloting, row, "B", "Z"),
            )
        )

    summaries = {
        members.name: {"records": len(member_records), "columns": len(member_columns)},
        visitors.name: {"records": len(visitor_records), "columns": len(visitor_columns)},
        balloting.name: {"records": len(balloting_records), "columns": len(balloting_columns)},
    }

    with transaction.atomic():
        workbook_import, _created = MembersWorkbookImport.objects.update_or_create(
            file_sha256=file_sha256,
            defaults={
                "filename": workbook_path.name,
                "sheet_summaries": summaries,
            },
        )
        MemberDatabaseRecord.objects.all().delete()
        LodgeVisitorRecord.objects.all().delete()
        BallotingCoinRecord.objects.all().delete()
        MembersWorkbookSheetSchema.objects.all().delete()

        MembersWorkbookSheetSchema.objects.bulk_create(
            [
                MembersWorkbookSheetSchema(
                    workbook_import=workbook_import,
                    sheet_name=sheet.name,
                    table_key=table_key,
                    dimension=sheet.dimension,
                    freeze_panes=sheet.freeze_panes,
                    merged_ranges=sheet.merged_ranges,
                    columns=columns,
                    row_formats=sheet.row_formats,
                )
                for sheet, table_key, columns in (
                    (members, "members", member_columns),
                    (visitors, "lodge_visitors", visitor_columns),
                    (balloting, "balloting_coin", balloting_columns),
                )
            ]
        )
        for record in member_records:
            record.workbook_import = workbook_import
        for record in visitor_records:
            record.workbook_import = workbook_import
        for record in balloting_records:
            record.workbook_import = workbook_import
        MemberDatabaseRecord.objects.bulk_create(member_records)
        LodgeVisitorRecord.objects.bulk_create(visitor_records)
        BallotingCoinRecord.objects.bulk_create(balloting_records)

    return workbook_import


def schema_report(workbook_import: MembersWorkbookImport) -> str:
    report = {
        schema.sheet_name: schema.columns
        for schema in workbook_import.sheet_schemas.all().order_by("id")
    }
    return json.dumps(report, indent=2, ensure_ascii=True)
