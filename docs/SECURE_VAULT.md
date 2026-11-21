# Encrypted vault implementation

The initial implementation stores financial state as an encrypted snapshot in IndexedDB. The local server accepts only encrypted envelopes, stores `data/maniman.vault.json`, and exposes only explicitly allowed app files. Service-worker caches contain the app shell, never state API responses, configuration or arbitrary documents. Existing plaintext files are preserved outside the served file set.

## Setup, unlock, export and recovery

Use HTTPS or localhost. Create a separate vault passphrase of at least 12 characters and save the recovery key independently of the encrypted backup. Setup verifies the recovery key before entering the app. Unlock is per session; an explicit Lock button and configurable inactivity timeout clear active access and reload the locked app. The Settings timeout is limited to 1–120 minutes and defaults to 15.

Export downloads a `maniman.vault` encrypted envelope. On an empty browser vault, use Restore on the setup screen, select the encrypted backup and unlock it with its passphrase or recovery key. Restoring over an existing vault is deliberately blocked until an explicit conflict-resolution flow is available; use a separate browser profile to recover another copy. Neither the database nor cloud login password resets can recover lost key material.

Legacy browser state can be migrated after local encryption setup and recovery verification. Legacy server JSON files are not automatically served; users can select their existing local backup through Import and confirm replacement. Imported legacy state is written into encrypted storage before the app switches to it. Retain previous files/backups until the new backup is verified. Migrating an active copy cannot remove plaintext from older backups or Git history.

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

Local storage is namespaced by local vault or authenticated user ID, with separate keys. Account switches lock the old session. Cloud updates require the expected server revision; local-server updates require the expected encrypted snapshot revision. Conflicts preserve local work and block automatic replacement. Initial cloud insert uses INSERT rather than an overwriting upsert. Automatic merging and a complete two-device enrollment/conflict UI remain follow-up work.

There is no live cloud-schema deployment in this increment. Mocked sync, owner-isolation and real local HTTP tests verify implementation behavior; production RLS/auth and phone/laptop interoperability require separate validation.

## Known limits for the first increment

The app still has one-currency reporting, legacy major-unit arithmetic and manually selected row treatment. Advanced reconciliation, reusable classification rules, recurrence/baseline analysis and card-influence reporting are subsequent milestones. PDF/OCR dependencies belong to the separate local converter; ordinary intermediate JSON is not encrypted and needs local retention controls. Browser visual verification depends on local computer-use permissions and is tracked in the implementation status.
