# SECRETS TO TRIAGE — sdlc-cc + opensyber migration

Round 4 migration copied the following dotfiles. They MUST be reviewed before any commit. Per portfolio convention "no secrets in committed files."

## Files copied that may contain real secrets

| Path | Source mode | Notes |
|---|---|---|
| `products/sdlc-cc/.dev-key` | `0600` | Looks like a key file. Empty (0 lines) at copy time, but file mode suggests it was once populated |
| `products/sdlc-cc/.env.dev` | `0600` | Dev env vars. 2 lines |
| `products/sdlc-cc/platform/.env` | check | Platform env |
| `products/sdlc-cc/platform/landing-page/.env.production` | check | Production env in repo — high risk |
| `products/sdlc-cc/platform/tests/.env` | check | Test env |
| `products/sdlc-cc/platform/docs/archive/.env.production` | check | Archived prod env — may be obsolete but should still be reviewed |
| `products/sdlc-cc/platform/docs/archive/.env.staging` | check | Archived staging env |

## Recommended action (caller / security agent)

1. Inspect each file. If any contains a real secret (token, password, key), **rotate the secret upstream** and replace the file with a `*.example` placeholder.
2. Add patterns to root `.gitignore` before any of these are staged:
   ```
   .env
   .env.dev
   .env.local
   .env.production
   .env.staging
   .dev-key
   *.pem
   *.key
   ```
3. Once triaged, delete this file (`SECRETS_TO_TRIAGE.md`).

This agent did not delete the files (data preservation principle), but did NOT make them safe to commit. Treat the monorepo as **not commit-ready** until this list is cleared.

See sibling `products/opensyber/SECRETS_TO_TRIAGE.md` for opensyber-specific entries.
