# Maniman

A mobile-first, local-friendly money manager inspired by the quick-entry flow of Rolly.

## User’s Guide

Open **User’s Guide** in the desktop sidebar or the mobile three-line App menu. Search its step-by-step instructions for setup, accounts, transactions, imports, reports, budgets, goals, bills, backups and recovery. An offline-readable copy is in [the User’s Guide](docs/USER_GUIDE.md). Guide content lives in `lib/user-guide.js`; regenerate the Markdown copy with `npm run docs:guide`.

## Run Locally

Run the local server from this folder (Node 22 or later):

```sh
node server.js
```

Then visit `http://127.0.0.1:4173`. If cloud is configured, sign in or explicitly choose local-only use first. For a new vault, create a vault passphrase, save the generated recovery key separately, and complete the recovery check. Subsequent sessions unlock the existing vault. Active tabs normally resume across reloads using a RAM-only key; browser restarts or worker reclamation require unlocking again. HTTPS or localhost and a browser with Web Crypto/IndexedDB are required.

The server binds to loopback by default. Non-loopback hosting requires `MANIMAN_LOCAL_TOKEN`; use HTTPS for browser encryption on other devices. Hosted phone/laptop access uses the same account and vault passphrase, with conservative encrypted sync. Owner RLS was checked read-only; live email delivery and physical two-device behavior still need release verification. See [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Local PDF conversion and statement JSON import

The first implementation increment adds a local converter, a versioned statement contract, a staged importer, and encrypted persistence. The converter currently supports a tested generic explicit-column bank layout; it does not yet claim support for every bank PDF.

```sh
python3 -m venv .venv-converter
.venv-converter/bin/python -m pip install -r requirements-converter.lock
mkdir -p private-statements
.venv-converter/bin/python -m tools.statement_converter private-statements/statement.pdf -o private-statements/statement.json
```

Use `--ask-password` for protected PDFs or `--ocr` for local OCR (requires local Tesseract). Unknown layouts and incomplete/OCR extraction produce a review document; correct the extraction locally before Maniman will commit it. No cloud conversion/model fallback is used.

In Maniman, select `Imports & review` and choose the statement JSON file. Review bank details, account mapping or creation, declared statement dates and every row's treatment. Confirm the review to save the batch into the encrypted vault. Reimports preserve source identity; import history supports undo without removing manually edited or independently supported transactions. The initial reporting path allows one currency per vault.

Statement files are read locally in the browser. Ordinary converter JSON remains sensitive plaintext outside the vault. Do not commit real statements or conversion outputs to Git; `private-statements/` is ignored for local working files. See the [converter guide](docs/LOCAL_STATEMENT_CONVERTER.md), [JSON format](docs/STATEMENT_JSON_FORMAT.md), and [vault guide](docs/SECURE_VAULT.md).

Run verification:

```sh
npm test
.venv-converter/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

## What It Does

- Quick text entry for expenses and income
- Payment accounts and asset accounts
- Configurable account categories
- Account-to-account transfers that update balances without inflating cashflow
- Monthly budget tracking
- Transaction trends and tag insights
- Bulk transaction upload through pasted text, CSV, bank-style CSV, or JSON
- Bank statement debit/credit parsing with optional balance checkpoints
- Trusted balance checkpoints for account reconciliation
- Transaction tags with keyword-based auto assignment
- Savings goals
- Recurring bill tracking with paid/unpaid status
- JSON import and export
- Encrypted IndexedDB persistence with session unlock and recovery-key support
- Optional encrypted local-server snapshot persistence

No cloud account is required for local use. The local server stores encrypted snapshots in `data/maniman.vault.json`. Previous plaintext state files remain untouched and are no longer served over HTTP. To migrate a legacy file, create/unlock the vault and explicitly import the existing JSON backup. Export and verify an encrypted backup before cleaning up legacy files or historical copies.

## Bulk Transaction Imports

Open `Imports & review` to import multiple entries at once. For ordinary text/CSV/transaction-list JSON, choose the default account first. Versioned statement JSON uses its separate bank/account/period review flow. Whole-vault backup restoration is distinct from statement import.

For bank statements with a running balance column, keep `Statement balance` set to `Use latest balance as checkpoint`. Maniman will import the transactions and save the latest statement balance as a trusted checkpoint for that account.

If you are importing older history into an account that already has today's balance, choose `Only import transactions`. Older entries will be added for reporting, but the current balance will stay anchored to the latest checkpoint.

### Plain Text Example

```text
coffee 120 cash yesterday
salary 85000 HDFC Savings 2026-06-01
transfer 5000 HDFC Savings to Cash 2026-06-03
```

### Standard CSV Example

Save this as a `.csv` file or paste it into the bulk upload box:

```csv
date,description,amount,type,account,toAccount,category,tags
2026-06-01,Salary,85000,income,HDFC Savings,,Salary,
2026-06-02,Coffee,-120,expense,HDFC Savings,,Food,food
2026-06-03,ATM withdrawal,5000,transfer,HDFC Savings,Cash,Transfer,cash
```

### Bank Statement CSV Example

Maniman can parse common bank-style columns such as `Txn Date`, `Narration`, `Debit`, `Credit`, and `Balance`:

```csv
Txn Date,Narration,Debit,Credit,Balance
09/06/2026,UPI COFFEE SHOP,120,,49880
10/06/2026,SALARY CREDIT,,85000,134880
11/06/2026,NEFT RENT,25000,,109880
```

Debit rows become expenses, credit rows become income, and the latest balance row can become a checkpoint. Dates in bank CSV uploads are treated as day/month/year when ambiguous.

### JSON Example

```json
{
  "transactions": [
    {
      "date": "2026-06-01",
      "description": "Salary",
      "amount": 85000,
      "type": "income",
      "account": "HDFC Savings",
      "category": "Salary",
      "tags": "salary"
    },
    {
      "date": "2026-06-02",
      "description": "Coffee",
      "amount": -120,
      "account": "HDFC Savings",
      "category": "Food",
      "tags": "food"
    }
  ]
}
```

Supported import fields include `date`, `transactionDate`, `txnDate`, `posted`, `description`, `narration`, `memo`, `amount`, `debit`, `credit`, `balance`, `type`, `account`, `accountId`, `toAccount`, `toAccountId`, `category`, `tags`, and `note`.

## Balance Checkpoints

Balances are now calculated from the latest trusted checkpoint when one exists:

```text
latest checkpoint balance + transactions after that checkpoint
```

This prevents older imported transactions from accidentally changing today's real balance. New accounts create a starting checkpoint from the opening balance and date. You can also add a manual checkpoint from `Accounts -> Balance checkpoint`.

## Cloudflare hosting

For the Workers build shown in the current deployment logs, use the [Cloudflare deployment guide](docs/CLOUDFLARE_DEPLOYMENT.md). `npm run build` packages only public assets into `dist` and generates browser config from `SUPABASE_URL` plus `SUPABASE_PUBLISHABLE_KEY` (or the existing `SUPABASE_ANON_KEY`). Wrangler runs that build before deploy/version upload.

Set the Cloudflare build command to `npm run build`, the production deploy command to `npm run deploy`, and the non-production version upload command to `npm run preview:upload`. Validate without uploading with `npm run deploy:check`. Deploy `dist`, never the full repository directory.

Cloud state is an encrypted vault envelope. The [vault guide](docs/SECURE_VAULT.md) describes recovery and owner boundaries. Hosted RLS/auth and two-device enrollment/conflict recovery still need live validation; this deployment fix does not change the database or merge private vaults. The older [interim cloud plan](docs/INTERIM_MOBILE_FIRST_CLOUD_PLAN.md) is historical and describes the superseded plaintext storage model.
