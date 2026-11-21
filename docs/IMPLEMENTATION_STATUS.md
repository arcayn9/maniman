# Implementation milestones

Started: 2026-11-17. Scope: implement the agreed generic, continuous tracker through reviewable increments. The detailed architecture remains in [the implementation plan](EXPENSE_ANALYSIS_IMPLEMENTATION_PLAN.md).

## Current increment: implemented for synthetic validation

| Workstream | Owner | Deliverable | Status |
| --- | --- | --- | --- |
| Contract | statement_contract worker | Versioned JSON Schema, browser/Node semantic validator, fixtures and tests | Implemented; automated checks pass |
| Local conversion | local_converter worker | Local PDF/text-to-JSON CLI, local OCR/password handling, explicit unsupported-layout handling and tests | Implemented for generic explicit-column profile; real bank layouts need separate fixtures |
| Import workflow | statement_import worker | Bank/account/period preview, explicit account mapping/creation, idempotent import, evidence and safe batch undo | Implemented; automated checks pass |
| Privacy and integration | primary worker + reviews | Encrypted IndexedDB vault and backups, recovery verification, owner/session guards, restricted server/cache behavior and integration checks | Implemented; browser/live-cloud gates remain open |

Statement commit/undo and subsequent ordinary app saves use encrypted persistence. No plaintext fallback is written. Initial parser support is determined by tested format profiles; unknown documents remain review documents rather than silently creating a complete ledger. Existing user data files were preserved; no live database migration or deployment was performed.

## Verification completed on 2026-11-17

| Check | Result |
| --- | --- |
| `node --test tests/*.test.js` | **58 passed**, including real localhost HTTP tests, owner-switch sync regressions, currency guards, contract/import, end-to-end converter → encrypted save → reload → undo, and recovery-form event tests |
| `.venv-converter/bin/python -m unittest discover -s tests -p 'test_*.py' -v` | **20 passed**, including actual synthetic text PDFs, password-protected PDF rejection/unlock, local OCR, exact decimal extraction, row accounting and pre-render resource limits |
| JavaScript syntax and `git diff --check` | Passed |
| Native browser visual/interaction check | Initial check was blocked by permissions; desktop and 375px synthetic rendering were inspected on 2026-11-21. Physical-device, vault visual and live-data release checks remain pending. |
| Live Supabase RLS/auth and phone/laptop interoperability | **Pending:** implementation uses mocked sync/owner tests; no live financial data or account changes were used |

The isolated `.venv-converter` is installed for local PDF tests. `requirements-converter.lock` records its versions; `package-lock.json` records the dependency-free Node test/server manifest. The Supabase browser SDK is pinned and bundled locally with its license and checksum.

## Finance Workspace UI — 2026-11-21

The user selected option 1, Finance Workspace (UI/UX Pro Max). The live app now has grouped blue navigation, summary-first overview, a responsive ledger, dedicated Imports & review screen and branded accessible vault dialogs. [DESIGN.md](../DESIGN.md) records the accepted system. Coverage shows confirmed statement periods only; baseline, priorities and card-influence remain roadmap features.

Current Node suite: **78/78 passed**. UI regression coverage adds imports routing/persistence, upload options and owner guards, confirmed coverage, ledger escaping and combined filtering. The isolated visual preview uses synthetic data and disables saving. Desktop and 375px rendering were inspected; physical-device, vault visual, live-cloud and financial-data validation remain release gates.

## Current limits and release gates

1. Converter support is the tested generic explicit-column layout, not universal HDFC/ICICI/SBI coverage. Multi-account PDFs need local splitting until a dedicated profile exists. OCR output is deliberately partial and must be corrected locally before app commitment; an interactive review tool/skill wrapper is follow-up work.
2. Reporting remains one currency per vault, with legacy major-unit arithmetic; currency relabeling after financial data exists is blocked. Full minor-unit domain/report migration remains future work.
3. Reconciliation currently supports source-identity reimports, explicit linking and user-selected transfers/treatment. Automatic reference/fuzzy reconciliation, refund economic types and richer classification rules remain M3–M4.
4. Encrypted backups, separate owner namespaces, conflict preservation and revision-checked writes are implemented. Full multi-device enrollment/merge UI and hosted operational validation remain M1; browser QA must complete before claiming a verified release.
5. User-defined priority rules, recurring-pattern detection, monthly baseline and card-influence dashboards remain M4–M6. The first personal three-month assessment should validate these later capabilities once implemented.

## Subsequent increments

1. Complete encrypted multi-device enrollment/sync and migration coverage, owner isolation and configurable account relationships (M1).
2. Extend reference-based cross-source reconciliation, transfers/refunds and continuous import evidence (M3).
3. Add user-defined purposes/priorities, reusable combination rules, exceptions and provenance (M4).
4. Add confirmed recurrence, monthly baseline, user-reviewed card influence and reproducible dashboards (M5–M6).
5. Broaden local conversion profiles and optional local-model/skill support; benchmark multi-year history and prepare independent-user launch checks (M7).

## Verification gates

- Converter output passes both the shared contract and app-side validation; every candidate row is accounted for.
- Missing bank/account/period and ambiguous identifiers never become invented values or silent account choices.
- Reimports and batch undo preserve evidence and do not collapse legitimate identical purchases.
- Local snapshots/backups are encrypted; wrong credentials and tampered ciphertext fail closed; no sensitive API response is cached.
- Existing manual/text/CSV workflows remain usable. Real source documents, JSON exports and credentials stay out of fixtures/source control.

## Run the current increment

```sh
npm start
```

Open `http://127.0.0.1:4173`, create/unlock the vault and complete recovery-key verification. Follow the [local converter guide](LOCAL_STATEMENT_CONVERTER.md) for the separate PDF step, then select statement JSON through Imports & review. The app runs only while its local server is running. The separate synthetic UI preview, when running, is on port 4174 and does not save changes.

## UI refinement — 2026-11-21

Typography now uses responsive card sizing and smaller, unbroken monetary values; mobile amounts occupy their own line. Exceptional value lengths use contained scrolling instead of ellipses or page overflow. The secondary mobile control is a labeled three-line menu. The shared logo is an M-shaped wallet outline with a clasp, used in the sidebar, mobile header, vault and installed-app icon.

Verification: 16 relevant workspace/vault/cache tests passed, JavaScript syntax and whitespace checks passed, SVG parsed successfully, and the preview serves the updated stylesheet. A fresh native screenshot check returned a blank blue image, so visual verification of this refinement remains pending user review.

Currency/action refinement: new vault and starter defaults are INR with ₹/Indian grouping. Existing currencies retain their denomination. Common action buttons use accessible local SVG icons with their original bindings; default-currency preservation and contextual icon labels have regression coverage. Full Node suite: 73 passed.

## User’s Guide and feature branch

Added 28 searchable, category-filtered walkthroughs under User’s Guide in desktop navigation and the mobile App menu. Instructions cover every implemented app view, local conversion, statement review/linking/undo, manual/direct imports, account checkpoints, reports, budget/goal/bill behavior, tags, vault recovery/backups, reset actions and optional cloud limitations. The same catalog generates `docs/USER_GUIDE.md`; tests enforce matching content. The guide is part of the allowlisted public/offline app shell, with no financial data or remote search calls.

Validation: 78 Node tests and 20 Python converter tests passed. Guide search, empty states, contextual navigation, restored route acceptance and public asset serving have dedicated coverage. Feature branch: `codex/finance-workspace-user-guide`. No merge or cloud deployment is part of this push; the requested deployment follows a confirmed merge to main and validation of the existing hosted configuration.
