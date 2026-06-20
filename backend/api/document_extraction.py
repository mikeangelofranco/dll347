from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import BinaryIO


MONTH_NAMES = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def _clean_database_text(value: str) -> str:
    return value.replace("\x00", "")


def _upload_path(upload: BinaryIO) -> str | None:
    path = getattr(upload, "path", None)
    if path:
        return str(path)
    temporary_file_path = getattr(upload, "temporary_file_path", None)
    if callable(temporary_file_path):
        try:
            return str(temporary_file_path())
        except Exception:
            return None
    return None


def _ocr_binary_path() -> str | None:
    if not shutil.which("swiftc"):
        return None
    script_path = Path(__file__).with_name("ocr_document.swift")
    if not script_path.exists():
        return None
    binary_path = Path(tempfile.gettempdir()) / "dll347_ocr_document"
    try:
        if not binary_path.exists() or binary_path.stat().st_mtime < script_path.stat().st_mtime:
            subprocess.run(
                ["swiftc", str(script_path), "-o", str(binary_path)],
                check=True,
                capture_output=True,
                timeout=45,
            )
        return str(binary_path)
    except Exception:
        return None


def _ocr_with_macos_vision(upload: BinaryIO) -> str:
    path = _upload_path(upload)
    binary_path = _ocr_binary_path()
    if not path or not binary_path:
        return ""
    try:
        completed = subprocess.run(
            [binary_path, path],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )
    except Exception:
        return ""
    if completed.returncode != 0:
        return ""
    return _clean_database_text(completed.stdout)


def _ocr_with_tesseract(upload: BinaryIO, content_type: str) -> str:
    path = _upload_path(upload)
    tesseract = shutil.which("tesseract")
    if not path or not tesseract:
        return ""

    image_paths: list[Path] = []
    with tempfile.TemporaryDirectory(prefix="dll347_ocr_") as tmpdir:
        tmp_path = Path(tmpdir)
        if content_type == "application/pdf":
            pdftoppm = shutil.which("pdftoppm")
            if not pdftoppm:
                return ""
            prefix = tmp_path / "page"
            try:
                subprocess.run(
                    [pdftoppm, "-r", "220", "-png", path, str(prefix)],
                    check=True,
                    capture_output=True,
                    timeout=60,
                )
            except Exception:
                return ""
            image_paths = sorted(tmp_path.glob("page-*.png"))
        else:
            image_paths = [Path(path)]

        output: list[str] = []
        for image_path in image_paths[:6]:
            try:
                completed = subprocess.run(
                    [tesseract, str(image_path), "stdout", "--psm", "6"],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
            except Exception:
                continue
            if completed.returncode == 0 and completed.stdout.strip():
                output.append(completed.stdout)
        return _clean_database_text("\n".join(output))


def _ocr_document_text(upload: BinaryIO, content_type: str) -> str:
    text = _ocr_with_tesseract(upload, content_type)
    if text.strip():
        return text
    return _ocr_with_macos_vision(upload)


@dataclass
class TreasurerExtractionResult:
    values: dict[str, Decimal | int | str | None] = field(default_factory=dict)
    raw_values: dict[str, str] = field(default_factory=dict)
    text: str = ""
    errors: list[str] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        required = {"cash_to_date", "cash_disbursements", "remaining_cash"}
        return not self.errors and required.issubset(self.values)


def _extract_pdf_text(upload: BinaryIO) -> str:
    upload.seek(0)
    try:
        from pypdf import PdfReader
    except Exception:
        return ""

    try:
        reader = PdfReader(upload)
        return _clean_database_text("\n".join(page.extract_text() or "" for page in reader.pages))
    except Exception:
        return ""
    finally:
        upload.seek(0)


def _fallback_text(upload: BinaryIO) -> str:
    upload.seek(0)
    try:
        data = upload.read()
        return _clean_database_text(data.decode("utf-8", errors="ignore"))
    except Exception:
        return ""
    finally:
        upload.seek(0)


def read_document_text(upload: BinaryIO, content_type: str) -> str:
    if content_type == "application/pdf":
        text = _extract_pdf_text(upload)
        if text.strip():
            return text
        text = _ocr_document_text(upload, content_type)
        if text.strip():
            return text
        return ""
    if content_type in {"image/jpeg", "image/png"}:
        text = _ocr_document_text(upload, content_type)
        if text.strip():
            return text
    return _fallback_text(upload)


def _money(value: str) -> Decimal | None:
    cleaned = value.replace(",", "").replace("P", "").replace("₱", "").strip()
    try:
        return Decimal(cleaned).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def _find_amount_after(text: str, label: str) -> tuple[Decimal | None, str]:
    pattern = rf"{label}[\s\S]{{0,900}}?(?:P|₱)?\s*([0-9]{{1,3}}(?:,[0-9]{{3}})*(?:\.[0-9]{{2}})|[0-9]+(?:\.[0-9]{{2}}))"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None, ""
    raw = match.group(1)
    return _money(raw), raw


def _find_report_period(text: str) -> tuple[int | None, int | None]:
    match = re.search(
        r"for\s+the\s+month\s+of\s+([A-Za-z]+)[\s\S]{0,220}?([12][0-9]{3})",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None
    return MONTH_NAMES.get(match.group(1).lower()), int(match.group(2))


def _find_accounting_totals(text: str) -> dict[str, Decimal]:
    amount_pattern = r"(?:P|₱)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))"
    amounts = [
        amount
        for amount in (_money(match.group(1)) for match in re.finditer(amount_pattern, text))
        if amount is not None
    ]
    if len(amounts) < 3:
        return {}

    best: tuple[int, int, int, Decimal, Decimal, Decimal] | None = None
    for cash_index, cash_to_date in enumerate(amounts):
        for outflow_index in range(cash_index + 1, len(amounts)):
            cash_disbursements = amounts[outflow_index]
            if cash_disbursements <= 0 or cash_disbursements >= cash_to_date:
                continue
            for remaining_index in range(outflow_index + 1, len(amounts)):
                remaining_cash = amounts[remaining_index]
                if cash_to_date - cash_disbursements == remaining_cash:
                    best = (
                        cash_index,
                        outflow_index,
                        remaining_index,
                        cash_to_date,
                        cash_disbursements,
                        remaining_cash,
                    )

    if best is None:
        return {}

    cash_index, _, _, cash_to_date, cash_disbursements, remaining_cash = best
    earlier_large_amounts = [
        amount for amount in amounts[:cash_index] if amount > 0 and amount < cash_to_date
    ]
    values = {
        "cash_to_date": cash_to_date,
        "cash_disbursements": cash_disbursements,
        "remaining_cash": remaining_cash,
    }
    if earlier_large_amounts:
        values["cash_balance_last_report"] = max(earlier_large_amounts)
    return values


def extract_treasurer_report(upload: BinaryIO, content_type: str) -> TreasurerExtractionResult:
    text = read_document_text(upload, content_type)
    normalized_text = re.sub(r"[ \t]+", " ", text)
    result = TreasurerExtractionResult(text=text)

    if not normalized_text.strip():
        result.errors.append(
            "This file does not expose readable text. Upload was saved, but Treasurer values need OCR or manual review."
        )
        return result

    month, year = _find_report_period(normalized_text)
    if month:
        result.values["report_month"] = month
    if year:
        result.values["report_year"] = year

    field_labels = {
        "cash_balance_last_report": r"CASH\s+BALANCE\s+per\s+last\s+report",
        "cash_to_date": r"TOTAL\s+CASH\s+ACCOUNTABILITY",
        "cash_disbursements": r"TOTAL\s+CASH\s+DISBURSEMENTS",
        "remaining_cash": r"CASH\s+IN\s+BANK\s+AT\s+THE\s+END\s+OF\s+THE\s+MONTH",
    }
    for field_name, label in field_labels.items():
        amount, raw = _find_amount_after(normalized_text, label)
        if amount is not None:
            result.values[field_name] = amount
            result.raw_values[field_name] = raw

    accounting_totals = _find_accounting_totals(normalized_text)
    for field_name, amount in accounting_totals.items():
        result.values[field_name] = amount
        result.raw_values[field_name] = str(amount)

    if "cash_to_date" in result.values and "cash_balance_last_report" in result.values:
        result.values["cash_received_month"] = (
            result.values["cash_to_date"] - result.values["cash_balance_last_report"]
        )

    missing = [
        label
        for field_name, label in (
            ("cash_to_date", "cash to date"),
            ("cash_disbursements", "less cash / total disbursements"),
            ("remaining_cash", "total remaining cash"),
        )
        if field_name not in result.values
    ]
    if missing:
        result.errors.append(f"Unable to identify: {', '.join(missing)}.")

    return result
