# AMLIQ Web Migration Notes (Round 4)

Migration agent: **AMLIQ-TENANTIQ** (round 4).
Authority: `finsavvyai_consolidation_plan_addendum.md` §3, `/tmp/finsavvyai-round4-conventions.md`.

## Source → target

| Source (read-only) | Target |
|---|---|
| `/Users/shaharsolomon/dev/projects/portfolio/amliq-frontend/` | `products/amliq/web/` |

- Source commit SHA: `353969981fe475155342f7b50ac0a93cded86cbb`
- Copy date: 2026-05-25
- Tech: React 18 + Vite 5 + TypeScript + Tailwind, Vitest, Playwright e2e
- Top-level package name (kept as-is): `amliq-dashboard`

## What was copied

All source under `src/`, `e2e/`, `public/`, config files (`vite.config.ts`,
`tsconfig.json`, `tailwind.config.js`, `package.json`, etc.), env templates,
Dockerfile, playwright/vitest configs, the local `.planning/` directory, and
the inline marketing assets.

| Metric | Value |
|---|---|
| Files copied | 671 |
| On-disk size | 37 MB |
| TS files >200 lines | 8 (inherited; flagged for split on first edit) |

## What was excluded (rsync)

| Excluded | Reason |
|---|---|
| `node_modules/` | Rebuild from `package-lock.json` / pnpm install. |
| `dist/`, `build/` | Build artefacts. |
| `coverage/` | Test artefacts. |
| `.git/`, `.wrangler/`, `.next/` | Source-repo / tooling metadata. |
| `playwright-report/`, `test-results/` | Local run output. |
| `*.log` | Local logs. |

## Known issues / follow-ups

1. **No `@finsavvyai/*` imports** today. The web app talks to the AMLIQ API
   via its own typed client; wiring to `@finsavvyai/shared-types` (already
   exports `AmlDecision`, `ScoreRequest`, etc.) is a consolidation task.
2. **Auth client is local** — uses Supabase JS directly. Needs to be replaced
   with `@finsavvyai/auth` once the JWT handshake with the API is defined.
3. **NOT added to `pnpm-workspace.yaml`** in this round because no
   `@finsavvyai/*` imports exist yet (per round-4 conventions §"hard rules":
   only add packages with workspace-internal imports). The `package.json`
   declares its own deps and builds standalone; adding it later is a
   one-line change once shared-types imports are wired.
4. **`.env*` files were copied** — review for any leaked secrets before
   committing; round-4 conventions forbid secrets in tree.

## Tests / build

Not built, not tested by this migration (per round-4 hard rules — copy only).
Source repo's last published test result: green (per amliq-frontend
`.planning/`).

## Files NOT touched

- `products/amliq/engines/`, `products/amliq/internal/` — owned by round 2.
- `products/amliq/api/` — populated by this same agent from `aegis`.
- `/portfolio/amliq-frontend/` — read-only source.
