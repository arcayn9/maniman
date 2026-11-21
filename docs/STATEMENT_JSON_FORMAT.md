# Statement JSON format 1.0

The local converter and Maniman share [`schemas/statement-v1.schema.json`](../schemas/statement-v1.schema.json). The dependency-free [`lib/statement-contract.js`](../lib/statement-contract.js) adds semantic checks used by the browser and tests. This format imports observations; it does not replace a vault or restore a whole-app backup.

See the fully synthetic [example](examples/statement-import.example.json). Its missing document fingerprint intentionally produces a review warning. A real converter should supply a content fingerprint such as `sha256:<hex>`; no document password or full account/card number belongs in this file.

## Envelope and identity

- `format` must be `maniman.statement`; `schemaVersion` must be the string `1.0`. Other versions are rejected until an explicit migration exists.
- `source` records the original document ID/fingerprint, converter/profile versions, extraction method and source page count. Supported extraction methods are `pdf_text`, `local_ocr`, `ocr`, `mixed`, `text_input`, `manual`, `structured_data` and `unknown`.
- `institution` contains evidenced name/code/country, status and optional page/text evidence. Missing names/codes remain null and require review, rather than being inferred from an account filename or currency.
- `statements` contains one or more account sections. Each `statementId` is unique within the document. All transaction `observationId` values are also document-unique. These are source-local identities, not proof that transactions in different documents are equal.
- `issues` records structured `{code, message, severity?, path?}` diagnostics. `severity` is `info`, `warning` or `error`. Message content is untrusted text and must be rendered as text, never executed or interpreted as markup.

Institution and period statuses are `extracted`, `unknown` or `user_confirmed`. Converter confidence or a `user_confirmed` string supplied by a file does not bypass Maniman's own validation and preview.

## Account section

`sourceKind` is `bank_statement`, `card_statement`, `wallet_statement`, `payment_app_statement`, `other` or `unknown`. Account metadata contains:

| Field | Meaning |
| --- | --- |
| `kind` | Nonempty descriptive kind, e.g. `savings`, `current`, `checking`, `credit_card`, `wallet`, `cash`, or null/`unknown` when unrecognized |
| `maskedIdentifier` | Masked statement account/card identifier or null; last-four digits alone are not sufficient to resolve an account |
| `currency` | Uppercase supported ISO currency code, or null when extraction could not establish it |
| `period` | Declared start/end dates, status and source evidence; missing boundaries require review |
| `observedTransactionRange` | Optional earliest/latest extracted transaction dates, validated against observations; never used to certify full-period coverage |

The importer matches only against the active user's vault. Imported account/owner IDs cannot grant access or choose another user's records. When matching is ambiguous, the app requests account selection or creation. The converter never needs a vault key or a Maniman account ID.

## Transaction observations and money

Each observation requires `observationId`, `transactionDate`, `description`, `direction`, `amountMinor`, `currency`, `references`, `sourceLocation` and `issues`. Optional fields include `sourceTransactionId`, `postingDate`, `valueDate`, `runningBalanceMinor` and extraction `hints`.

Dates are real Gregorian calendar dates formatted `YYYY-MM-DD`; invalid dates are rejected, never replaced with today. Unknown posting/value dates use null. `direction` is `debit` or `credit` relative to the statement account, not a final expense/income classification. Card settlements, refunds, transfers and investment movements still need reconciliation and economic treatment.

`amountMinor` is a positive safe integer. For INR, ₹800.00 is `80000`; JPY uses zero decimal places and KWD uses three. Currency exponents come from `Intl.NumberFormat`; supported currencies are checked against `Intl.supportedValuesOf('currency')` where available, with a conservative fallback on older runtimes. The app must not assume every currency has two decimals or combine currencies without a conversion policy. Each posting's currency matches its statement account; original foreign purchase details should be preserved separately rather than changing ledger units.

References are arrays of `{type, value}` with string values, preserving leading zeros. `hints` may contain nullable `paymentRail`, `transactionApp` and `counterparty`; they are suggestions, not verified assignments. `sourceLocation` contains a positive page number and an optional positive row number, bounded by the source document's page count. Evidence objects may additionally contain text.

## Row accounting and incomplete extraction

Each section has `extraction` with `status` (`complete`, `partial` or `failed`), `transactionRowCount`, `excludedRows` and `issues`.

`transactionRowCount = transactions.length + excludedRows.length`

The count concerns candidate transaction rows, not headers, footers or blank lines. An excluded row requires a human-readable `reason`; retain a `sourceLocation` when available. A section with excluded candidate transactions cannot declare itself complete. Missing extraction metadata, malformed rows and inconsistent counts are validation errors.

A failed extraction can still be a structurally valid review envelope with no transactions, unknown account currency and explicit exclusions. Maniman must not commit such a document merely because schema validation succeeds. Incomplete extraction, source error-severity issues and unknown account/coverage details require resolution under the app's review policy.

## Balance conventions

Opening and closing balances, when supplied, contain a date, signed integer `amountMinor` and `position` (`start` or `end`). `signConvention` is:

| Convention | Movement arithmetic |
| --- | --- |
| `positive_asset_balance` | Credit adds; debit subtracts |
| `signed_balance` | Credit adds; debit subtracts; liability may already be represented as negative |
| `positive_liability_balance` | Debit adds to amount owed; credit reduces it |
| `unknown` | No automatic arithmetic certification |

Opening-plus-movements must equal closing when the extraction is complete, no transaction rows were excluded, balances align with known statement boundaries, all effective posting/transaction dates fall within those boundaries, and sign semantics are known. A mismatch is an error. Incomplete or differently bounded evidence produces a review warning rather than a false certification. Arithmetic uses integer `BigInt` accumulation to avoid intermediate floating-point overflow.

## Validation API and limits

Load the library as a normal browser script (`globalThis.ManimanStatement`) or `require('../lib/statement-contract.js')` in Node. It exports:

```js
isStatementDocument(value); // format discriminator, not a full validator
validateStatementDocument(value); // {valid, errors: [{path, code, message}], warnings: [...]}
currencyExponent('INR'); // 2; throws RangeError for unsupported/invalid codes
```

Validation does not mutate the document and does not use network services, a generative model or executable content from the file. Structural validity is separate from permission to commit: the importer must apply its review, ownership, currency and encrypted-storage requirements. Diagnostics can contain source-provided text; escape it in UI output.

The envelope is limited to 1,000 sections, 10,000 source pages and 100,000 total transaction observations. Strings and diagnostic lists have additional bounds. The file-selection/import layer must enforce its own byte limits before parsing; schema validation is not a substitute for input resource limits. Unknown root fields are rejected to avoid confusing statement documents with application backups. Nested extensions must not bypass known-field validation.

Tests: `node --test tests/statement-contract.test.js`.
