# Maniman

A mobile-first, local-friendly money manager inspired by the quick-entry flow of Rolly.

## Run Locally

For one-device use, open `index.html` in a browser.

For phone plus laptop use, run the local server from this folder:

```sh
node server.js
```

Then visit `http://127.0.0.1:4173` on the laptop. The server prints LAN URLs you can open from your phone when both devices are on the same network.

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
- Browser `localStorage` persistence when opened statically
- Shared local JSON persistence when run through `server.js`

No cloud account is required for local use. The local server stores data in `data/maniman-state.json`.

## Bulk Transaction Imports

Open `Transactions -> Bulk upload` to import multiple entries at once. Choose the default account first, then paste text or upload a `.txt`, `.csv`, or `.json` file.

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

## Interim Cloud Mode

Maniman can also run as an installable PWA with optional Supabase cloud sync for the period before a spare local server is available.

1. Create a Supabase project.
2. Run the SQL from `docs/INTERIM_MOBILE_FIRST_CLOUD_PLAN.md`.
3. Add the public Supabase URL and anon key to `config.js`.
4. Host the folder with Cloudflare Pages or any static host.
5. Open Settings, create/sign into an account, and sync.

The Supabase anon key is safe to use in the browser only when Row Level Security is enabled. Do not put service-role keys in `config.js`.

When using `server.js`, the local server stores new data in `data/maniman-state.json` and can still read the old `data/pocket-pilot-state.json` if it exists.
