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
- Bulk transaction upload through pasted text, CSV, or JSON
- Transaction tags with keyword-based auto assignment
- Savings goals
- Recurring bill tracking with paid/unpaid status
- JSON import and export
- Browser `localStorage` persistence when opened statically
- Shared local JSON persistence when run through `server.js`

No cloud account is required for local use. The local server stores data in `data/maniman-state.json`.

## Interim Cloud Mode

Maniman can also run as an installable PWA with optional Supabase cloud sync for the period before a spare local server is available.

1. Create a Supabase project.
2. Run the SQL from `docs/INTERIM_MOBILE_FIRST_CLOUD_PLAN.md`.
3. Add the public Supabase URL and anon key to `config.js`.
4. Host the folder with Cloudflare Pages or any static host.
5. Open Settings, create/sign into an account, and sync.

The Supabase anon key is safe to use in the browser only when Row Level Security is enabled. Do not put service-role keys in `config.js`.

When using `server.js`, the local server stores new data in `data/maniman-state.json` and can still read the old `data/pocket-pilot-state.json` if it exists.
