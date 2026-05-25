<!-- cspell:words tenantiq workerd miniflare wrangler -->

# Gap Analysis — workers-sdk vs tenantiq

## What workers-sdk offers that tenantiq doesn't currently use

| workers-sdk asset | tenantiq state | Gap |
|---|---|---|
| **Miniflare** for Workers-runtime tests | `apps/api/vitest.config.ts:6` says `environment: 'node'`. CLAUDE.md *claims* miniflare is used; actually it isn't. | **open + bluff in CLAUDE.md** — fix doc + adopt `@cloudflare/vitest-pool-workers` |
| `@cloudflare/vitest-pool-workers` | not in `apps/api/package.json` deps (verified by absence in `grep miniflare`) | **open** |
| `chrome-devtools-patches` for remote Worker inspection | tenantiq runs cron + queue handlers on Workers; no DevTools attached | open (debug quality-of-life) |
| `create-cloudflare` (C3) templates | tenantiq is post-bootstrap; reference for any future per-tenant edge worker | informational |
| Apache-2.0 license | n/a | green-light |

## What tenantiq has that workers-sdk doesn't

- Application-level concerns (M365, AI, billing) — out of scope for SDK.

## Verdict

workers-sdk is **infrastructure**, not a competitor. Single highest-value adoption: replace the `node`-environment vitest with `@cloudflare/vitest-pool-workers` so tests run against real Workers semantics (D1, KV, bindings, Durable Objects). This also fixes a documentation bluff (CLAUDE.md states miniflare is used; it isn't).
