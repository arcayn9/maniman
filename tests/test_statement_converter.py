"""Synthetic local extraction, CLI privacy and data-loss regression checks."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.statement_converter.converter import (  # noqa: E402
    ConversionError, convert_file, convert_pages, parse_minor, write_json,
)

FIXTURE = ROOT / "tests/fixtures/converter/synthetic-bank.txt"


def synthetic_pdf(lines: list[str], password: str | None = None) -> bytes:
    """Generate a tiny test PDF, optionally with legacy R2 password protection.

    The weak RC4 format below is exclusively a parser regression fixture, never
    an encryption implementation for Maniman data. It reuses pdfminer's own
    standard-security padding and RC4 primitive when the PDF extra is installed.
    """
    def literal(value: str) -> bytes:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").encode("ascii")
    stream = b"BT /F1 8 Tf 40 760 Td 12 TL\n" + b"\n".join(b"(" + literal(line) + b") Tj T*" for line in lines) + b"\nET"
    encryption_object, trailer_extra = None, ""
    if password is not None:
        from pdfminer.arcfour import Arcfour
        from pdfminer.pdfdocument import PDFStandardSecurityHandler
        padding = PDFStandardSecurityHandler.PASSWORD_PADDING
        pad = lambda value: (value + padding)[:32]
        file_id = hashlib.sha256(b"maniman synthetic encrypted PDF fixture").digest()[:16]
        owner_key = hashlib.md5(pad(b"synthetic-owner-password")).digest()[:5]
        owner_entry = Arcfour(owner_key).encrypt(pad(password.encode("ascii")))
        key = hashlib.md5(pad(password.encode("ascii")) + owner_entry + struct.pack("<L", 0xFFFFFFFC) + file_id).digest()[:5]
        user_entry = Arcfour(key).encrypt(padding)
        stream_key = hashlib.md5(key + struct.pack("<L", 5)[:3] + struct.pack("<L", 0)[:2]).digest()[:10]
        stream = Arcfour(stream_key).encrypt(stream)
        encryption_object = (b"<< /Filter /Standard /V 1 /R 2 /Length 40 /O <" + owner_entry.hex().encode()
                             + b"> /U <" + user_entry.hex().encode() + b"> /P -4 >>")
        trailer_extra = f" /Encrypt 6 0 R /ID [<{file_id.hex()}> <{file_id.hex()}>]"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    if encryption_object is not None:
        objects.append(encryption_object)
    result = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(result))
        result.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    startxref = len(result)
    result.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode())
    result.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R{trailer_extra} >>\nstartxref\n{startxref}\n%%EOF\n".encode())
    return bytes(result)


class StatementConverterTests(unittest.TestCase):
    def fixture(self) -> str:
        return FIXTURE.read_text(encoding="utf-8")

    def convert(self, text: str | None = None) -> dict:
        text = self.fixture() if text is None else text
        return convert_pages([text], hashlib.sha256(text.encode()).hexdigest())

    def test_extracts_explicit_bank_account_period_and_exact_transactions(self):
        result = self.convert()
        statement = result["statements"][0]
        self.assertEqual(result["institution"]["name"], "Example Bank")
        self.assertEqual(statement["account"]["maskedIdentifier"], "XXXX1234")
        self.assertNotIn("999999991234", json.dumps(result))
        self.assertEqual(statement["period"]["start"], "2026-10-01")
        self.assertEqual(statement["period"]["end"], "2026-10-31")
        self.assertEqual(statement["observedTransactionRange"], {"start": "2026-10-05", "end": "2026-10-06"})
        self.assertEqual([tx["amountMinor"] for tx in statement["transactions"]], [80000, 2000000])
        self.assertEqual([tx["direction"] for tx in statement["transactions"]], ["debit", "credit"])
        self.assertEqual(statement["extraction"]["status"], "complete")

    def test_stable_evidence_ids_and_no_source_filename(self):
        first, second = self.convert(), self.convert()
        self.assertEqual(first, second)
        self.assertNotIn("filename", json.dumps(first).lower())
        self.assertTrue(first["source"]["documentFingerprint"].startswith("sha256:"))

    def test_never_infers_statement_coverage_from_transaction_bounds(self):
        result = self.convert(self.fixture().replace("Statement Period: 01/10/2026 to 31/10/2026\n", ""))
        statement = result["statements"][0]
        self.assertEqual(statement["period"]["status"], "unknown")
        self.assertIsNone(statement["period"]["start"])
        self.assertEqual(statement["observedTransactionRange"]["start"], "2026-10-05")

    def test_unknown_layout_and_zero_extraction_fail_closed(self):
        result = self.convert("Bank: Example Bank\nCurrency: INR\n05/10/2026 random single spaced data 12.34")
        extraction = result["statements"][0]["extraction"]
        self.assertEqual(extraction["status"], "failed")
        self.assertEqual(extraction["transactionRowCount"], 1)
        self.assertEqual(len(extraction["excludedRows"]), 1)
        self.assertIn("unsupported_layout", [entry["code"] for entry in result["issues"]])

    def test_ambiguous_and_invalid_rows_remain_accounted_for(self):
        text = self.fixture() + "32/10/2026 | INVALID DATE | 10.00 | - | 29,190.00 | TEST\n"
        text += "07/10/2026 | BOTH DIRECTIONS | 10.00 | 10.00 | 29,200.00 | TEST2\n"
        result = self.convert(text)
        extraction = result["statements"][0]["extraction"]
        self.assertEqual(extraction["status"], "partial")
        self.assertEqual(extraction["transactionRowCount"], 4)
        self.assertEqual(len(extraction["excludedRows"]), 2)
        self.assertEqual({entry["reason"] for entry in extraction["excludedRows"]}, {"invalid_date", "ambiguous_debit_credit"})

    def test_wrapped_or_damaged_table_content_never_silently_disappears(self):
        result = self.convert(self.fixture() + "unexpected wrapped narration\nO7/10/2026 | BROKEN OCR | 10.00 | - | 29,190.00 | TEST\n")
        extraction = result["statements"][0]["extraction"]
        self.assertEqual(extraction["status"], "partial")
        self.assertEqual(len(extraction["excludedRows"]), 2)

    def test_duplicate_header_fields_are_not_silently_reinterpreted(self):
        text = self.fixture().replace("Date | Description", "Date | Date | Description")
        self.assertEqual(self.convert(text)["statements"][0]["extraction"]["status"], "failed")

    def test_unknown_currency_does_not_default_to_inr(self):
        result = self.convert(self.fixture().replace("Currency: INR\n", ""))
        statement = result["statements"][0]
        self.assertIsNone(statement["account"]["currency"])
        self.assertEqual(statement["extraction"]["status"], "failed")
        self.assertEqual(len(statement["transactions"]), 0)

    def test_multiple_accounts_with_same_last_four_are_not_merged(self):
        with self.assertRaises(ConversionError):
            self.convert(self.fixture() + "Account: 888888881234\n")

    def test_balances_are_verified_without_rounding(self):
        result = self.convert(self.fixture().replace("\nDate |", "\nOpening Balance: 10,000.00\nClosing Balance: 29,200.00\nDate |"))
        statement = result["statements"][0]
        self.assertEqual(statement["balances"]["opening"]["amountMinor"], 1000000)
        self.assertEqual(statement["extraction"]["status"], "complete")
        failed = self.convert(self.fixture().replace("\nDate |", "\nOpening Balance: 10,000.00\nClosing Balance: 99,200.00\nDate |"))
        self.assertEqual(failed["statements"][0]["extraction"]["status"], "partial")
        self.assertIn("balance_mismatch", [entry["code"] for entry in failed["issues"]])

    def test_minor_units_are_exact_and_currency_aware(self):
        self.assertEqual(parse_minor("1,23,456.78", "INR"), 12345678)
        self.assertEqual(parse_minor("(120.50)", "INR"), -12050)
        self.assertEqual(parse_minor("123", "JPY"), 123)
        self.assertEqual(parse_minor("1.234", "KWD"), 1234)
        for value in ("1.234", "NaN", "1.2.3", "9,007,199,254,740,992", "1,23,45", "1₹23"):
            with self.assertRaises(ValueError):
                parse_minor(value, "INR")

    def test_ocr_output_always_requires_review(self):
        result = convert_pages([self.fixture()], "a" * 64, "local_ocr")
        self.assertEqual(result["statements"][0]["extraction"]["status"], "partial")
        self.assertIn("ocr_review_required", [entry["code"] for entry in result["issues"]])

    def test_cli_writes_private_file_and_refuses_overwrite_without_pii_logs(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "result.json"
            command = [sys.executable, "-m", "tools.statement_converter", str(FIXTURE), "--text-input", "-o", str(output)]
            first = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(first.stdout, "")
            self.assertNotIn("999999991234", first.stderr)
            self.assertNotIn(str(output), first.stderr)
            self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
            original = output.read_bytes()
            second = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(second.returncode, 1)
            self.assertEqual(output.read_bytes(), original)

    def test_failed_extraction_cli_returns_review_code_and_preserves_issues(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "unknown.txt"
            output = Path(directory) / "review.json"
            source.write_text("Unknown document with no table", encoding="utf-8")
            result = subprocess.run([sys.executable, "-m", "tools.statement_converter", str(source), "--text-input", "-o", str(output)], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(output.read_text())["statements"][0]["extraction"]["status"], "failed")

    def test_cli_argument_errors_never_echo_supplied_secrets(self):
        result = subprocess.run([sys.executable, "-m", "tools.statement_converter", str(FIXTURE), "--password", "synthetic-secret-do-not-echo"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("synthetic-secret-do-not-echo", result.stdout + result.stderr)

    def test_write_refuses_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "existing.json"
            target.write_text("unchanged")
            link = Path(directory) / "link.json"
            link.symlink_to(target)
            with self.assertRaises(ConversionError):
                write_json(link, self.convert())
            self.assertEqual(target.read_text(), "unchanged")

    @unittest.skipUnless(importlib.util.find_spec("pdfplumber"), "optional local PDF dependency not installed")
    def test_actual_pdf_extracts_supported_table(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.pdf"
            path.write_bytes(synthetic_pdf(self.fixture().splitlines()))
            result = convert_file(path)
            self.assertEqual(result["source"]["extractionMethod"], "pdf_text")
            self.assertEqual(len(result["statements"][0]["transactions"]), 2)
            self.assertEqual(result["institution"]["name"], "Example Bank")

    @unittest.skipUnless(importlib.util.find_spec("pdfplumber"), "optional local PDF dependency not installed")
    def test_actual_encrypted_pdf_requires_correct_password_and_never_exports_it(self):
        password = "synthetic-user-password"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic-encrypted.pdf"
            path.write_bytes(synthetic_pdf(self.fixture().splitlines(), password=password))
            for supplied_password in (None, "synthetic-wrong-password"):
                with self.subTest(password_state="missing" if supplied_password is None else "wrong"):
                    with self.assertRaises(ConversionError) as caught:
                        convert_file(path, password=supplied_password)
                    self.assertEqual(str(caught.exception), "PDF could not be opened. Check the document and use --ask-password if it is protected.")
                    self.assertNotIn(password, str(caught.exception))
            result = convert_file(path, password=password)
            self.assertEqual(result["source"]["extractionMethod"], "pdf_text")
            self.assertEqual(result["statements"][0]["extraction"]["status"], "complete")
            self.assertEqual(len(result["statements"][0]["transactions"]), 2)
            output = Path(directory) / "converted.json"
            write_json(output, result)
            self.assertNotIn(password, output.read_text(encoding="utf-8"))
            self.assertNotIn("synthetic-owner-password", output.read_text(encoding="utf-8"))

    @unittest.skipUnless(importlib.util.find_spec("pdfplumber") and importlib.util.find_spec("PIL") and shutil.which("tesseract"), "optional local OCR dependencies not installed")
    def test_actual_scanned_pdf_requires_local_ocr_and_review(self):
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new("RGB", (1700, 2200), "white")
        draw = ImageDraw.Draw(image)
        font = ImageFont.load_default(size=25)
        for index, line in enumerate(self.fixture().splitlines()):
            draw.text((60, 60 + index * 45), line, fill="black", font=font)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "scan.pdf"
            image.save(path, "PDF", resolution=150)
            with self.assertRaisesRegex(ConversionError, "--ocr"):
                convert_file(path)
            result = convert_file(path, ocr=True)
            self.assertEqual(result["source"]["extractionMethod"], "local_ocr")
            self.assertNotEqual(result["statements"][0]["extraction"]["status"], "complete")
            self.assertIn("ocr_review_required", [entry["code"] for entry in result["issues"]])


class StatementConverterResourceTests(unittest.TestCase):
    @unittest.skipUnless(importlib.util.find_spec("pdfplumber"), "optional PDF dependency not installed")
    def test_oversized_page_is_rejected_before_text_layout_or_rendering(self):
        data = synthetic_pdf(["Synthetic test"]).replace(b"/MediaBox [0 0 612 792]", b"/MediaBox [0 0 999999 999999]")
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "oversized.pdf"
            source.write_bytes(data)
            with self.assertRaisesRegex(ConversionError, "pixel limit"):
                convert_file(source)


if __name__ == "__main__":
    unittest.main()
