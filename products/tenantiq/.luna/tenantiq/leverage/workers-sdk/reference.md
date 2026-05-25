<!-- cspell:words tenantiq workerd wrangler miniflare workers-sdk pkg -->

# Cloudflare workers-sdk

- URL: https://github.com/cloudflare/workers-sdk
- Stars: **4 016** (gh api, fetched 2026-04-27)
- Forks: 1 223
- License: Apache-2.0
- Language: TypeScript
- Default branch: main
- Last push: 2026-04-27
- Topics: cli, cloudflare, cloudflare-workers, javascript, serverless, wasm
- README source: `workers-sdk/README.raw.md` (6 249 bytes)

## What it does

Per README header: "Home to Wrangler, the CLI for Cloudflare Workers." Monorepo of Cloudflare's Workers tooling.

## Packages listed (README "Directory")

| Package | Purpose |
|---|---|
| `wrangler` | CLI for building Cloudflare Workers |
| `create-cloudflare` (C3) | CLI for creating + deploying new Cloudflare apps |
| `miniflare` | Local simulator powered by `workerd` |
| `chrome-devtools-patches` | Cloudflare's fork of Chrome DevTools for local/remote Workers inspection |
| `pages-shared` | Shared internals between Wrangler + Cloudflare Pages |

## Relevance to tenantiq

- tenantiq API runs on Cloudflare Workers (CLAUDE.md "Commands" mentions `cd apps/api && npx wrangler deploy`).
- **Miniflare** is the established way to run unit/integration tests against Workers + D1 + KV. CLAUDE.md says "Mocking: use miniflare" for unit tests — confirms it is already on the testing radar.
- **`chrome-devtools-patches`** unlocks remote-Worker inspection. tenantiq has cron jobs + queues that are hard to debug; this is a debugging quality-of-life win.
- C3 templates are reference material for any future TenantIQ scaffolding (e.g., per-tenant edge worker for embedded reports).

## Not stated in README (verify before adopting)

- Whether `chrome-devtools-patches` works against production Workers or only local.
- Current miniflare D1 fidelity (some D1 features lag in miniflare; check release notes).
- Apache-2.0 license — derivative work permitted with NOTICE preservation.
