# Migration Status — 8-Week Sequence

Tracks the addendum's "Sequencing" timeline (sections 1 + 3). Update as phases complete.

Legend: `[x]` done · `[~]` in progress · `[ ]` planned · `[!]` blocked

## Week 1 — Promote fintech-suite/api-gateway to platform/ai-gateway

- [x] Monorepo skeleton dirs created (`products/`, `oss/`, `infrastructure/`, `websites/`, `_archive/`)
- [x] Root `README.md` updated for new layout
- [x] `pnpm-workspace.yaml` extended (`products/*`, `oss/*`)
- [x] fintech-suite Wave-1 status artifacts snapshotted to `_archive/fintech-suite-wave1/`
- [x] Portfolio inventory drafted (`_archive/portfolio-migration-inventory.md`)
- [~] GATEWAY agent: merge fintech-suite `api-gateway` prod code into `packages/ai-gateway` (round-2 swarm in flight)
- [ ] Verify `pnpm test` green at `packages/ai-gateway` post-merge
- [ ] Coverage non-regression check at `packages/ai-gateway`

## Week 2-3 — Fold billing-payments + analytics into platform

- [~] BILLING agent: fold `fintech-suite/.../billing-payments` into `packages/billing` (round-2 in flight)
- [~] TELEMETRY agent: fold `fintech-suite/.../analytics` into `packages/telemetry` (round-2 in flight)
- [ ] Update each package README to honestly reflect merged scope
- [ ] Run full root `pnpm test` — must be green

## Week 4-6 — AMLIQ consolidation

- [~] AMLIQ agent: stand up `products/amliq/` and seed `packages/shared-types/` (round-2 in flight)
- [ ] Migrate `quantumbeam/` to `products/amliq/engines/quantumbeam/`
- [ ] Migrate `fintech-suite/.../fraud-detection/` (Go) to `products/amliq/engines/ml-fraud/`
- [ ] Migrate `aegis/` backend to `products/amliq/`
- [ ] Migrate `amliq-frontend/` to `products/amliq/web/`
- [ ] Consolidate AML scoring API

## Week 7 — Archive remaining fintech-suite shell

- [ ] Migrate `fintech-suite/k8s/` to `infrastructure/k8s/legacy-fintech/`
- [ ] Migrate `fintech-suite/deploy/` (Terraform) to `infrastructure/legacy-fintech/`
- [ ] Confirm `fintech-suite/web/` disposition (route audit) — `products/amliq/web/` or `websites/finsavvyai.com/`
- [ ] Move `fintech-suite/landing-page/` to `websites/finsavvyai.com/legacy/`
- [ ] All other status docs already archived in `_archive/fintech-suite-wave1/`

## Week 8 — Delete portfolio/fintech-suite/

- [ ] Final diff: confirm nothing in `portfolio/fintech-suite/` is referenced from the monorepo
- [ ] Manual delete of `/Users/shaharsolomon/dev/projects/portfolio/fintech-suite/`
- [ ] Tag commit `migration/fintech-suite-deleted`

## Cross-cutting (parallel to weeks 1-8)

- [ ] Archive 22 off-thesis repos per inventory (single sweep, days 1-30 window)
- [ ] Open-source PipeWarden under new `oss/pipewarden/` structure (days 31-60)
- [ ] Move PushCI + PipeWarden into monorepo (days 31-60)
- [ ] Move Qestro and LunaOS (with lunaforge harvested) (days 31-60)
- [ ] Move OpenSyber, SDLC.cc, TenantIQ (days 61-90)
- [ ] Resolve inventory TODOs (a2a activity, automationhub-upm, coderailflow placement, flujo, queryflux dedupe, windsu overlap, resume removal)
