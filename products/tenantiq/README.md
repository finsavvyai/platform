# TenantIQ

**AI governance and remediation for Microsoft 365.**

TenantIQ is the M365 governance product in the FinsavvyAI portfolio. It
gives MSPs and enterprise security leads an operational plane for
managing other people's Azure AD tenants — the part horizontal AI
assistants (Claude-in-M365, Copilot) can't do at MSP scale.

> Status: **in migration**. This directory was populated by round 4 of
> the FinsavvyAI monorepo consolidation from the `tenantiq` and
> `tenantiq.frontend` source repos. Build wiring with the platform
> packages (`@finsavvyai/auth`, `telemetry`, `shared-types`) is not yet
> complete — see `MIGRATION_NOTES.md`.

## Why TenantIQ exists

- M365 OAuth grants and admin consent are the new attack surface for AI
  agents; visibility into them is fragmented.
- Remediation today is "open ticket, copy-paste, hope" — MSPs need a
  plan-then-apply workflow that produces a reviewable diff.
- Blast-radius analysis (which users, which scopes, which data is
  affected by a proposed change) is the missing primitive in every
  comparable tool.

## Capabilities (consolidated from upstream `tenantiq`)

- **OAuth governance** — enumerate consented apps, score per-grant risk,
  recommend revoke / scope-down.
- **AI remediation plans** — propose reversible change sets for risky
  configurations; apply on admin approval with audit-grade evidence.
- **Blast-radius simulation** — for any proposed change, surface
  affected users, scopes, data classes, and downstream apps before apply.
- **CIS Benchmark engine** — 100+ controls across 7 control-domain files
  with per-tenant overrides and audit-grade justification.
- **Drift detection** — named baselines, drift attribution to actor,
  generic revert.
- **MSP rollups** — backup health, benchmark scores, alerts across all
  managed tenants from one console.
- **Mobile shell** — Capacitor 8 + SvelteKit native iOS / Android app
  for on-call operators (in `web/`).
- **Skill marketplace** — gated skills run per-tenant, billing tier
  enforces availability.

## Directory layout (post round 4)

```
products/tenantiq/
├── README.md                  ← you are here
├── README.source.md           ← upstream README preserved (655 lines)
├── CLAUDE.md                  ← product-level CLAUDE rules
├── CLAUDE.source.md           ← upstream CLAUDE preserved (367 lines)
├── MIGRATION_NOTES.md
│
├── apps/
│   ├── api/                   ← Cloudflare Workers + Hono (TypeScript)
│   │                            197 route files, 26 cron jobs, 8 queues
│   └── web/                   ← SvelteKit 5 desktop console
│                                80 pages, 196 components
│
├── packages/
│   ├── db/                    ← Drizzle ORM, 34 D1 tables, 17 migrations
│   ├── shared/                ← types, enums, configs
│   ├── graph/                 ← Microsoft Graph SDK wrapper
│   ├── ai/                    ← AI tools (Claude + smart-router)
│   └── intel/                 ← alert prioritization & risk scoring
│
├── web/                       ← Capacitor 8 mobile shell (SvelteKit 5)
│                                originally portfolio/tenantiq.frontend/
│
├── design-system/             ← tokens (Apple HIG)
├── migrations/                ← top-level (in addition to packages/db)
├── tests/
│   ├── e2e/                   ← 32 Playwright specs
│   ├── integration/
│   └── load/                  ← k6 load tests
└── scripts/                   ← cert evidence bundle, drift checks, deploy
```

## Two surfaces, one product

- `apps/web/` (the SvelteKit desktop console from the `tenantiq` repo)
- `web/` (the Capacitor mobile shell from the `tenantiq.frontend` repo)

Both consume the same `apps/api/` backend. Consolidation pass (post
round 4) decides whether to merge or formalise the split.

## What this is **not**

- Not an end-user M365 productivity tool. The customer is the MSP /
  security operator, not the tenant user.
- Not a generic identity provider. Auth uses Microsoft OAuth + Entra
  workload identity; user accounts live in the customer's tenant.
- Not a SOC product. TenantIQ generates evidence and remediation;
  detection/response orchestration belongs to OpenSyber.

## Next steps (post round-4 migration)

See `MIGRATION_NOTES.md` and the AMLIQ `CONSOLIDATION_TODO.md` for
ordered tickets. The first wave focuses on:

1. Decompose `CLAUDE.source.md` and `README.source.md` into ≤200-line
   chapters under `docs/`.
2. Reconcile `apps/web/` and `web/`: keep both or merge.
3. Wire JWT verify to `@finsavvyai/auth` (currently bespoke jose
   integration).
4. Replace external `@opensyber/tokenforge` dep in `web/package.json`
   with the workspace `oss/tokenforge/` package once published.
5. Add to `pnpm-workspace.yaml` once at least one `@finsavvyai/*` import
   is wired (today: none).
