# TenantIQ Migration Notes (Round 4)

Migration agent: **AMLIQ-TENANTIQ** (round 4).
Authority: `finsavvyai_consolidation_plan_addendum.md` §3, `/tmp/finsavvyai-round4-conventions.md`.

## Source → target

| Source (read-only) | Target |
|---|---|
| `/Users/shaharsolomon/dev/projects/portfolio/tenantiq/` | `products/tenantiq/` |
| `/Users/shaharsolomon/dev/projects/portfolio/tenantiq.frontend/` | `products/tenantiq/web/` |

- `tenantiq` SHA: `967744d0ca1dd17fd890db388c33832f64d2ba73`
- `tenantiq.frontend` SHA: `1505a3fe37691c2f2ddf7b150080e42760e9a18c`
- Copy date: 2026-05-25

## What was copied

### `products/tenantiq/` (from `tenantiq`)
Full SvelteKit + Cloudflare Workers monorepo: `apps/api/`, `apps/web/` (the
internal one — separate from `tenantiq.frontend`), `packages/{db,shared,graph,ai,intel}`,
`migrations/`, `tests/`, `scripts/`, all top-level configs (`turbo.json`,
`pnpm-workspace.yaml`, `package.json`, `tsconfig.json`, vitest/playwright
configs), 26 cron job sources, all docs.

| Metric | Value |
|---|---|
| Files copied (excl `web/`) | ~2,072 |
| On-disk size | 86 MB |
| Files >200 lines | 70 (inherited from upstream; first edit triggers split) |

### `products/tenantiq/web/` (from `tenantiq.frontend`)
Mobile companion / standalone SvelteKit 5 + Capacitor 8 app (iOS + Android).

| Metric | Value |
|---|---|
| Files copied | 495 |
| On-disk size | 4.9 MB |

> Note: `products/tenantiq/apps/web/` (the desktop SvelteKit web app from the
> `tenantiq` repo) and `products/tenantiq/web/` (the mobile-first Capacitor
> shell from `tenantiq.frontend`) coexist. The post-migration consolidation
> task is to decide whether they merge or stay as two surfaces (desktop +
> mobile). Tracked under HANDOFF NOTES; **not** resolved in this round.

## What was excluded (rsync)

| Excluded | Reason |
|---|---|
| `node_modules/` | Rebuild from `pnpm-lock.yaml`. |
| `dist/`, `build/`, `.svelte-kit/`, `.turbo/` | Build / framework caches. |
| `coverage/` | Test artefacts. |
| `.git/`, `.wrangler/`, `.next/` | Source-repo / tooling metadata. |
| `playwright-report/`, `test-results/` | Local Playwright output. |
| `venv/`, `vendor/`, `__pycache__/` | Local runtime artefacts. |
| `*.log` | Local logs. |

## Source-repo docs preserved

The upstream `tenantiq` repo shipped its own `CLAUDE.md` (367 lines) and
`README.md` (655 lines). Both exceed the 200-line cap, so they were
**renamed** during placement to preserve their content without colliding
with the product-level docs this round writes:

- `tenantiq/CLAUDE.md` (source) → `products/tenantiq/CLAUDE.source.md`
- `tenantiq/README.md` (source) → `products/tenantiq/README.source.md`

The product-level `CLAUDE.md` and `README.md` written in this round are
the canonical product docs; the `.source.md` siblings remain as upstream
reference until they are decomposed in a later pass.

## Known issues / follow-ups

1. **One stray `@finsavvyai/pay` reference** in `SPRINTS.md` — aspirational
   sprint plan text, not a real import. Listed in HANDOFF for the migration
   diff scanner.
2. **External brand integration `@opensyber/tokenforge` (^0.1.2)** in
   `products/tenantiq/web/package.json` references the OpenSyber portfolio
   product. Once `oss/tokenforge/` is published from the monorepo, this
   should be repointed to the workspace package.
3. **NOT added to `pnpm-workspace.yaml`** in this round — same rationale as
   amliq/web: no workspace-internal imports today.
4. **`tenantiq/apps/web/` vs `tenantiq/web/` duplication** — see note above.
5. **70 files >200 lines** inside `products/tenantiq/` (excl `web/`).
   Inherited; split on first edit.
6. **`pnpm-workspace.yaml` exists inside `products/tenantiq/`** declaring
   `apps/*` and `packages/*` relative to itself. This nested workspace must
   be reconciled with the platform root workspace once the product is built
   from monorepo CI.

## Tests / build

Not built, not tested by this migration (per round-4 hard rules — copy only).
Upstream test status (per source `CLAUDE.source.md`): 1,480 tests passing,
3 deliberately skipped.

## Files NOT touched

- Anything outside `products/tenantiq/`.
- `/portfolio/tenantiq/` and `/portfolio/tenantiq.frontend/` — read-only sources.
