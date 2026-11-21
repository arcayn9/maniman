"""Convert supported local statement tables to Maniman statement JSON.

Supported profile: explicit column headers separated by pipes, tabs, or two or
more spaces. Unknown layouts are review documents, never guessed transactions.
This module deliberately has no network or model-client dependencies.
"""

from __future__ import annotations

import argparse
from datetime import datetime
from decimal import Decimal, InvalidOperation
import getpass
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any


VERSION = "0.1.0"
PROFILE = "generic-bank-columns-v1"
MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES = 200
MAX_CHARACTERS = 2_000_000
MAX_SAFE_INTEGER = 9_007_199_254_740_991
CURRENCY_DIGITS = {"INR": 2, "USD": 2, "EUR": 2, "GBP": 2, "AUD": 2,
                   "CAD": 2, "SGD": 2, "JPY": 0, "KWD": 3, "BHD": 3}
DATE_TEXT = r"(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}[ -][A-Za-z]{3}[ -]\d{4})"
DATE_AT_START = re.compile(r"^\s*(" + DATE_TEXT + r")(?=\s|\||$)")
DATE_ANYWHERE = re.compile(DATE_TEXT)
HEADER_ALIASES = {
    "date": "transactionDate", "txndate": "transactionDate", "transactiondate": "transactionDate",
    "trandate": "transactionDate", "valuedate": "valueDate", "postingdate": "postingDate",
    "posteddate": "postingDate", "description": "description", "narration": "description",
    "particulars": "description", "details": "description", "transactiondetails": "description",
    "debit": "debit", "debitamount": "debit", "debitamt": "debit", "withdrawal": "debit",
    "withdrawalamt": "debit", "withdrawalamount": "debit", "paidout": "debit", "dr": "debit",
    "credit": "credit", "creditamount": "credit", "creditamt": "credit", "deposit": "credit",
    "depositamt": "credit", "depositamount": "credit", "paidin": "credit", "cr": "credit",
    "amount": "amount", "transactionamount": "amount", "direction": "direction",
    "type": "direction", "drcr": "direction", "debitcredit": "direction",
    "balance": "balance", "closingbalance": "balance", "runningbalance": "balance",
    "reference": "reference", "referenceno": "reference", "refno": "reference",
    "utr": "reference", "rrn": "reference", "transactionid": "reference", "chequeno": "reference",
}


class ConversionError(Exception):
    """An actionable, PII-free conversion failure."""


class SafeArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        # argparse's default errors echo unknown argument values, potentially a
        # password supplied by mistake. Never copy process arguments into logs.
        self.print_usage(sys.stderr)
        self.exit(1, "Invalid converter arguments. Run --help; passwords use --ask-password.\n")


def issue(code: str, message: str, severity: str = "warning", path: str | None = None) -> dict:
    result = {"code": code, "message": message, "severity": severity}
    if path:
        result["path"] = path
    return result


def parse_date(value: str) -> str:
    value = value.strip()
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d-%b-%Y"):
        try:
            return datetime.strptime(value, pattern).date().isoformat()
        except ValueError:
            continue
    raise ValueError("invalid_date")


def parse_minor(value: str, currency: str, allow_empty: bool = False) -> int | None:
    """Parse decimal values exactly; never round an OCR or malformed amount."""
    text = value.strip()
    if text in ("", "-", "—"):
        if allow_empty:
            return None
        raise ValueError("missing_amount")
    text = re.sub(r"^(?:INR|USD|EUR|GBP|AUD|CAD|SGD|JPY|KWD|BHD|Rs\.?)\s*", "", text, flags=re.I)
    text = re.sub(r"^₹\s*", "", text).strip()
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1].strip()
    suffix = re.search(r"\s*(DR|CR)$", text, flags=re.I)
    if suffix:
        negative = negative or suffix.group(1).upper() == "DR"
        text = text[:suffix.start()].strip()
    if not re.fullmatch(r"[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?", text):
        raise ValueError("invalid_amount")
    try:
        scaled = Decimal(text.replace(",", "")) * (10 ** CURRENCY_DIGITS[currency])
    except (InvalidOperation, KeyError):
        raise ValueError("unsupported_currency") from None
    if scaled != scaled.to_integral_value():
        raise ValueError("fractional_minor_unit")
    value_minor = int(scaled)
    if negative:
        value_minor = -abs(value_minor)
    if abs(value_minor) > MAX_SAFE_INTEGER:
        raise ValueError("amount_out_of_range")
    return value_minor


def split_cells(line: str) -> list[str]:
    if "|" in line:
        return [cell.strip() for cell in line.strip().strip("|").split("|")]
    if "\t" in line:
        return [cell.strip() for cell in line.split("\t")]
    return [cell.strip() for cell in re.split(r"\s{2,}", line.strip())]


def header_fields(line: str) -> list[str | None] | None:
    fields = [HEADER_ALIASES.get(re.sub(r"[^a-z]", "", cell.lower())) for cell in split_cells(line)]
    recognized_fields = [field for field in fields if field]
    if len(set(recognized_fields)) != len(recognized_fields):
        return None
    if "transactionDate" not in fields or "description" not in fields:
        return None
    if {"debit", "credit"}.issubset(fields) or {"amount", "direction"}.issubset(fields):
        return fields
    return None


def extract_metadata(pages: list[str], currency_override: str | None) -> tuple[dict, dict, dict, str | None, list[dict]]:
    """Only read explicitly labeled headers; transaction ranges are not coverage."""
    lines = [(page + 1, line.strip()) for page, text in enumerate(pages) for line in text.splitlines()]
    issues: list[dict] = []
    institution_names: list[tuple[int, str, str]] = []
    masked_accounts: set[str] = set()
    account_identities: set[str] = set()
    currencies: set[str] = set()
    periods: list[tuple[int, str, str, str]] = []
    kind_values: set[str] = set()
    for page, line in lines:
        bank = re.match(r"^(?:bank(?: name)?|institution)\s*:\s*(.{2,100})$", line, flags=re.I)
        if bank:
            institution_names.append((page, bank.group(1).strip(), line))
        elif re.fullmatch(r"[A-Za-z][A-Za-z .&'-]{1,90}\bBank(?: Limited| Ltd\.?)?", line, flags=re.I):
            institution_names.append((page, line, line))
        account = re.match(r"^(?:account(?: number| no\.?| identifier)?|card(?: number| no\.?)?)\s*:\s*(.+)$", line, flags=re.I)
        if account:
            identifier = account.group(1).strip().replace(" ", "")
            # Even if source contains full digits, export at most the last four.
            digits = re.sub(r"\D", "", identifier)
            if len(digits) >= 4:
                account_identities.add(identifier.upper())
                masked_accounts.add("XXXX" + digits[-4:])
        currency = re.match(r"^currency\s*:\s*([A-Z]{3})\s*$", line, flags=re.I)
        if currency:
            currencies.add(currency.group(1).upper())
        kind = re.match(r"^account type\s*:\s*(savings|current|checking|credit card|wallet|cash)\s*$", line, flags=re.I)
        if kind:
            kind_values.add(kind.group(1).lower().replace(" ", "_"))
        period = re.match(r"^(?:statement period|period|statement from)\s*:\s*(" + DATE_TEXT + r")\s*(?:to|through|–|—|-)\s*(" + DATE_TEXT + r")\s*$", line, flags=re.I)
        if period:
            try:
                start, end = parse_date(period.group(1)), parse_date(period.group(2))
                if start > end:
                    raise ValueError("invalid_period")
                periods.append((page, start, end, line))
            except ValueError:
                issues.append(issue("invalid_statement_period", "Declared statement period could not be validated."))
    distinct_names = {name.lower() for _, name, _ in institution_names}
    institution = {"name": None, "code": None, "country": None, "status": "unknown", "evidence": None}
    if len(distinct_names) == 1:
        page, name, evidence = institution_names[0]
        institution.update(name=name, status="extracted", evidence={"page": page, "text": evidence})
    else:
        issues.append(issue("institution_unknown" if not distinct_names else "institution_conflict", "Institution requires review."))
    if len(account_identities) > 1:
        raise ConversionError("Multiple account sections detected; split this document locally before converting.")
    if len(kind_values) > 1:
        raise ConversionError("Conflicting account types detected; split or review this document locally.")
    if len(currencies) > 1:
        raise ConversionError("Multiple currencies detected; split this document locally before converting.")
    currency = currency_override or next(iter(currencies), None)
    if currency_override and currencies and currencies != {currency_override}:
        raise ConversionError("Explicit currency conflicts with the statement currency; review locally.")
    if currency not in CURRENCY_DIGITS:
        currency = None
        issues.append(issue("currency_unknown", "Currency must be supplied explicitly or extracted from a Currency header."))
    account = {"kind": next(iter(kind_values), "unknown"), "maskedIdentifier": next(iter(masked_accounts), None), "currency": currency}
    if not account["maskedIdentifier"]:
        issues.append(issue("account_unknown", "Choose the account in Maniman; no account identifier was extracted."))
    period = {"start": None, "end": None, "status": "unknown", "evidence": None}
    distinct_periods = {(start, end) for _, start, end, _ in periods}
    if len(distinct_periods) == 1:
        page, start, end, evidence = periods[0]
        period.update(start=start, end=end, status="extracted", evidence={"page": page, "text": evidence})
    else:
        issues.append(issue("period_unknown" if not distinct_periods else "period_conflict", "Declared statement coverage requires review; transaction bounds are not coverage."))
    return institution, account, period, currency, issues


def extract_balances(pages: list[str], period: dict, account: dict, currency: str | None) -> tuple[dict | None, list[dict]]:
    if not currency or not period["start"] or not period["end"]:
        return None, []
    values: dict[str, set[int]] = {"opening": set(), "closing": set()}
    issues = []
    for page in pages:
        for line in page.splitlines():
            match = re.match(r"^\s*(opening|closing) balance\s*:\s*(.+?)\s*$", line, re.I)
            if match:
                try:
                    values[match.group(1).lower()].add(parse_minor(match.group(2), currency))
                except ValueError:
                    issues.append(issue("invalid_balance", "A declared opening/closing balance requires review."))
    if not any(values.values()):
        return None, issues
    convention = "positive_liability_balance" if account["kind"] == "credit_card" else "positive_asset_balance" if account["kind"] in ("savings", "current", "checking", "wallet", "cash") else "unknown"
    result: dict[str, Any] = {"signConvention": convention, "opening": None, "closing": None}
    for kind, amounts in values.items():
        if len(amounts) == 1:
            result[kind] = {"date": period["start"] if kind == "opening" else period["end"],
                            "amountMinor": next(iter(amounts)), "position": "start" if kind == "opening" else "end"}
        elif len(amounts) > 1:
            issues.append(issue("balance_conflict", "Conflicting declared balances require review."))
    return result, issues


def parse_transaction(cells: list[str], fields: list[str | None], currency: str, location: dict, document_id: str) -> dict:
    if len(cells) != len(fields):
        raise ValueError("column_count_mismatch")
    row = {field: value for field, value in zip(fields, cells) if field}
    date = parse_date(row.get("transactionDate", ""))
    description = row.get("description", "").strip()
    if not description:
        raise ValueError("missing_description")
    if len(description) > 16000 or len(row.get("reference", "")) > 512:
        raise ValueError("field_length_limit")
    if "debit" in fields:
        debit = parse_minor(row.get("debit", ""), currency, allow_empty=True)
        credit = parse_minor(row.get("credit", ""), currency, allow_empty=True)
        debit, credit = debit or 0, credit or 0
        if debit < 0 or credit < 0 or (debit > 0) == (credit > 0):
            raise ValueError("ambiguous_debit_credit")
        direction, amount = ("debit", debit) if debit else ("credit", credit)
    else:
        direction = row.get("direction", "").lower()
        direction = {"dr": "debit", "cr": "credit"}.get(direction, direction)
        amount = parse_minor(row.get("amount", ""), currency)
        if direction not in ("debit", "credit") or amount is None or amount <= 0:
            raise ValueError("invalid_direction_or_amount")
    running = parse_minor(row.get("balance", ""), currency, allow_empty=True)
    references = [{"type": "bank_reference", "value": row["reference"]}] if row.get("reference") else []
    rail = next((mode for mode in ("UPI", "IMPS", "NEFT", "RTGS") if re.search(r"\b" + mode + r"\b", description, re.I)), None)
    return {
        "observationId": f"{document_id}:p{location['page']}:r{location['row']}",
        "sourceTransactionId": None, "transactionDate": date,
        "postingDate": parse_date(row["postingDate"]) if row.get("postingDate") else None,
        "valueDate": parse_date(row["valueDate"]) if row.get("valueDate") else None,
        "description": description, "direction": direction, "amountMinor": amount,
        "currency": currency, "runningBalanceMinor": running, "references": references,
        "hints": {"paymentRail": rail, "transactionApp": None, "counterparty": None},
        "sourceLocation": location, "issues": [],
    }


def convert_pages(pages: list[str], fingerprint: str, extraction_method: str = "text_input", currency_override: str | None = None) -> dict:
    if not pages or len(pages) > MAX_PAGES or sum(map(len, pages)) > MAX_CHARACTERS:
        raise ConversionError("Document is empty or exceeds the local extraction resource limits.")
    institution, account, period, currency, issues = extract_metadata(pages, currency_override)
    balances, balance_issues = extract_balances(pages, period, account, currency)
    issues.extend(balance_issues)
    document_id = "sha256:" + fingerprint
    transactions, excluded = [], []
    fields = None
    recognized = False
    candidate_count = 0
    for page, text in enumerate(pages, start=1):
        for row_number, raw_line in enumerate(text.splitlines(), start=1):
            line = raw_line.strip()
            if not line:
                continue
            new_fields = header_fields(raw_line)
            if new_fields:
                fields, recognized = new_fields, True
                continue
            if not DATE_AT_START.match(line):
                # Unsupported continuations or damaged dates must not disappear.
                if fields is None:
                    continue
                if re.fullmatch(r"[-_=+|\s]+", line) or re.fullmatch(r"Page\s+\d+(?:\s+of\s+\d+)?", line, re.I):
                    continue
                if re.match(r"^(?:Bank(?: Name)?|Institution|Account(?: Type| Number| No\.?)?|Card(?: Number| No\.?)?|Currency|Statement Period|Period|Opening Balance|Closing Balance)\s*:", line, re.I):
                    continue
                candidate_count += 1
                excluded.append({"sourceLocation": {"page": page, "row": row_number},
                                 "reason": "unsupported_table_content", "code": "unsupported_table_content"})
                continue
            candidate_count += 1
            location = {"page": page, "row": row_number}
            reason = None
            if fields is None:
                reason = "unsupported_layout"
            elif currency is None:
                reason = "currency_unknown"
            else:
                try:
                    tx = parse_transaction(split_cells(raw_line), fields, currency, location, document_id)
                    transactions.append(tx)
                except ValueError as exc:
                    reason = str(exc)
            if reason:
                excluded.append({"sourceLocation": location, "reason": reason, "code": reason})
    if not recognized:
        issues.append(issue("unsupported_layout", "No supported transaction table header was found.", "error"))
    if not transactions:
        issues.append(issue("no_transactions", "No transaction rows were safely extracted.", "error"))
    if excluded:
        issues.append(issue("excluded_transaction_rows", "Candidate transaction rows require local review; do not treat this extraction as complete."))
    dates = [tx["transactionDate"] for tx in transactions]
    status = "failed" if not transactions else "partial" if excluded else "complete"
    if any(entry["code"] in ("invalid_balance", "balance_conflict") for entry in issues) and transactions:
        status = "partial"
    if status == "complete" and balances and balances["opening"] and balances["closing"] and balances["signConvention"] != "unknown":
        movement = sum(tx["amountMinor"] * (1 if tx["direction"] == "credit" else -1) for tx in transactions)
        if balances["signConvention"] == "positive_liability_balance":
            movement = -movement
        if balances["opening"]["amountMinor"] + movement != balances["closing"]["amountMinor"]:
            status = "partial"
            issues.append(issue("balance_mismatch", "Declared balances do not reconcile with extracted movements; review completeness and signs."))
    # OCR output always requires review even when the table appears complete.
    if extraction_method in ("local_ocr", "mixed"):
        status = "partial" if transactions else "failed"
        issues.append(issue("ocr_review_required", "OCR-derived amounts, dates and row completeness require review."))
    return {
        "format": "maniman.statement", "schemaVersion": "1.0",
        "source": {"documentId": document_id, "documentFingerprint": document_id,
                   "converter": "maniman-statement-converter", "converterVersion": VERSION,
                   "profile": PROFILE if recognized else "unknown", "extractionMethod": extraction_method,
                   "pageCount": len(pages), "synthetic": False},
        "institution": institution,
        "statements": [{"statementId": document_id + ":s1", "sourceKind": "card_statement" if account["kind"] == "credit_card" else "bank_statement", "account": account,
                        "period": period, "observedTransactionRange": {"start": min(dates) if dates else None, "end": max(dates) if dates else None},
                        "balances": balances,
                        "extraction": {"status": status, "transactionRowCount": candidate_count,
                                       "excludedRows": excluded, "issues": []},
                        "transactions": transactions}],
        "issues": issues,
    }


def read_pdf_pages(data: bytes, password: str | None, ocr: bool, max_pages: int) -> tuple[list[str], str]:
    try:
        import pdfplumber
    except ImportError:
        raise ConversionError("PDF support is not installed. Install requirements-converter.txt into a local virtual environment.") from None
    try:
        document = pdfplumber.open(io.BytesIO(data), password=password, unicode_norm="NFKC")
    except Exception:
        raise ConversionError("PDF could not be opened. Check the document and use --ask-password if it is protected.") from None
    pages, used_ocr, used_text = [], False, False
    try:
        if len(document.pages) > max_pages:
            raise ConversionError("PDF exceeds the configured page limit.")
        for page in document.pages:
            estimated_pixels = float(page.width) * float(page.height) * (200 / 72) ** 2
            if not math.isfinite(estimated_pixels) or estimated_pixels <= 0 or estimated_pixels > 40_000_000:
                raise ConversionError("PDF page exceeds the local rendering/layout pixel limit.")
            text = page.extract_text(layout=True) or ""
            large_scan = any(image.get("width", 0) * image.get("height", 0) >= page.width * page.height * 0.5 for image in page.images)
            if not text.strip() or (large_scan and len(text.strip()) < 200):
                if not ocr:
                    raise ConversionError("A PDF page has no extractable text. Use --ocr for local OCR, or review the scan locally.")
                executable = shutil.which("tesseract")
                if not executable:
                    raise ConversionError("Local OCR requires the tesseract executable; no remote fallback is available.")
                image = page.to_image(resolution=200).original
                if image.width * image.height > 40_000_000:
                    raise ConversionError("OCR image exceeds the pixel limit.")
                stream = io.BytesIO()
                image.save(stream, format="PNG")
                result = subprocess.run([executable, "stdin", "stdout", "--psm", "6"], input=stream.getvalue(),
                                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=45, check=False)
                if result.returncode:
                    raise ConversionError("Local OCR failed; review the document locally.")
                text = result.stdout.decode("utf-8", errors="replace")
                used_ocr = True
            else:
                used_text = True
            pages.append(text)
            if sum(map(len, pages)) > MAX_CHARACTERS:
                raise ConversionError("Extracted text exceeds the local resource limit.")
    except ConversionError:
        raise
    except Exception:
        raise ConversionError("Local extraction failed; review the document or extraction dependencies locally.") from None
    finally:
        document.close()
    return pages, "mixed" if used_ocr and used_text else "local_ocr" if used_ocr else "pdf_text"


def convert_file(path: Path, *, text_input: bool = False, password: str | None = None,
                 ocr: bool = False, currency: str | None = None, max_pages: int = MAX_PAGES) -> dict:
    if path.is_symlink() or not path.is_file():
        raise ConversionError("Input must be a regular local file, not a symbolic link.")
    if path.stat().st_size > MAX_BYTES:
        raise ConversionError("Input exceeds the 25 MiB limit.")
    with path.open("rb") as handle:
        data = handle.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ConversionError("Input exceeds the 25 MiB limit.")
    fingerprint = hashlib.sha256(data).hexdigest()
    if text_input:
        try:
            pages = data.decode("utf-8-sig").split("\f")
        except UnicodeError:
            raise ConversionError("Text input must be UTF-8.") from None
        if len(pages) > max_pages:
            raise ConversionError("Text input exceeds the configured page limit.")
        method = "text_input"
    else:
        if not data.startswith(b"%PDF-"):
            raise ConversionError("Input is not a PDF. Use --text-input only for local extracted-text fixtures.")
        pages, method = read_pdf_pages(data, password, ocr, max_pages)
    return convert_pages(pages, fingerprint, method, currency)


def write_json(path: Path, payload: dict) -> None:
    """Exclusive creation protects existing data and avoids following symlinks."""
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(path, flags, 0o600)
    except FileExistsError:
        raise ConversionError("Output already exists. Choose a new output filename; no file was overwritten.") from None
    except OSError:
        raise ConversionError("Output could not be created. Check the local destination directory.") from None
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
    except Exception:
        # Keep the message free of filenames, values and parser internals.
        raise ConversionError("Output could not be written completely; inspect the destination locally.") from None


def main(argv: list[str] | None = None) -> int:
    parser = SafeArgumentParser(description="Convert local statement PDF tables to Maniman JSON. No network or model calls.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", "-o", type=Path, required=True)
    parser.add_argument("--text-input", action="store_true", help="Read locally extracted UTF-8 text; intended for fixtures and supported text layouts.")
    parser.add_argument("--ask-password", action="store_true", help="Prompt locally without echo; password is never exported.")
    parser.add_argument("--ocr", action="store_true", help="Use local tesseract for pages without extractable text; output requires review.")
    parser.add_argument("--currency", choices=sorted(CURRENCY_DIGITS), help="Explicit currency if absent from the statement header.")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES)
    args = parser.parse_args(argv)
    if not 1 <= args.max_pages <= MAX_PAGES:
        parser.error("--max-pages must be between 1 and 200")
    try:
        if args.output.exists() or args.output.is_symlink():
            raise ConversionError("Output already exists. Choose a new output filename; no file was overwritten.")
        if args.ask_password and not sys.stdin.isatty():
            raise ConversionError("Password entry requires an interactive terminal; passwords are never read from echoed input or arguments.")
        password = getpass.getpass("PDF password (local session only): ") if args.ask_password else None
        payload = convert_file(args.input, text_input=args.text_input, password=password, ocr=args.ocr,
                               currency=args.currency, max_pages=args.max_pages)
        write_json(args.output, payload)
        status = payload["statements"][0]["extraction"]["status"]
        review = status != "complete" or any(entry["severity"] != "info" for entry in payload["issues"])
        print("Conversion written. Review required before import." if review else "Conversion written. Review the import preview before committing.", file=sys.stderr)
        return 2 if review else 0
    except (ConversionError, OSError) as exc:
        message = str(exc) if isinstance(exc, ConversionError) else "Local file could not be read. Check access permissions."
        print("Conversion failed: " + message, file=sys.stderr)
        return 1
    except (KeyboardInterrupt, EOFError):
        print("Conversion cancelled; no credentials were exported.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
