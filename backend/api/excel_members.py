from __future__ import annotations

import hashlib
import json
import re
import unicodedata
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from django.db import transaction

from .models import (
    Account,
    ArchivedAccount,
    ArchivedMemberRecord,
    BallotingCoinRecord,
    LodgeVisitorRecord,
    MemberDatabaseRecord,
    MembersWorkbookImport,
    MembersWorkbookSheetSchema,
)
from .account_services import archive_and_reset_member_account



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
    created_count: int
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


def date_or_text_value(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        cleaned = value.strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", cleaned):
            return cleaned
        m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", cleaned)
        if m:
            m_val, d_val, y_val = int(m.group(1)), int(m.group(2)), int(m.group(3))
            try:
                return date(y_val, m_val, d_val).isoformat()
            except ValueError:
                return cleaned
        return cleaned
    if isinstance(value, (int, float)):
        # Excel date serials for years 1970 to 2090 are ~25569 to ~70000.
        # Small integers (e.g. batch number 14) or years (e.g. 2024) are preserved as exact text.
        if 20000 <= value <= 70000:
            try:
                d = (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
                return d.isoformat()
            except Exception:
                pass
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
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
    value = cell.value
    number_format = cell.number_format
    if _is_date_format(number_format) and isinstance(value, (int, float)):
        converted = excel_date(value)
        if converted is not None:
            value = converted.isoformat()
    return {
        "value": value,
        "formula": cell.formula,
        "style_id": cell.style_id,
        "number_format": number_format,
    }


def _is_date_format(number_format: str | None) -> bool:
    if not number_format:
        return False
    nf = number_format.lower()
    date_fragments = ["m/d", "d/m", "m-d", "d-m", "yyyy", "dd mmm", "mmm dd", "mmmm", "yy"]
    for fragment in date_fragments:
        if fragment in nf:
            return True
    return False


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


def is_valid_section_name(value: str) -> bool:
    clean = re.sub(r"[^A-Za-z0-9]", "", value or "").upper()
    if not clean:
        return False
    disallowed_fragments = (
        "MEMBERSDIRECTORY",
        "DATULAPULAPU",
        "LODGENO347",
        "MASONICDISTRICT",
        "GRANDLODGE",
        "PILIPOGCORDOVA",
    )
    if any(fragment in clean for fragment in disallowed_fragments):
        return False
    return True


def members_section_rows(sheet: ParsedSheet, min_row: int = 11) -> dict[int, str]:
    sections = {}
    for merged_range in sheet.merged_ranges:
        match = re.fullmatch(r"B(\d+):([A-Z]+)\1", merged_range)
        if match:
            row = int(match.group(1))
            if row < min_row:
                continue
            end_column = match.group(2)
            if column_number(end_column) >= 12:
                value = text_value(sheet.value(f"B{row}"))
                if value and is_valid_section_name(value):
                    sections[row] = value
    return sections


def current_section(sections: dict[int, str], row: int) -> str:
    applicable_rows = [section_row for section_row in sections if section_row < row]
    return sections[max(applicable_rows)] if applicable_rows else ""


def is_petitioner_section(section: str) -> bool:
    normalized = section.strip().upper()
    return normalized.startswith("TRESTLE BOARD") or "PETITIONER" in normalized


def is_imes_header(norm_header: str) -> bool:
    if "IMES" in norm_header or "IMSE" in norm_header or "IEMS" in norm_header:
        return True
    if "INSTITUTEOFMASONICEDUCATION" in norm_header:
        return True
    return False


@dataclass
class DynamicMemberColumnMap:
    number_col: str = "B"
    name_col: str = "C"
    glp_id_col: str = "D"
    dob_col: str = "E"
    initiation_col: str = "F"
    passing_col: str = "G"
    raising_col: str = "H"
    proficiency_col: str = "I"
    imes_col: str | None = None
    suspension_col: str = "J"
    restored_col: str = "K"
    demit_col: str = "L"
    lml_col: str = "M"
    dual_plural_col: str = "N"
    address_col: str = "O"
    telephone_col: str = "P"
    email_col: str = "Q"
    blood_type_col: str = "AC"
    widow_sister_col: str = "AD"
    widow_dob_col: str = "AE"
    appendant_cols: set[str] = field(default_factory=set)
    meeting_attendance_cols: set[str] = field(default_factory=set)
    monthly_attendance_cols: set[str] = field(default_factory=set)
    annual_dues_cols: set[str] = field(default_factory=set)


def build_member_column_map(member_columns: list[dict[str, Any]]) -> DynamicMemberColumnMap:
    col_map = DynamicMemberColumnMap()
    appendant_candidates: set[str] = set()
    annual_dues_candidates: set[str] = set()

    for col_def in member_columns:
        col = col_def["column"]
        parts = col_def.get("header_parts", [])
        norm = normalized_header_value(" ".join(parts))
        norm_top = normalized_header_value(parts[0]) if parts else ""

        if norm in {"NO", "NUMBER", "MEMBERNO", "NUM"}:
            col_map.number_col = col
        elif norm in {"NAME", "MEMBERNAME", "FULLNAME"}:
            col_map.name_col = col
        elif "GLPID" in norm or norm in {"GLP", "GLPNUMBER", "GLPIDNUMBER"}:
            col_map.glp_id_col = col
        elif ("DATEOFBIRTH" in norm or norm in {"DOB", "BIRTHDATE"}) and "WIDOW" not in norm:
            col_map.dob_col = col
        elif "INITIAT" in norm or "1STDEGREE" in norm:
            col_map.initiation_col = col
        elif "PASS" in norm or "2NDDEGREE" in norm:
            col_map.passing_col = col
        elif "RAIS" in norm or "3RDDEGREE" in norm:
            col_map.raising_col = col
        elif any(token in norm for token in ("PROFECIEN", "PROFICIEN", "PROFIECIEN")):
            col_map.proficiency_col = col
        elif is_imes_header(norm):
            col_map.imes_col = col
        elif "SUSPEND" in norm:
            col_map.suspension_col = col
        elif "RESTORE" in norm:
            col_map.restored_col = col
        elif "DEMIT" in norm or "DIMIT" in norm:
            col_map.demit_col = col
        elif norm == "LML" or "LIFEMEMBER" in norm:
            col_map.lml_col = col
        elif "DUAL" in norm or "PLURAL" in norm:
            col_map.dual_plural_col = col
        elif "ADDRESS" in norm or "LOCATION" in norm:
            col_map.address_col = col
        elif "TELEPHONE" in norm or "PHONE" in norm or "CONTACTTEL" in norm or "MOBILE" in norm:
            col_map.telephone_col = col
        elif "EMAIL" in norm:
            col_map.email_col = col
        elif "BLOOD" in norm:
            col_map.blood_type_col = col
        elif "WIDOW" in norm and not ("BIRTH" in norm or "DOB" in norm):
            col_map.widow_sister_col = col
        elif "WIDOW" in norm and ("BIRTH" in norm or "DOB" in norm):
            col_map.widow_dob_col = col

        if ("APPENDANT" in norm or "CLUB" in norm) and not is_imes_header(norm):
            appendant_candidates.add(col)
        if "ANNUALDUES" in norm or "DUES" in norm_top:
            annual_dues_candidates.add(col)

    offset = column_number(col_map.blood_type_col) - 29

    col_map.appendant_cols = appendant_candidates or {column_name(i + offset) for i in range(19, 28)}
    col_map.meeting_attendance_cols = {column_name(i + offset) for i in range(33, 81)}
    col_map.monthly_attendance_cols = {column_name(i + offset) for i in range(83, 175)}
    col_map.annual_dues_cols = annual_dues_candidates or {column_name(i + offset) for i in range(177, 208)}

    return col_map


def find_member_sheet_layout(sheet: ParsedSheet) -> MemberSheetLayout:
    for row in range(1, 25):
        headers_in_row = {
            column_name(c): normalized_header_value(sheet.value(f"{column_name(c)}{row}"))
            for c in range(2, 20)
        }
        vals = set(headers_in_row.values())
        has_no = any(v in {"NO", "NUMBER", "MEMBERNO", "NUM"} for v in vals)
        has_name = any(v in {"NAME", "MEMBERNAME", "FULLNAME"} for v in vals)
        has_glp = any("GLPID" in v or v in {"GLP", "GLPNUMBER"} for v in vals)
        has_dob = any("DATEOFBIRTH" in v or v in {"DOB", "BIRTHDATE"} for v in vals)

        if has_no and has_name and has_glp and has_dob:
            subheader_row = row + 1
            header_cells = [
                normalized_header_value(sheet.value(f"{column_name(c)}{r}"))
                for r in (row, subheader_row)
                for c in range(2, 60)
            ]
            has_email = any("EMAIL" in h for h in header_cells)
            has_blood = any("BLOOD" in h for h in header_cells)

            missing_helpful_headers = []
            if not has_email:
                missing_helpful_headers.append("EMAIL")
            if not has_blood:
                missing_helpful_headers.append("BLOOD TYPE")

            if missing_helpful_headers:
                raise MembersWorkbookFormatError(
                    [
                        "Members Data format issue: the member table was found, but expected supporting columns are missing "
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
    col_map = build_member_column_map(member_columns)
    member_sections = members_section_rows(members, min_row=layout.subheader_row + 1)
    max_row = max(
        [row for _column, row in (split_reference(reference) for reference in members.cells)]
        or [layout.first_data_row]
    )

    member_records = []
    for row in range(layout.first_data_row, max_row + 1):
        if not is_numbered_record(members, row, col_map.number_col, col_map.name_col):
            continue
        name = text_value(members.value(f"{col_map.name_col}{row}"))
        section = current_section(member_sections, row)
        imes_val = (
            date_or_text_value(members.value(f"{col_map.imes_col}{row}"))
            if col_map.imes_col
            else ""
        )
        member_records.append(
            MemberDatabaseRecord(
                source_row=row,
                section=section,
                member_number=text_value(members.value(f"{col_map.number_col}{row}")),
                name=name,
                glp_id_number="" if is_petitioner_section(section) else text_value(members.value(f"{col_map.glp_id_col}{row}")),
                date_of_birth=excel_date(members.value(f"{col_map.dob_col}{row}")),
                initiation_date=excel_date(members.value(f"{col_map.initiation_col}{row}")),
                passing_date=excel_date(members.value(f"{col_map.passing_col}{row}")),
                raising_date=excel_date(members.value(f"{col_map.raising_col}{row}")),
                proficiency_date=excel_date(members.value(f"{col_map.proficiency_col}{row}")),
                imes=imes_val,
                suspension=text_value(members.value(f"{col_map.suspension_col}{row}")),
                restored=text_value(members.value(f"{col_map.restored_col}{row}")),
                demit=text_value(members.value(f"{col_map.demit_col}{row}")),
                lml=text_value(members.value(f"{col_map.lml_col}{row}")),
                dual_plural_honorary_date=text_value(members.value(f"{col_map.dual_plural_col}{row}")),
                address=text_value(members.value(f"{col_map.address_col}{row}")),
                telephone=text_value(members.value(f"{col_map.telephone_col}{row}")),
                email=text_value(members.value(f"{col_map.email_col}{row}")),
                appendant_bodies=keyed_values(members, row, member_columns, col_map.appendant_cols),
                blood_type=text_value(members.value(f"{col_map.blood_type_col}{row}")),
                widow_or_sister=text_value(members.value(f"{col_map.widow_sister_col}{row}")),
                widow_or_sister_date_of_birth=excel_date(members.value(f"{col_map.widow_dob_col}{row}")),
                meeting_attendance=keyed_values(members, row, member_columns, col_map.meeting_attendance_cols),
                monthly_attendance=keyed_values(members, row, member_columns, col_map.monthly_attendance_cols),
                annual_dues=keyed_values(members, row, member_columns, col_map.annual_dues_cols),
                raw_cells=raw_row(members, row, "B", "GZ"),
            )
        )

    if not member_records:
        raise MembersWorkbookFormatError(["No member rows were found in the expected member table range."])

    return member_records, {
        members.name: {
            "records": len(member_records),
            "columns": len(member_columns),
            "sections": sorted(
                {
                    s.strip()
                    for s in member_sections.values()
                    if s.strip() and is_valid_section_name(s)
                }
            ),
        },
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
    for record in updated_records:
        new_email = record.email.strip().casefold() if record.email else ""
        old_email = old_emails.get(record.pk, "")

        if not new_email or new_email == old_email:
            continue

        archive_and_reset_member_account(
            old_email=old_email,
            new_email=record.email.strip(),
            member=record,
            change_source=ArchivedAccount.ChangeSource.WORKBOOK_IMPORT,
        )

    _sync_account_glp_ids(updated_records)



def _sync_account_glp_ids(updated_records: list[MemberDatabaseRecord]) -> None:
    member_emails = {record.email.strip().casefold() for record in updated_records if record.email.strip()}
    if not member_emails:
        return
    accounts = [a for a in Account.objects.all() if a.email.strip().casefold() in member_emails]
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
    section_member_number_counts = Counter(
        (normalized_header_value(record.section), record.member_number.strip().casefold())
        for record in existing_records
        if record.member_number.strip()
    )
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
    by_section_member_number = {
        (normalized_header_value(record.section), record.member_number.strip().casefold()): record
        for record in existing_records
        if record.member_number.strip()
        and section_member_number_counts[
            (normalized_header_value(record.section), record.member_number.strip().casefold())
        ] == 1
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
        "imes",
        "date_presented",
        "date_balloted",
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
    created_records = []
    unmatched_names = []
    matched_db_ids: set[int] = set()
    old_emails: dict[int, str] = {}
    final_source_rows: dict[int, int] = {}
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
                if existing is not None and existing.pk in matched_db_ids:
                    existing = None
            if existing is None and incoming.glp_id_number.strip():
                existing = by_glp.get(incoming.glp_id_number.strip().casefold())
                if existing is not None and existing.pk in matched_db_ids:
                    existing = None
            if existing is None:
                available_name_matches = [
                    record
                    for record in by_name.get(member_name_match_key(incoming.name), [])
                    if record.pk not in matched_db_ids
                ]
                if len(available_name_matches) == 1:
                    existing = available_name_matches[0]
            if existing is None and incoming.member_number.strip():
                member_number_key = (
                    normalized_header_value(incoming.section),
                    incoming.member_number.strip().casefold(),
                )
                existing = by_section_member_number.get(member_number_key)
                if existing is not None and existing.pk in matched_db_ids:
                    existing = None

            if existing is None:
                incoming.workbook_import = workbook_import
                created_records.append(incoming)
                continue

            matched_db_ids.add(existing.pk)
            final_source_rows[existing.pk] = incoming.source_row
            if existing.pk not in old_emails:
                old_emails[existing.pk] = existing.email.strip().casefold() if existing.email else ""
            existing.workbook_import = workbook_import
            for field in mutable_fields:
                setattr(existing, field, getattr(incoming, field))
            updated_records.append(existing)

        # Archive obsolete petitioners so their data is fully preserved
        existing_petitioners = {
            record
            for record in existing_records
            if is_petitioner_section(record.section)
        }
        petitioners_to_archive = [
            record for record in existing_petitioners
            if record.pk not in matched_db_ids
        ]
        petitioner_archive_ids = {record.pk for record in petitioners_to_archive}

        if petitioners_to_archive:
            archived_objects = [
                ArchivedMemberRecord(
                    original_member_id=record.pk,
                    workbook_import=workbook_import,
                    source_row=record.source_row,
                    archive_reason="Petitioner removed or not present in updated workbook",
                    section=record.section,
                    member_number=record.member_number,
                    name=record.name,
                    glp_id_number=record.glp_id_number,
                    date_of_birth=record.date_of_birth,
                    initiation_date=record.initiation_date,
                    passing_date=record.passing_date,
                    raising_date=record.raising_date,
                    proficiency_date=record.proficiency_date,
                    imes=record.imes,
                    date_presented=record.date_presented,
                    date_balloted=record.date_balloted,
                    suspension=record.suspension,
                    restored=record.restored,
                    demit=record.demit,
                    lml=record.lml,
                    dual_plural_honorary_date=record.dual_plural_honorary_date,
                    address=record.address,
                    telephone=record.telephone,
                    email=record.email,
                    profile_photo=str(record.profile_photo) if record.profile_photo else "",
                    default_profile_photo=str(record.default_profile_photo) if record.default_profile_photo else "",
                    appendant_bodies=record.appendant_bodies,
                    blood_type=record.blood_type,
                    widow_or_sister=record.widow_or_sister,
                    widow_or_sister_date_of_birth=record.widow_or_sister_date_of_birth,
                    meeting_attendance=record.meeting_attendance,
                    monthly_attendance=record.monthly_attendance,
                    annual_dues=record.annual_dues,
                    raw_cells=record.raw_cells,
                    record_created_at=record.created_at,
                    record_updated_at=record.updated_at,
                )
                for record in petitioners_to_archive
            ]
            ArchivedMemberRecord.objects.bulk_create(archived_objects)
            MemberDatabaseRecord.objects.filter(pk__in=petitioner_archive_ids).delete()

        remaining_existing = [
            record for record in existing_records
            if record.pk not in petitioner_archive_ids
        ]

        # Shift all remaining records out of the incoming row range so
        # inserts and row shifts cannot trip the unique source_row index.
        # Use a high temporary base (10,000,000) well above any workbook or unmatched rows
        # to guarantee no overlap with max_incoming_row + 1000 + offset.
        highest_source_row = max(
            [record.source_row for record in existing_records]
            + [record.source_row for record in incoming_records]
            + [10_000_000]
        )
        for offset, record in enumerate(remaining_existing, start=1):
            record.source_row = highest_source_row + offset
        if remaining_existing:
            MemberDatabaseRecord.objects.bulk_update(remaining_existing, ["source_row"])

        # Any unmatched non-petitioners (e.g. honorary/suspended members not in sheet)
        # stay in the database, but are given clean row numbers beyond the active sheet.
        max_incoming_row = max((record.source_row for record in incoming_records), default=0)
        unmatched_kept = [record for record in remaining_existing if record.pk not in matched_db_ids]
        for offset, record in enumerate(unmatched_kept, start=1):
            record.source_row = max_incoming_row + 1000 + offset
        if unmatched_kept:
            MemberDatabaseRecord.objects.bulk_update(unmatched_kept, ["source_row"])

        # Assign final row numbers to all matched updated records
        if updated_records:
            for record in updated_records:
                record.source_row = final_source_rows[record.pk]
            MemberDatabaseRecord.objects.bulk_update(
                updated_records,
                ["workbook_import", "source_row", *mutable_fields, "updated_at"],
            )

        if created_records:
            MemberDatabaseRecord.objects.bulk_create(created_records)

        _sync_member_accounts([*updated_records, *created_records], old_emails)

    invalidate_member_name_index_cache()

    return MembersWorkbookUpdateResult(
        total_rows=len(incoming_records),
        updated_count=len(updated_records),
        created_count=len(created_records),
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
    member_sections = members_section_rows(members, min_row=11)
    balloting_sections = {
        row: text_value(balloting.value(f"B{row}"))
        for row in (5, 63, 73)
        if text_value(balloting.value(f"B{row}"))
    }

    col_map = build_member_column_map(member_columns)
    member_records = []
    for row in range(12, 179):
        if not is_numbered_record(members, row, col_map.number_col, col_map.name_col):
            continue
        name = text_value(members.value(f"{col_map.name_col}{row}"))
        section = current_section(member_sections, row)
        imes_val = (
            date_or_text_value(members.value(f"{col_map.imes_col}{row}"))
            if col_map.imes_col
            else ""
        )
        member_records.append(
            MemberDatabaseRecord(
                source_row=row,
                section=section,
                member_number=text_value(members.value(f"{col_map.number_col}{row}")),
                name=name,
                glp_id_number="" if is_petitioner_section(section) else text_value(members.value(f"{col_map.glp_id_col}{row}")),
                date_of_birth=excel_date(members.value(f"{col_map.dob_col}{row}")),
                initiation_date=excel_date(members.value(f"{col_map.initiation_col}{row}")),
                passing_date=excel_date(members.value(f"{col_map.passing_col}{row}")),
                raising_date=excel_date(members.value(f"{col_map.raising_col}{row}")),
                proficiency_date=excel_date(members.value(f"{col_map.proficiency_col}{row}")),
                imes=imes_val,
                suspension=text_value(members.value(f"{col_map.suspension_col}{row}")),
                restored=text_value(members.value(f"{col_map.restored_col}{row}")),
                demit=text_value(members.value(f"{col_map.demit_col}{row}")),
                lml=text_value(members.value(f"{col_map.lml_col}{row}")),
                dual_plural_honorary_date=text_value(members.value(f"{col_map.dual_plural_col}{row}")),
                address=text_value(members.value(f"{col_map.address_col}{row}")),
                telephone=text_value(members.value(f"{col_map.telephone_col}{row}")),
                email=text_value(members.value(f"{col_map.email_col}{row}")),
                appendant_bodies=keyed_values(members, row, member_columns, col_map.appendant_cols),
                blood_type=text_value(members.value(f"{col_map.blood_type_col}{row}")),
                widow_or_sister=text_value(members.value(f"{col_map.widow_sister_col}{row}")),
                widow_or_sister_date_of_birth=excel_date(members.value(f"{col_map.widow_dob_col}{row}")),
                meeting_attendance=keyed_values(members, row, member_columns, col_map.meeting_attendance_cols),
                monthly_attendance=keyed_values(members, row, member_columns, col_map.monthly_attendance_cols),
                annual_dues=keyed_values(members, row, member_columns, col_map.annual_dues_cols),
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
