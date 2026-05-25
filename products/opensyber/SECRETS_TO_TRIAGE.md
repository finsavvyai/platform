# SECRETS TO TRIAGE — opensyber migration

Round 4 migration copied the following dotfiles. They MUST be reviewed before any commit.

## Files copied that may contain real secrets

| Path | Notes |
|---|---|
| `products/opensyber/.env` | Root env |
| `products/opensyber/apps/web/.env.production` | Production env in repo — high risk |
| `products/opensyber/apps/web/.env.local` | Local env |
| `products/opensyber/apps/web/.env.development` | Dev env |
| `products/opensyber/apps/tokenforge-web/.env.local` | Sub-app local env |

## Action (caller / security agent)

See `products/sdlc-cc/SECRETS_TO_TRIAGE.md` for the full triage protocol. Same steps apply here.
