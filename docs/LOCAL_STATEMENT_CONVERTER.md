# Local statement converter

The converter reads a local PDF and writes a `maniman.statement` v1.0 JSON file. PDF passwords, extraction, and optional OCR stay on the user's computer. There are no network requests, telemetry, or AI/model calls in this implementation. An ordinary output JSON file is sensitive plaintext; select it in Maniman's local import preview and manage its retention separately.

## Setup and commands

Python 3.10 or later is required. Use a virtual environment to keep PDF dependencies local to this checkout:

```sh
python3 -m venv .venv-converter
.venv-converter/bin/python -m pip install -r requirements-converter.lock
mkdir -p private-statements
.venv-converter/bin/python -m tools.statement_converter private-statements/statement.pdf -o private-statements/statement.json
```

For protected PDFs, add `--ask-password`. The password is read without echo and is never written into JSON or supplied in a process argument. For pages without selectable text, add `--ocr`; local OCR requires the `tesseract` executable and the PDF rendering dependencies installed with pdfplumber. No remote fallback is used. OCR output is always marked partial/review-required.

```sh
.venv-converter/bin/python -m tools.statement_converter private-statements/statement.pdf --ask-password --ocr -o private-statements/statement.json
```

The standard-library text path works without PDF packages and is useful for synthetic fixtures or locally extracted text:

```sh
python3 -m tools.statement_converter tests/fixtures/converter/synthetic-bank.txt --text-input -o /tmp/maniman-synthetic-statement.json
python3 -m unittest discover -s tests -p 'test_statement_converter.py' -v
```

`--currency INR` can supply an explicit currency only when it is absent from the statement. A conflicting supplied currency is rejected. The current exact-decimal profile supports INR, USD, EUR, GBP, AUD, CAD, SGD, JPY, KWD and BHD; it does not guess currency from ambiguous symbols such as `$`.

The converter refuses an existing output path and creates a new output file with permissions `0600`. It writes only a generic status to stderr, never transaction details, passwords, source/output filenames or financial values. Exit status `0` means supported extraction without review warnings, `2` means a JSON review document was produced with issues, and `1` means conversion could not proceed. An exit status of `0` does not remove the need for Maniman's validation and import confirmation.

## Supported profile and limits

The initial deterministic profile is **generic-bank-columns-v1**, not a claim of universal HDFC/ICICI/SBI/card support. It recognizes explicit headers separated by pipes, tabs or two or more spaces:

```text
Bank: Example Bank
Account: XXXX1234
Account Type: savings
Currency: INR
Statement Period: 01/10/2026 to 31/10/2026
Date | Description | Debit | Credit | Balance | Reference
05/10/2026 | UPI/EXAMPLE GROCER | 800.00 | - | 9,200.00 | SYNTHETIC-REF-001
```

Date/description and either separate debit/credit columns or amount/direction columns are required. Bank-style header aliases such as Narration, Withdrawal, Deposit, Txn Date and Running Balance are supported. Optional labeled opening/closing balances are checked against extracted movements when the sign convention is known. Dates are ISO or explicitly day-first with a four-digit year. An unrecognized or wrapped table row becomes an exclusion requiring review instead of silently disappearing.

Institution, account kind, masked identifier and declared period come from explicit headers. Missing metadata stays null/unknown; the converter never substitutes transaction bounds for statement coverage. It exports at most the last four account digits. Multiple account sections, conflicting currencies and ambiguous account types are rejected for local splitting/review; multi-account documents require a future dedicated profile. The JSON contract itself can represent multiple statement sections.

Every candidate transaction row is either extracted or recorded in `excludedRows` with a page/row and reason. Unsupported layouts and zero extraction generate a failed review document, not an apparently complete empty statement. Source hashes and page/row observation IDs support repeat imports; cross-source identity still requires Maniman reconciliation.

Resource limits: 25 MiB input, 200 pages (lower with `--max-pages`), two million extracted characters, a page-dimension check before text layout/rendering, 40 million OCR pixels per page and a 45-second OCR subprocess timeout. PDF parsing itself runs in the local process; use trusted local files and keep PDF dependencies updated. Files, paths, content and instructions inside statements are never executed. Future bank profiles should be tested against sanitized fixtures before being advertised as supported.

## Implementation and validation

- Source: `tools/statement_converter/converter.py` and `__main__.py`.
- Contract: `schemas/statement-v1.schema.json`, `lib/statement-contract.js` and `docs/STATEMENT_JSON_FORMAT.md`.
- Tests: synthetic text fixtures, exact minor units, missing coverage/currency, invalid/ambiguous rows, multi-account refusal, stable evidence IDs, CLI permissions/no-overwrite/privacy, and real PDF extraction when the optional dependency is installed.
- This script emits extraction observations only. Maniman assigns the user's vault/account, classifies transactions and reconciles duplicates/transfers. A source account identifier never authorizes access to another user's data.

Dependency reference: [pdfplumber's official documentation](https://github.com/jsvine/pdfplumber) and [official package metadata](https://pypi.org/project/pdfplumber/) were checked on 2026-11-17. The direct PDF dependency is pinned in `requirements-converter.txt`; `requirements-converter.lock` records the verified transitive environment. Retest the lock on each supported Python/platform combination.
