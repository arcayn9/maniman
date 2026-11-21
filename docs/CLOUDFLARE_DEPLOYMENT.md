# Deploy Maniman with Cloudflare Workers Static Assets

The reported build generated only `config.js`; Wrangler had neither a Worker entry point nor an asset directory. This checkout now uses an assets-only Worker configured in `wrangler.jsonc`. `server.js` remains the local server and is not deployed to Cloudflare.

## Build settings

Use the repository root as the Cloudflare build root. Keep the existing Worker name aligned with `name` in `wrangler.jsonc` (`maniman`). Wrangler is pinned to 4.166.0 in the lockfile, and existing Worker runtime variables are preserved.

| Setting | Command |
| --- | --- |
| Build command | `npm run build` |
| Production deploy command | `npm run deploy` |
| Non-production version upload | `npm run preview:upload` |
| Local non-uploading validation | `npm run deploy:check` |

`npm run deploy` uses `wrangler deploy`. `npm run preview:upload` uses `wrangler versions upload`, which creates a version without promoting it to production. Use the latter for the existing version-preview workflow, not as the final activation step.

The Wrangler custom build hook also runs `npm run build` before deploy/version upload. Consequently, retrying the previously configured `npx wrangler versions upload` can generate `dist` even while the old dashboard build command still only writes `config.js`. Replace that old command with `npm run build` for a clear single build entry point.

## Browser configuration

Set build-time variables in Cloudflare:

- `SUPABASE_URL`: the HTTPS project origin.
- `SUPABASE_PUBLISHABLE_KEY`: the public browser key; the existing `SUPABASE_ANON_KEY` variable also supports a legacy anon JWT.

The publishable variable takes precedence if both key variables exist. The build rejects incomplete pairs, invalid project URLs, secret keys and JWTs with roles other than `anon`. It serializes `dist/config.js` with JSON rather than interpolating values into shell-generated JavaScript, and does not read or modify the ignored local `config.js`. With neither variable configured it deliberately builds a local-only browser app.

Public browser keys are visible in the deployed asset. Owner-based database access policies remain necessary; never supply service-role or secret keys. This build fix does not change the Supabase schema, authentication or stored vaults.

## Uploaded files and runtime behavior

The build recreates `dist` from the local server's explicit public-file allowlist plus generated config and response headers. It includes the app, guide, manifest, icons and pinned SDK. It excludes repository data files, statements, local config, tests, tools and Node server code. Stale files in a previous `dist` are removed. **Upload `dist`, never the repository root.**

Unknown paths remain 404; there is no SPA fallback for `/api/state`. Hosted financial persistence uses the encrypted browser vault and optional configured Supabase sync, rather than the local Node state API. PDF conversion still runs locally.

## Verify before production activation

1. Install the locked dependencies with `npm ci`, then run `npm test` and `npm run deploy:check`.
2. Upload the feature-branch version and check the preview URL: app shell, vault unlock, guide and generated currency/navigation behavior.
3. Confirm `/data/maniman-state.json`, `/private-statements/`, `/server.js` and `/api/state` are unavailable. Preserve an encrypted backup before testing migration with real records.
4. After review and merge, use the production deploy command. Recheck the existing app origin and configured cloud login; live owner-isolation and multi-device recovery remain separate release checks.

Validated locally with Wrangler 4.166.0: version-upload dry-run passed; all 12 public app assets loaded in the local Cloudflare runtime; generated config/headers were correct; 11 non-public paths returned 404; the static host did not accept state API writes. The Node suite has 84 passing tests.

Sources: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/), [custom builds](https://developers.cloudflare.com/workers/wrangler/custom-builds/), [Workers build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [version uploads](https://developers.cloudflare.com/workers/wrangler/commands/workers/#versions-upload), [public Supabase keys](https://supabase.com/docs/guides/api/api-keys).


Account/vault repair validation: the updated artifact includes the account-access, vault-session and RAM broker scripts. All 15 public assets were served by the local Cloudflare runtime; 9 checked private/API paths remained unavailable and no writable state API was exposed. The updated suite has 107 Node tests and 20 Python converter tests. Dry-run builds intentionally used local-only configuration; production builds must retain the existing public Supabase build variables. No production upload or activation was performed for these checks.
