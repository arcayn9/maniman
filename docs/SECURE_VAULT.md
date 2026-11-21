# Encrypted vault implementation

The initial implementation stores financial state as an encrypted snapshot in IndexedDB. The local server accepts only encrypted envelopes, stores `data/maniman.vault.json`, and exposes only explicitly allowed app files. Service-worker caches contain the app shell, never state API responses, configuration or arbitrary documents. Existing plaintext files are preserved outside the served file set.

## Setup, unlock, export and recovery

Use HTTPS or localhost. Create a separate vault passphrase of at least 12 characters and save the recovery key independently of the encrypted backup. Setup verifies the recovery key before entering the app. On configured hosts, account sign-in or an explicit local-only choice precedes vault selection. Account passwords authenticate to Supabase; a vault passphrase or recovery key decrypts records locally. The same synced account vault uses the same vault secret on phone and laptop. Unlock is per session; an explicit Lock button and configurable inactivity timeout clear active access and reload the locked app. The Settings timeout is limited to 1–120 minutes and defaults to 15.

Export downloads a `maniman.vault` encrypted envelope. On an empty browser vault, use Restore on the setup screen, select the encrypted backup and unlock it with its passphrase or recovery key. Restoring over an existing vault is deliberately blocked until an explicit conflict-resolution flow is available; use a separate browser profile to recover another copy. Neither the database nor cloud login password resets can recover lost key material.

Legacy browser state can be migrated after local encryption setup and recovery verification. Legacy server JSON files are not automatically served; users can select their existing local backup through Import and confirm replacement. Imported legacy state is written into encrypted storage before the app switches to it. Retain previous files/backups until the new backup is verified. Migrating an active copy cannot remove plaintext from older backups or Git history.

## Reload convenience and browser storage

An unlocked tab can normally resume after an ordinary reload. The service worker holds a **nonextractable CryptoKey in RAM only** under a random 256-bit per-tab capability, vault identity and owner namespace. The capability is stored in sessionStorage; it grants temporary access while the matching worker grant exists and is not a decryption key. It must still be treated as sensitive session material. No passphrase, recovery key, raw key or CryptoKey is written to browser storage/cache for resume.

Activity renews a bounded 1–120 minute lease; heartbeat messages do not extend inactivity. Explicit lock, sign-out and account changes forget/revoke the grant. The worker accepts only same-origin in-scope window messages. Browser reclamation, restarts, suspension or unsupported APIs can remove RAM state at any time: resume fails closed to the normal passphrase/recovery dialog. This is best-effort convenience, not a persistent device unlock. Encrypted IndexedDB is a durable working copy distinct from the app-shell cache, but browser storage can still be removed or evicted. Maintain independent encrypted backups and verify cloud status before relying on another device.

Supabase authentication tokens remain persisted by its SDK to restore account sign-in. They do not decrypt the vault. Clearing a stale account session does not clear encrypted financial data.

## Envelope and local storage

`lib/secure-storage.js` uses platform Web Crypto:

- Random 256-bit data key and AES-256-GCM with new 96-bit IVs for every encryption.
- PBKDF2-HMAC-SHA-256, 600,000 iterations and a random 128-bit salt to derive the passphrase wrapping key.
- A separate random 256-bit recovery key wrapping the same data key.
- Authenticated context binding for vault identity, key purpose and snapshot revision.
- A strict versioned envelope; unwrapped keys stay in session memory and are not stored beside ciphertext.

The passphrase is not sent to the server. The initial snapshot limit is 32 MiB of serialized state; larger-history handling needs measured record-level storage/sync work. IndexedDB compare-and-set prevents a stale tab overwriting another tab's encrypted snapshot. Lifecycle operations are serialized and owner/session changes invalidate in-flight work.

Reference material checked during implementation: [Web Crypto authenticated encryption/key wrapping](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/wrapKey) and [OWASP PBKDF2 guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Browser code running in an unlocked session can access decrypted state; this design protects persistence and sync contents, not a compromised unlocked device.

## Sync and owner boundaries

The existing optional Supabase path stores the encrypted envelope in `app_states.state`. Auth identity and sync metadata remain visible to the service. The SDK is pinned at 2.119.0, bundled under `vendor/`, and served from the app origin. Owner-based database RLS remains mandatory and must be verified before a hosted release. No service-role key belongs in browser configuration.

Encrypted IndexedDB records are namespaced by local vault or authenticated user ID. A fresh device installs the existing cloud envelope and unlocks it using the same passphrase/recovery key. An explicit local-only adoption can copy its envelope into an empty account namespace, retaining the original. During legacy cloud migration the same local key can encrypt the cloud records atomically; this does not merge datasets. Account switches lock the old session. Cloud updates require the expected server revision; local-server updates require the expected encrypted snapshot revision. Conflicts preserve local work and block automatic replacement. Initial cloud insert uses INSERT rather than an overwriting upsert. A ciphertext fingerprint records the last acknowledged snapshot. Clean replicas can adopt a strictly newer same-vault cloud revision; dirty copies are never automatically replaced. A failed cloud read cannot be treated as confirmed absence on a fresh device. New/migrated cloud vaults are saved immediately, while acknowledged unchanged snapshots avoid redundant writes. Divergent legacy cloud records are preserved in an encrypted conflict envelope. Automatic merging and an overwrite-resolution UI remain follow-up work.

No cloud schema or auth-provider settings were changed. Read-only hosted checks on 2026-11-21 verified owner-based SELECT/INSERT/UPDATE policies and RLS on app_states. Auth logs showed rejected credentials, a stale refresh token and signup without a valid password; no SMTP error was established for those requests. Signup now validates passwords before calling the provider, confirmation resend supplies the app redirect, and feedback distinguishes acceptance from delivery. Mocked provider calls and synthetic two-device vault tests do not prove real email delivery or physical-device behavior; those remain release checks.

## Known limits for the first increment

The app still has one-currency reporting, legacy major-unit arithmetic and manually selected row treatment. Advanced reconciliation, reusable classification rules, recurrence/baseline analysis and card-influence reporting are subsequent milestones. PDF/OCR dependencies belong to the separate local converter; ordinary intermediate JSON is not encrypted and needs local retention controls. Browser visual verification depends on local computer-use permissions and is tracked in the implementation status.
