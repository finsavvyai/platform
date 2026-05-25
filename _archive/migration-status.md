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

- [x] Archive 22 off-thesis repos per inventory (single sweep, days 1-30 window) — ARCHIVE-WEBSITE round 4: 22 archive-candidate manifests + 12 worktree-variant manifests + INDEX.md at `_archive/portfolio-snapshots/`. Two source snapshots (`pipewarden-real-archive-20260412/`, `queryflux/`); rest manifest-only (>100MB or worktree). Originals untouched in `/portfolio/`.
- [ ] Open-source PipeWarden under new `oss/pipewarden/` structure (days 31-60)
- [ ] Move PushCI + PipeWarden into monorepo (days 31-60)
- [ ] Move Qestro and LunaOS (with lunaforge harvested) (days 31-60)
- [ ] Move OpenSyber, SDLC.cc, TenantIQ (days 61-90)
- [x] flujo activity check (per addendum: "ARCHIVE → or fold; if active, fold into LunaOS") — ARCHIVE-WEBSITE round 4: last commit 2025-03-14 (stale ~14mo) → **archived, not folded**. Manifest at `_archive/portfolio-snapshots/flujo/ARCHIVED.md`.
- [x] queryflux dedupe — ✅ **Founder decision 2026-05-25: PROMOTE to 8th CORE product.** `products/queryflux/` (rsync from queryflux-git, fold querylens → `lens/`). Snapshots removed. See addendum §4 + `products/queryflux/MIGRATION_NOTES.md`.
- [x] windsu overlap with PushCI (per addendum: "check overlap with PushCI, otherwise archive") — ARCHIVE-WEBSITE round 4: surface overlap exists but architecture incompatible (IDE-time human-author vs PR-time AI-author). **Archive, no fold-in.** Detail in `_archive/portfolio-snapshots/windsu-credit-manager/ARCHIVED.md`.
- [ ] Resolve remaining inventory TODOs (~~a2a activity~~ ✅ MIT LICENSE added 2026-05-25, automationhub-upm, coderailflow placement, resume removal)

## Founder corrections (2026-05-25)

- [x] **QueryFlux → 8th CORE product** — `products/queryflux/`, 143M. README/CLAUDE.md/MIGRATION_NOTES/CONSOLIDATION_TODO written. Snapshots removed from `_archive/portfolio-snapshots/`.
- [x] **a2a-framework → definite OSS** — MIT LICENSE added at `oss/a2a-framework/LICENSE`. Platform-aligned README written.
- [x] **autoboot disentangled** — `_archive/fastpm-2026-05/` holds manifest + 10-step TAKE_DOWN_ACTIONS.md (DNS redirect, site shutdown, extension unpublish, GitHub archive). Sprint harness untouched (separate root-level scripts).
- [x] **looma-sh → EXTERNALIZE bucket** — `_archive/externalized/looma-sh/` holds prior manifest + 10-step SPIN_OUT_PLAN.md (separate entity, domain transfer, Stripe split).
- [ ] User executes external actions (DNS, entity stand-up, manual `/portfolio/{autoboot,looma-sh}` deletion).

See `founder_decisions_memo.md` + addendum §4.

## May 2026 ranking second-pass corrections (2026-05-25)

After the cross-folder May ranking memo (web-verified market analysis):

- [x] **FinSavvy Cluster → 9th CORE product** — `products/finsavvy-cluster/` (9.7M from `02_AI_AGENTS/llm/`). Brand-aligned, top-ranked. Compete-or-niche decision pending.
- [x] **UPM → OSS** — `oss/mcp-tooling/upm/` (13M from `03_Enterprize_application/products/devx-platform/upm/`). LICENSE present. Sibling to jpm/npmplus-core (not yet folded).
- [x] **pixel-pets → EXTERNALIZE** — moved to `_archive/externalized/pixel-pets/`. Last-commit-2-days-ago contradicted the archive decision.
- [ ] **Numbered folders audit** — background agent running. Will produce `_archive/numbered-folders-audit.md` with per-product KEEP_CANONICAL vs RE_MIGRATE_FROM_NUMBERED verdict.
- [ ] **jpm + npmplus-core fold** — pending founder decision (memo recommends fold to `oss/mcp-tooling/`).
- [ ] **08_open_source/ vendor move** — pending founder decision (memo: "not mine", move to `infrastructure/vendored/`).
- [ ] **GTM top-3** — memo recommends TenantIQ + PushCI+PipeWarden + QueryFlux for next 60 days. Founder accept?

See addendum §5.

## Website rebuild

- [x] Scaffold `websites/finsavvyai.com/` — Astro 4 + Tailwind + TS strict — ARCHIVE-WEBSITE round 4. Headline + subhead from master plan. `Default.astro` layout (skip link, semantic landmarks, color-scheme), `Hero.astro` component, `index.astro` page, robots.txt allow-all, tailwind palette (`ink.50`/`ink.900`), Apple-HIG sans stack. CLAUDE.md extends portfolio rules with Astro coverage exception (visual-regression + a11y audit + Lighthouse CI replace `.astro` unit tests). README documents Cloudflare Pages deploy.
- [x] Add `websites/*` to `pnpm-workspace.yaml`.
- [ ] Wire Playwright + axe + Lighthouse CI (future round)
- [ ] Import `fintech-suite/landing-page/` into `websites/finsavvyai.com/legacy/` per addendum §1 Week 7
