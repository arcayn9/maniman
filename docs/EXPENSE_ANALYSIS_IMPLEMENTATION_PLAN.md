# Maniman expense analysis implementation plan

Created: 2026-11-16. Updated: 2026-11-17. Status: implementation started. See [implementation status](IMPLEMENTATION_STATUS.md) for completed work, checks and remaining milestones.

## Outcome and working assumptions

Extend the existing Maniman app into a general-purpose, continuous personal-finance tracker with a reconciled, explainable ledger, reusable classification rules, monthly expense baselines and dashboards. Start with the owner's personal use while designing data ownership, configuration and isolation for future independent users. Preserve quick entry, budgets, goals, balance checkpoints, mobile use and optional sync.

The original three-month assessment is an end-to-end validation scenario, not a product boundary, required onboarding input or retention window. No particular dates are required before implementation. Users can import any historical period, continue recording new transactions and choose calendar, custom or all-history report ranges in the app. Preserve all imported history regardless of the currently selected report range. Account coverage, transaction dates, recurrence evidence windows and report filters are separate concepts; incomplete periods must be identified in comparisons.

Account/card/wallet aliases, institutions, ownership, app funding relationships, currency, purposes and priorities are app-managed properties scoped to each user's vault. No personal account list is required to define or build the service. Indian banks, payment rails and INR examples are initial validation cases, not hardcoded user identities or exhaustive institution lists. Preserve currency on every record and avoid combining currencies without an explicit conversion policy. Statement collection is initially manual; continuous tracking means ongoing manual entry and repeat imports, not an implied promise of automatic bank access. Bank login automation and payments remain outside this plan.

Confirmed direction: support both independent local use and hosted phone/laptop use with encrypted sync; convert PDF statements into a versioned statement JSON format using a separate local script, optionally invoked through a skill; import that JSON into Maniman. Keep PDF/OCR extraction outside the initial app import path. Allow users to define priority meanings and defaults during use; keep AI and OCR processing local only. Existing structured-format imports can remain available. Encryption before real statement imports and explicit review of ambiguous matches remain recommended. These replace the older proposal's recommendation to postpone encryption and the previous direct-PDF-import plan.

## Existing application: retain and extend

Repository inspection, not a live deployment audit:

| Area | Existing implementation | Required extension |
| --- | --- | --- |
| Imports | Text/CSV/JSON, bank column aliases, debit/credit parsing, checkpoints | Separate local PDF-to-JSON converter; versioned statement-JSON import; metadata/account matching; staging, coverage, provenance, errors and rollback |
| Duplicate handling | Fingerprint of date, type, amount, accounts and description | Source identity and cross-source matching; avoid collapsing legitimate repeated purchases |
| Transfers | Explicit account-to-account transfers excluded from cashflow | Infer and review paired statement legs, card settlements, top-ups and withdrawals |
| Classification | Expense/income categories, tags and keyword assignment | Separate axes, purpose/priority defaults, combination rules and exceptions |
| Recurrence | Manually configured bills and paid-month state | Detection, variable amounts/dates, occurrence links, no duplicate bill entries |
| Reporting | Monthly categories, budgets, trends, tag totals and simple insights | Reconciled spending, baseline, priorities, card influence, saved/versioned findings |
| Persistence | Browser localStorage, local JSON server, optional Supabase JSON state and revisions | Encrypted database/cache/sync, key recovery, safe conflicts and migration |

Important code locations: `app.js` functions `normalizeState`, `normalizeTransactions`, `parseTransactionUpload`, `transactionFromObject`, `uniqueTransactions`, `transactionFingerprint`, `toggleBillPaid`, `accountBalance`, `getInsights`; plus `server.js`, `sw.js`, and `index.html`.

Current privacy gaps to address in the foundation milestone:

- Finance state is saved as plaintext in localStorage, the local JSON file, and the cloud payload. RLS policies are documented, but deployed policies have not been verified.
- `server.js` binds to all interfaces by default, provides an unauthenticated state API, and serves files under the repository root. Replace broad static serving with an allowlist; exclude data, dotfiles and repository files.
- `sw.js` can cache successful same-origin GET responses, including API responses. Restrict it to the app shell and remove legacy sensitive cache entries during migration.
- Both JSON state files are tracked in Git. Determine whether they contain personal or sample data before deciding on cleanup. Removing a tracked file does not remove historical copies; history rewriting requires a separate coordinated decision.
- Cloud conflict handling currently refreshes remote state without preserving the unsaved local version. Retain local work and present conflict resolution instead.
- State normalization reconstructs objects and drops unknown fields. Schema migrations must preserve new fields and stable IDs.

## 1. Manage accounts, relationships and coverage in the app

Build an account/source register where each user can add, edit, archive and relate their own bank accounts, cards, wallets, cash accounts and payment apps. Store stable IDs, editable aliases, institution, optional masked identifiers, ownership, account kind, currency, payment instruments and available balance checkpoints. HDFC, ICICI, SBI, Pluxee, PhonePe and GPay are examples and parser-fixture candidates, not a required account configuration. Distinguish payment apps, instruments and source documents from balance-bearing accounts.

Let users manage app-to-account funding relationships, card settlement accounts and ownership directly, including effective dates where relationships change. Suggest relationships from evidence only for confirmation. Archive rather than erase accounts with history; renaming or changing today's funding account must not rewrite historical postings. Shared/joint financial-account ownership is classification metadata, not authorization to share a Maniman vault with another user.

Derive coverage intervals from statement metadata in imported JSON, with user corrections and explicit unavailable/covered-elsewhere annotations. Evaluate coverage for the currently requested report period rather than a fixed three-month onboarding period. An app export is evidence about an underlying account, not automatically a separate account. Wallet balances and cash spending may require separate evidence or manual entries. Do not require full account/card numbers, PAN, Aadhaar or banking credentials for account setup; PDF passwords are session-only local-converter inputs and never appear in exported JSON.

Allow onboarding with an empty ledger: create an account manually or confirm an account suggested during import. Configuration can grow during use. Account details, aliases, relations and reporting dates are entered through the app, not requested by the developer as implementation prerequisites.

The import screen must show gaps explicitly. Complete bank coverage does not prove cash purchases are complete. No transactions found is different from no statement supplied.

## 2. Separate local conversion from application import

`PDF → local converter / optional skill → statement JSON → Maniman local file selection → validate → identify account/period → reconcile → review → commit → classify → analyze`

Two independently testable components share a versioned statement-JSON contract:

1. **Local converter:** a reusable CLI/script reads PDF files, detects institution/layout, unlocks password-protected documents locally, extracts text/tables or runs local OCR, and emits structured JSON with extraction evidence and issues. A skill may wrap the script to guide conversion/review; the script is the repeatable implementation. Optional local-model assistance does not become a dependency for supported deterministic layouts. It must report unknown/ambiguous fields rather than fabricate them.
2. **Maniman importer:** reads the JSON, validates its schema/semantics, identifies the institution/account and declared statement range, proposes account matches, normalizes observations, reconciles overlaps, and previews the import. Users can confirm an existing account or create a new one in the app. PDF parsing, passwords and OCR dependencies are not required in the initial PWA.

“Upload JSON” means select a local file that the browser processes on the trusted device. Do not POST plaintext JSON to the hosting service. After confirmation, persist the imported financial data through the encrypted-vault path; sync only ciphertext when enabled. Direct PDF import can be considered later as a wrapper over the same converter/contract, not a prerequisite for the initial app.

Every import batch records the source document identity, input JSON identity, account, declared statement period, converter/adapter version, date convention, extraction method, row counts and issues. Each source observation retains its original row or PDF page location, narration, amount/direction, currency, dates, reference IDs and extraction status. Converter confidence is evidence for review, not proof of correctness. Keep original PDFs outside the app by default; encrypted retention can be a separate user choice. JSON provenance must support review without embedding the whole PDF.

Support arbitrary historical, overlapping and out-of-order imports through the same pipeline. Future imports reconcile against retained history and manual entries, preserving manual overrides and existing evidence links. The active dashboard range must not filter which valid source rows are retained. Identify incomplete card/statement boundaries during matching without requiring users to choose a global tracking window.

The converter owns text-PDF layout adapters, repeated headers/wrapped narrations/multiple pages, card-specific sign conventions, password handling, and local OCR for scans. Unknown layouts use explicit mapping/review, optionally assisted by a local model. Maintain tested profiles and fail clearly for unsupported layouts; moving extraction outside the app does not remove its accuracy requirements. Keep extraction packages and model runtimes local and pinned.

Maniman's primary statement interface is versioned JSON. Preserve its existing text/CSV/JSON convenience imports with distinct format detection and normalization; spreadsheet and other adapters can later emit the same contract. Treat PDFs and JSON as untrusted input, limit sizes and validate before committing. JSON statement import must be distinguished from whole-app backup restore so importing a statement cannot replace the existing vault.

### Statement JSON contract and identification

Use the shared machine-readable schema and browser/Node semantic validator; the initial implementation accepts version 1.0 and rejects unsupported versions. The [statement JSON example](examples/statement-import.example.json) is synthetic and supported by the initial reviewed importer. Actual converter outputs and schema/import regression fixtures are verified separately.

| Group | Required information / behavior |
| --- | --- |
| Envelope and provenance | Format marker `maniman.statement`, schema version, converter/profile versions, document fingerprint, extraction method and page/row references. Document identity is distinct from a transaction reference. |
| Institution and account | Institution name/code when evidenced, source kind, account kind, currency and masked identifier when available. No PDF passwords, full customer identity or credentials. Support one or more account sections per document. |
| Statement period and balances | Explicit start/end dates with evidence/status, optional opening/closing balances with dates and sign convention. Keep observed earliest/latest transaction dates separate from declared coverage; transaction bounds alone do not prove full-period coverage. |
| Transaction observations | Stable source observation ID, source transaction/reference IDs when available, transaction/posting/value dates, description, debit/credit direction, integer minor-unit amount, currency, optional running balance, rail/app/counterparty hints and source location. Preserve source semantics; do not force every debit to be a consumption expense. |
| Extraction issues | Machine-readable issue codes, severity and affected fields/rows; explicit null/unknown fields and excluded-row reasons. An incomplete extraction cannot silently declare complete coverage. |

Maniman recognizes bank details and ranges from these fields rather than PDF filenames. Validate dates, amount scales, row references and available balance arithmetic independently. Scope account matching to the active vault and combine institution, account kind and identifiers; masked last-four digits alone are insufficient. If evidence does not uniquely identify an account, ask the user to select/create one in the import preview and remember the confirmed source mapping. Never allow an imported owner/account ID to grant access to another user's vault.

Missing or conflicting institution/period metadata stays visible for correction. Accepting a transaction's date does not certify the entire statement period. Prevent source rows from disappearing on regeneration; use document/profile provenance and strong references for idempotency, with reviewed reconciliation when layout/OCR changes alter row identities. Converter-assigned source observation IDs are scoped to the document and cannot establish cross-source equality on their own.

Exported JSON still contains sensitive financial data even if account identifiers are masked. Keep it local, exclude real conversion outputs/PDFs from source control and telemetry, and offer explicit retention/cleanup controls. An encrypted export format may be added, but an ordinary `.json` file must never be described as encrypted. The initial converter must not require access to the Maniman vault key.

Use integer minor units for money, preserve original currency, distinguish transaction/value/posting dates and source timezone. Never silently replace an invalid date with today or an unknown account with the first account. Invalid or ambiguous rows remain visible in staging. Counts must reconcile: accepted, linked, excluded-with-reason, and unresolved rows account for all extracted transaction rows.

Validate statement totals and balances where available, with explicit sign conventions for card liabilities. Preview all resulting transactions, links, checkpoints and rule effects before atomic commit. Reimporting must be idempotent, and undoing a batch must remove its observations and recompute affected links/checkpoints without deleting transactions supported by another batch or manual entry.

## 3. Reconcile observations into transactions

Separate **source observations** from **canonical transactions and account postings**. Several observations can describe one payment; a transfer has two account postings. Preserve all evidence and reversible link decisions.

Match in this order:

1. Exact file/row or trusted source transaction identity, scoped to source/account and checked for consistency.
2. Shared UTR/RRN/reference plus compatible account, currency, amount and direction.
3. Candidate scoring using account/instrument, amount, transaction/posting-date windows, normalized counterparty/VPA and narration.
4. Review ambiguous or conflicting candidates with the evidence and reasons shown side by side.

Dates and equal amounts alone are insufficient. Apply one-to-one constraints to simple matches; explicitly support partial refunds and one-to-many relationships for settlements/splits. Configure date windows per source and reference namespace. A source-format confidence score or a model's self-reported confidence does not authorize a merge. Calibrate automatic linking against reviewed fixtures; use review-only matching until its precision is demonstrated.

| Situation | Canonical result | Reporting effect |
| --- | --- | --- |
| ICICI UPI debit also in PhonePe/GPay | One payment, two observations; app metadata attached | Count expense once |
| HDFC debit and own ICICI credit | One transfer with two postings | No expense or income |
| Card purchase and later bank-to-card settlement | Purchase expense plus settlement transfer | Count purchase once; settlement affects cash timing |
| UPI transaction funded by credit card | One payment with UPI rail and credit funding | Include in card-funded analysis |
| Bank-to-owned-wallet top-up | Transfer; later wallet purchase is expense | Avoid counting both as spending |
| Cash withdrawal to tracked cash | Transfer to cash; later cash entry is expense | Mark unrecorded cash spending as a coverage gap |
| Refund or reversal | Linked credit/reversal against purchase | Preserve cash movements; adjust net spending under report policy |
| Bill split or loan repayment | Link to original shared expense/receivable | Separate recovery from earned income |
| Transfer fee or card interest | Separate expense posting | Count fee/interest once |
| Two similar same-day purchases | Separate unless stronger evidence links them | Avoid accidental undercounting |

Missing transfer legs, unmatched card settlements, installment conversion, failed/reversed payments, and cross-period matches stay visible. An unmatched leg can be marked a confirmed transfer with an outstanding counterpart; do not invent a statement observation.

Use separate views of **spending**, **cash movements**, **income** and **asset/liability movements**. Credits/debits are account directions, not economic purposes. Savings/investment transfers to owned assets, loan proceeds and principal repayments need appropriate treatment even when they retain the user's chosen purpose label. Allow configurable treatment where ownership or purpose is unclear.

## 4. Classification model and reusable rules

Keep independent fields; allow `unknown`, `not applicable` and explicit review states instead of forcing guesses.

| Axis | Model |
| --- | --- |
| Payment mode/rail | UPI, card, wallet, IMPS, NEFT, RTGS, cash, other/unknown |
| Funding instrument | Bank balance, debit card, credit card, wallet, cash; specific instrument ID |
| Account | Institution + distinct account/card ID, e.g. HDFC savings and HDFC credit card |
| App | PhonePe, GPay, bank app, other, unknown; attach only with evidence |
| Direction and treatment | Credit/debit per account posting; canonical expense/income/self-transfer/refund/etc. |
| Occurrence | Strict, date-recurring, loosely recurring; also one-time, irregular and unknown |
| Transaction couple | Ordered payer/payee entity IDs, readable label, normalized aliases/VPA; reversals linked separately |
| Purpose | Editable incoming/outgoing purpose dictionary; stable IDs |
| Priority | Non-negotiable, essential, good-to-have, luxury; unassigned/N/A |
| Notes | Separate short description and long description; preserve raw source narration |

The UI may display Debit Card and Credit Card as familiar modes, but stores card type separately so UPI-on-credit-card remains representable. Multiple accounts at one bank must not be merged into an institution-level balance.

Seed outgoing purposes exactly as requested: Bills, Groceries, Rent, Shopping, Services, Lending, Dues, Socialising, Travel, Sports, Health, Recreation, Gifting, Investment, Saving, Food. Seed incoming purposes: Cashback, Refund, Loan Repayment, Bill Split Return, Gifts, Favour, Loan, Withdrawal. Preserve existing categories such as Salary and Interest rather than replacing them. Adding, renaming, archiving and merging purposes must preserve history and references. Withdrawal usually represents a transfer when the cash belongs to the user; the label must not force income treatment.

Support single and bulk labeling, saved filters and a rule builder combining any classification fields using explicit AND/OR conditions, amounts/date ranges and counterparty matches. Example: `counterparty = landlord AND account = ICICI savings → Rent / non-negotiable`.

Resolve each assigned field independently in this order:

1. Explicit transaction override, including a deliberate clear/lock.
2. Enabled matching user rule, using visible user-controlled order. Provide a suggested order from specific combinations to broad rules; flag conflicting rules rather than silently inferring precedence.
3. Purpose default priority, after purpose resolution.
4. Suggested category/priority or unassigned review state.

Rules include ID/version, conditions, assigned fields, order, enabled state, effective dates and application scope. Show the winning rule/default and why for every field. Preview affected transactions before changing a rule or purpose default. Apply to future transactions by default, with an explicit option to update historical entries; preserve manual overrides. A purpose default can be inherited dynamically while saved reports retain their original classification/rule versions.

After a correction offer: this transaction only, matching existing transactions, future matches, or both. Support exceptions, pause/disable, never suggest this mapping, undo and an audit history. Do not turn one correction into a permanent rule silently. Unassigned purposes/priorities feed a one-time review queue; confirmed rules prevent repeated work.

Priority definitions and purpose defaults are configured during use, not required before setup. Provide editable descriptions for the four requested priorities, with no forced purpose-to-priority assumptions. Allow priorities to remain unassigned, and show that amount separately in reports until mapped. Users can change definitions/defaults later with a preview of affected entries; historical snapshots retain their original versions.

## 5. Detect recurrence and define the base month

Run recurrence detection after reconciliation, grouped by normalized counterparty/couple, direction, purpose, instrument and account. Counterparty alone is insufficient: frequent food purchases are not necessarily subscriptions.

Proposed initial criteria, configurable and validated with actual samples:

- Strict: stable nominal day and amount, with explicit month-end/holiday handling.
- Date-recurring: stable nominal day, variable amount, e.g. electricity.
- Loosely recurring: stable amount and date drift within a configurable window, initially ±3 days.
- Keep weekly, monthly, quarterly and annual cadence separate from recurrence type. Unobserved annual bills require manual entry; three months cannot establish annual seasonality.

Treat two observations as a suggestion and three as a stronger candidate, while still showing sample size, missing coverage and uncertainty. User confirmation creates a persistent recurring pattern, expected occurrence schedule and default classifications. Allow changed prices, end dates, skipped periods and explicit exceptions. Match imported/manual payments to occurrences instead of creating another payment when a bill is marked paid. Removing a recurring template must not delete confirmed historical payments.

The monthly base chart should explain:

`approved recurring commitments + expected essential variable spending + chosen sinking-fund provision for known irregular essentials`

Separate the non-negotiable floor, essential operating baseline and planned discretionary allowance. Each recurring item is counted once in its priority bucket. Use a median of complete covered months in a configurable evidence window as the initial variable-spend estimate; allow manual overrides and show actual sample size and coverage. Three months is an initial validation example, not a hardcoded requirement. A missing month is not a zero-spend month. Exclude confirmed one-offs, transfers and purchase refunds appropriately. An annual provision affects the budget baseline, not historical recorded expenses.

Show expected versus actual by purpose and priority, fixed versus variable, and gross versus net spending. Define refund handling explicitly: cashflow uses the credit's posting period; net purchase-spend analysis may attribute it to the original purchase period. Label that view and version revised reports. Loan and bill-split recoveries must not inflate earned income.

### Proposed reporting conventions for user review

These are application reporting defaults, not investment or tax advice. Store classification, balance movements and report inclusion separately so a purpose label never forces an incorrect total.

| Flow | Suggested default | Choice to expose |
| --- | --- | --- |
| Savings/investment contribution to an owned asset | Asset transfer; excluded from consumption spending; shown separately as a planned allocation | Include the planned allocation in a broader monthly funding target, while preserving the expense baseline |
| Investment redemption / savings withdrawal | Asset movement, not earned income; retain fees or identified gains separately | Require review when statements do not establish principal/gain components; do not infer the whole receipt is income |
| Shared expense paid by user | Show full payment in cashflow; personal share in personal spending; remaining share as a receivable | User supplies personal share; keep unknown shares unresolved, show pending recoveries and support partial returns |
| Refund / reversal | Link to the original purchase; cashflow follows actual posting dates; net-spend view adjusts the original purchase period | Show gross/net and cash-period/purchase-period views explicitly; retain unmatched credits in review |
| Lending / borrowing / repayments | Separate receivables/liabilities and principal from spending/earned income; identified interest/fees are separate | Include planned principal repayments in the monthly funding target without counting them twice as purchase expenses |

Example: paying ₹3,000 for a shared dinner with a ₹1,000 personal share means ₹3,000 cash out, ₹1,000 personal spending and ₹2,000 recoverable. A later ₹2,000 return settles that receivable; it does not create salary-like income or reduce the personal share again. A ₹10,000 savings contribution can similarly increase the monthly funding target by ₹10,000 without increasing consumption expenses. Implement these as documented, per-vault reporting preferences with overrides and traceable adjustments when evidence is incomplete; a personal reporting choice is not a prerequisite to building the service.

## 6. Review possible credit-card influence

Separate **card-funded spending** (observable) from **spending caused or increased by card access** (subjective). Cover direct card purchases and card-funded UPI/wallet spending where traceable; mark uncertain funding explicitly.

Use user review labels: unknown, would buy anyway, card increased amount, card enabled purchase, unsure. Record reasons and optionally the counterfactual amount the user would have spent using cash/debit.

For reviewed purchases:

`estimated extra spending = max(0, actual purchase amount − user-estimated cash/debit amount)`

Aggregate only reviewed estimates, cap against applicable net purchase amounts and handle refunds/reversals consistently. Report review coverage, unknowns and potential overlap. A high luxury/card share is a useful review prompt, not proof of causation. Card-only merchants, reward-driven purchases, installments and unusual amount/frequency can suggest candidates when supported by evidence; do not infer a behavioral diagnosis from narration alone.

Dashboard outputs: total card-funded spending, confirmed user-estimated extra spending, unreviewed candidate amount, purpose breakdown and trend of user-confirmed results. Keep fees/interest separate from subjective influence. Cash/debit comparisons are descriptive and must account for category mix and incomplete coverage. AI cannot establish the counterfactual.

## 7. AI boundaries and local-model support

No core feature requires a generative model. Arithmetic, exact/reference matching, rules, recurrence statistics, priorities chosen by users and dashboard metrics must work with AI disabled. Supported PDF layouts use deterministic local-converter profiles; scanned statements use local OCR in that converter. Maniman can import valid statement JSON without the converter or any model running on the importing device.

| Task | Baseline | Optional AI assistance |
| --- | --- | --- |
| Unknown statement layout, in local converter | Manual mapping and adapter | Suggest schema/columns from a small excerpt |
| Noisy merchant/counterparty | Normalization and confirmed aliases | Propose entity aliases |
| Purpose | User labels and rules | Suggest label and rationale |
| Ambiguous reconciliation | Scored candidate review | Explain similarities; no authority to merge |
| Recurrence | Date/amount/cadence analysis | Explain candidate patterns |
| Insights | Computed metrics and templates | Summarize verified metrics with transaction references |
| CC influence | User counterfactual review | Prioritize review prompts |

Implement an AI provider interface with disabled and local-only modes. Remote inference is excluded from the current scope, including remote OCR, document-conversion services and any provider feature that forwards requests to cloud models. Settings include the local provider/model, paired endpoint, capability test, timeout and a test-connection action. Restrict execution to loopback or an explicitly paired user-controlled machine; do not treat an arbitrary endpoint as local just because it exposes a compatible API. Validate all outputs against schemas, existing IDs and source evidence. Model output is an untrusted suggestion and must never execute SQL/code, make payments or silently modify money, links or labels. Treat statement text as untrusted content, not instructions.

Apfel documents a local OpenAI-compatible API, including structured output; verify the installed version and model capabilities during implementation. See its [API documentation](https://github.com/Arthur-Ficial/apfel/blob/main/docs/openai-api-compatibility.md). This supports a provider adapter, not a guarantee of extraction accuracy.

For local Maniman, prefer a same-origin, authenticated local bridge restricted to the configured model endpoint. For a hosted PWA, local Mac access requires a separately paired companion, origin restrictions and browser/network testing; the phone's localhost is the phone, not the Mac. Apfel's defaults restrict origins and need deliberate browser configuration; follow its [server security documentation](https://github.com/Arthur-Ficial/apfel/blob/main/docs/server-security.md). Do not ship an unauthenticated public model server. Queue optional AI tasks when the local model is unavailable; imports and manual review continue.

Send the minimum required fields to the local model. Disable prompt/response logging by default in Maniman and verify provider logging configuration. Exclude statement content, identifiers, descriptions and sensitive filenames from telemetry/crash logs. When the local host is unavailable, queue assistance or continue manually; never fall back to remote inference. Any later remote-AI support would require a new explicit product decision.

## 8. Database, encryption and sync architecture

Keep the vanilla frontend and PWA; extract the monolithic logic into small modules for domain/schema, JSON import/validation, reconciliation, classification/rules, recurrence, analytics, storage/crypto and provider adapters. Build the local PDF converter as a separate tool sharing the versioned statement contract and fixtures, with an optional skill wrapper. Keep its PDF/OCR dependencies outside the PWA. Add pinned dependency manifests/lockfiles and focused test runners. A framework rewrite is not a prerequisite.

Logical data collections:

- Accounts/instruments and counterparties/aliases.
- Import batches, coverage periods and source observations.
- Canonical transactions, postings and evidence/link relationships.
- Purposes, per-field assignments, rules, exceptions and audit events.
- Recurring patterns, expected occurrences and payment links.
- Baseline versions, CC reviews, analysis snapshots and insight records.

Recommended first storage milestone: an IndexedDB database containing versioned encrypted vault snapshots, with optional Supabase storage of the same encrypted payload. Transactions, rules and summaries are logical collections inside the vault. Preserve the existing `app_states` sync path initially through an explicit envelope/schema migration rather than creating a large relational backend first. Measure import size and latency; move to encrypted record-level storage only if snapshot costs justify that additional sync complexity.

### Continuous tracking and future independent users

Use an explicit owner/vault boundary from the foundation milestone: opaque vault IDs, owner-scoped repositories, account IDs distinct from user IDs, independent encryption keys and user-specific local caches, sync queues, preferences and companion pairings. Users must never inherit another user's accounts, rules, aliases or model context. Any shared parser profiles contain format logic only, without financial samples or personal mappings. Local-only vault ownership must work without a cloud identity; linking a vault to a signed-in account is explicit and verified.

The first personal release may retain one vault per user, but no singleton current-user assumptions or personal identifiers belong in domain logic. Test two independent user sessions and enforce owner isolation in storage/sync from M1. A future public release adds its own onboarding, deployment/operations, resource limits and multi-user readiness checks; it must not require replacing the transaction or classification model. Collaborative access to a shared vault is a separate capability, not implied by supporting multiple independent users.

Design for an accumulating ledger: incremental matching and derived-data invalidation, paginated transaction views, import jobs with bounded resource use, versioned schema migrations and explicit user-controlled export/deletion/retention. Recompute affected links, recurring patterns and report periods when late history or corrections arrive. Never expire transactions because an analysis window has elapsed. Benchmark multiple years of history in addition to the first validation dataset; use those results to decide when encrypted record-level persistence and incremental sync must replace full snapshots before release at larger scale.

Both local-only and hosted phone/laptop operation are required product modes. Select cloud sync explicitly per vault; local-only use must not need a cloud account or upload financial data. A hosted device must support offline work with later encrypted sync. Use the same vault schema and keys across modes, with a verified encrypted export/import or enrollment flow when moving between them. Prevent duplicate imports and independent silent forks during mode changes. The cloud still sees sign-in identity and necessary access/revision metadata; financial contents and sensitive filenames remain encrypted.

All reporting, matching, rules and optional AI run on an unlocked trusted device. The database stores ciphertext for transactions, source evidence, rules, notes, summaries and saved findings. Limit plaintext cloud metadata to ownership, opaque vault ID, revisions, encryption format and required sync timestamps. Database operators may still observe access/size metadata; encryption does not hide that.

Encryption design must use reviewed libraries/platform primitives: authenticated encryption, a random data key, unique nonces per encryption, versioned envelopes and authenticated context binding. Wrap the key using a separately managed vault passphrase and supported, reviewed key derivation; provide a recovery key and tested restore flow. Login credentials and OAuth sessions are not vault keys. Do not store an unwrapped key beside ciphertext. Begin with unlock-per-session and explicit recovery; trusted-device/passkey convenience is a later milestone requiring browser-specific validation.

Recommended initial setup flow: choose a vault passphrase separate from cloud login, unlock once per session, use configurable inactivity locking and offer an explicit lock action. Generate a recovery key at setup, ask the user to store it separately, and verify a recovery exercise before considering enrollment complete. Password-manager storage is an option, not a dependency. A cloud password reset cannot decrypt the vault. Losing both the passphrase and recovery material without any usable trusted access means data cannot be recovered. Biometrics/passkeys can later protect local unlock where supported, with the passphrase/recovery path retained. Do not promise uniform biometric behavior across phone/laptop browsers.

Retain Supabase Auth and owner-based RLS in addition to encryption. Verify grants and policies for SELECT/INSERT/UPDATE, including ownership checks on updates; new API tables may require explicit grants. See the [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). No live schema change is part of this plan.

Use atomic local commits, encrypted backup/export by default, explicit plaintext-export choice, and revision-checked cloud saves. Preserve an encrypted pending local snapshot on conflict; provide resolution before replacing it. Namespace vaults/caches by user, clear decrypted memory on lock/sign-out and test account switching. Local server access needs authentication and explicit network exposure, with encryption retained at rest. Remove broad third-party script execution where possible by pinning/self-hosting dependencies and adopting a restrictive content policy.

Migration sequence: back up existing state locally, transform with stable IDs, encrypt to a separate version, decrypt and compare counts/balances/categories/bills, test restore, then switch storage and retire plaintext caches/files. Explain legacy cloud backups and Git history separately: migrating the active copy cannot retract old copies. Do not remove existing user data before verified migration. An unlocked device or compromised application code can access decrypted data; E2EE primarily protects stored/synced content.

## 9. Review workflow and dashboard

Extend current navigation rather than adding an unrelated app:

1. **Accounts:** user-managed aliases, institutions, accounts/cards/wallets, ownership, effective-dated relationships, archiving and derived coverage.
2. **Import workspace:** statement JSON files, detected institution/account/period, validation/issues, account matching/creation, preview and rollback. PDF conversion is an external local step with clear instructions.
3. **Review inbox:** unresolved rows, duplicates/transfers, aliases, missing purpose/priority, recurrence suggestions and CC reviews.
4. **Transactions:** new filters/columns, source evidence, short/long notes, single/bulk editing and rule creation.
5. **Purposes and rules:** priorities, conditions, defaults, exceptions, impact preview and history.
6. **Bills/base month:** detected recurring patterns, confirmations, occurrence matching and baseline editor.
7. **Dashboard/insights:** user-selected calendar/custom/all-history periods, purpose/priority trends, floor versus baseline versus actual, recurring commitments, card influence and coverage/reconciliation status. Date selection changes analysis, not retained ledger history.

All chart totals must drill down to their transactions. Show unassigned amounts, missing coverage and unresolved matches so incomplete analyses are visible. Save structured insight facts, source transaction IDs, date range, coverage, data revision, rule version, metric version, generation time and optional model version. Recompute or mark stale after imports, corrections, rules or baseline changes; retain user-pinned historical snapshots. Avoid persisting only AI-written prose.

## 10. Delivery milestones and acceptance gates

| Milestone | Deliverables | Acceptance gate |
| --- | --- | --- |
| M0 — Product contracts and validation design | Generic account/relationship and owner/vault model; shared versioned statement JSON schema; converter/import boundary; synthetic fixtures; report contracts | No personal inventory/date prerequisite; converter output and app input share one testable contract; unknown institution/period behavior defined |
| M1 — Safe configurable foundation | Modular schema/migrations; in-app account/relationship management; owner-isolated encrypted storage/sync; recovery; server/cache fixes; preserve unsaved conflicts | Empty-ledger setup works; existing data round-trips; two users' vaults/keys/caches remain isolated; recovery works; no finance plaintext in persistence/API cache |
| M2 — Local converter and staged JSON imports | Separate local PDF-to-JSON script; required text/password/OCR profiles; Maniman schema validation and account/period detection; preview/errors; coverage; batch undo | PDF → JSON → app end-to-end fixtures pass; masked identity ambiguity reviewed; no plaintext server upload; all rows accounted for; repeated imports stable; available balances reconcile |
| M3 — Reconciliation | Observation ledger; counterparties; duplicate/transfer/refund links; review inbox | Cross-source payments count once, transfers net to zero, equal-looking legitimate purchases remain distinct |
| M4 — Classification | Requested dictionaries, independent axes, notes, bulk labels, rule engine and provenance | Combination rules/defaults apply predictably; overrides survive; future matches work; exceptions and undo work |
| M5 — Recurrence and baseline | Recurrence confirmation, occurrence links, bills integration, approved monthly baseline | Imported bill not duplicated; known baseline fixtures match expected results; incomplete months excluded |
| M6 — CC reviews and continuous insights | User counterfactual review, selectable report/evidence periods, dashboard extensions, saved structured findings | No unreviewed estimate presented as confirmed; every metric traces to ledger; successive imports/late edits update affected findings without losing history |
| M7 — Broader conversion and optional local AI | Additional converter PDF/OCR profiles, optional skill wrapper, saved layout mappings and local provider adapter | New converters produce compatible JSON without changing the core importer; AI-off workflow complete; invalid suggestions cannot change ledger; no remote processing |

JSON-first app import and separate local PDF conversion are required in M2. The generic fixture/source-format matrix determines initial converter profiles and whether local OCR must also ship in M2. Personal account details are not prerequisites; sanitized representative files can improve adapter validation as they become available. Direct PDF upload is no longer an initial app requirement. M7 broadens converter coverage and adds optional local-model/skill convenience without changing this boundary.

M1 precedes importing real statements. M2–M4 deliver the first useful release: user-configured accounts, repeatable historical/ongoing imports, reconciliation and reusable purpose/priority mappings. The owner's three-month assessment validates this workflow without defining its limits. M5–M6 deliver the analytical outcome across selectable periods and a growing ledger. M7 improves convenience and format breadth; required formats move earlier as discovered.

Earlier planning estimate for one developer: roughly **7–11 focused developer weeks** for M0–M6 and necessary source adapters, plus **2–4 weeks** for broader OCR/AI and difficult-format coverage. Re-estimate in M0 for the clarified configurable, continuous-tracking scope. Public multi-user launch work is not included in that earlier estimate. Sample quality, encrypted recovery/sync, growing-history performance and statement edge cases drive uncertainty; do not base scheduling on a generic “supports all banks” claim.

## 11. Verification and completion criteria

Use synthetic/redacted data in source control. Add separate converter extraction fixtures, JSON schema/semantic-validation cases and end-to-end PDF → JSON → app reference cases. Test multiple accounts per document, absent/conflicting bank/period fields, ambiguous masked identifiers, unsupported schema versions, incomplete OCR, observed-date/coverage separation, stable reimport after converter upgrades and statement-versus-backup format detection. Add golden ledger/report cases for duplicate imports, cross-app duplicates, bilateral transfers, out-of-period missing legs, partial refunds, split recoveries, card-funded UPI, settlements, fees, wallets, installments and reversals. Test leap/month-end dates, invalid dates, decimal/sign parsing, card liability balances and same-day checkpoint boundaries. Add recurrence negatives for frequently repeated discretionary purchases.

Test rule precedence per field, historical versus future application, locked overrides, purpose renames and exceptions. Test batch undo with evidence shared across batches. Verify migration rollback, recovery, tampered ciphertext, offline saves, cloud conflicts, cross-user isolation and absence of sensitive HTTP caching. Use a reviewed reference ledger to compare spending, cashflow, balances, priority totals, baseline and CC estimates independently of UI output. Include a 10,000-observation import/report benchmark to decide whether snapshot storage remains appropriate; use measured results to set budgets.

Add continuous-use cases: empty setup; accounts added and archived later; aliases renamed without changing identity; effective-dated funding relationships; manual entries matched to later imports; overlapping imports over many cycles; late refunds/history spanning years; and reporting-range changes that never delete/filter ingestion history. Verify two independent users with different settings/keys and a reused browser cannot observe each other's data. Include multi-year growing-history benchmarks and demonstrate that the three-month validation scenario uses the same user-facing flow as any other range.

The personal product release is complete when users can configure their own accounts/relationships, retain and extend transaction history through ongoing entry/import, analyze arbitrary periods with explicit coverage, reuse purpose/priority mappings, approve a monthly baseline and review subjective card influence. No ledger ambiguity is silently discarded, saved findings are reproducible from the encrypted ledger and independent owners remain isolated. The three-month assessment is one acceptance scenario. A future public multi-user launch requires separate release-readiness criteria.

## Product decisions and runtime configuration

1. **Generic continuous tracker — confirmed.** The service retains and tracks transaction history over time. Three months is a personal validation scenario; report dates and account inventory are app properties, not unresolved implementation inputs. No specific date window or account list is requested from the user before building.
2. **User-managed configuration — required.** Users add/edit/archive their accounts/cards/wallets, aliases and relationships; configure purposes, priority meanings/defaults and reporting preferences; and choose analysis periods in the app. Treat example institutions and starter categories as configurable examples/templates. Pairing a local model host is likewise a runtime setup action.
3. **Formats, modes and privacy — confirmed.** Separate local PDF-to-JSON script/optional skill, JSON-first statement import with bank/account/period detection, existing structured-format alternatives, both local-only and hosted encrypted-sync operation, and local-only AI/OCR/document parsing. Raw PDFs/passwords stay with the local converter; ordinary JSON outputs remain sensitive local files. Use sanitized/synthetic fixtures and do not expose PII.
4. **Unlock/recovery and reporting defaults — recommendations to implement as product flows.** Start with a separate vault passphrase, session unlock, configurable auto-lock and a separately saved, verified recovery key. Expose documented spending/cashflow/asset/shared-expense/refund policies as per-vault settings, with safe defaults and visible incomplete mappings. Personal choices can be made during use.
5. **Future independent users — architecture requirement.** Build owner/vault isolation and per-user configuration now; validate the first release through personal use. Public launch, collaborative vault sharing and automatic bank ingestion are separate future scopes, not implied by generic multi-user-ready domain design.

Current deliverables: the planning document and the initial local-converter/statement-import/encrypted-storage implementation increment. The full roadmap is not complete; progress and verification are recorded in [implementation status](IMPLEMENTATION_STATUS.md).
