# AMLIQ API Migration Notes (Round 4)

Migration agent: **AMLIQ-TENANTIQ** (round 4).
Authority: `finsavvyai_consolidation_plan_addendum.md` §3, `/tmp/finsavvyai-round4-conventions.md`.

## Source → target

| Source (read-only) | Target |
|---|---|
| `/Users/shaharsolomon/dev/projects/portfolio/aegis/` | `products/amliq/api/` |

- Source commit SHA: `4eade45e5695757c32338c7e68559295576ed5bb`
- Copy date: 2026-05-25
- Source go module name: `github.com/aegis-aml/aegis`

## What was copied

All files from the aegis tree (Go source, configs, migrations, docs, web stubs, samples, runlocal dev harness, sdks).

| Metric | Value |
|---|---|
| Files copied | 2,313 |
| On-disk size | 128 MB |
| Top-level go.mod | 1 (`github.com/aegis-aml/aegis`) |

## What was excluded (rsync)

| Excluded | Reason |
|---|---|
| `node_modules/` | Rebuild from lockfile. |
| `dist/`, `build/`, `coverage/` | Build / test artefacts. |
| `.git/` | Source-repo metadata. |
| `.wrangler/`, `.next/` | Tooling caches. |
| `venv/`, `vendor/`, `__pycache__/` | Local runtime artefacts. |
| `*.log`, `cov.out` | Local logs / coverage. |
| `worker`, `seed`, `import-worldcheck-csv`, `benchmark-fp` | Large compiled binaries (>8 MB each) — rebuild from source. |

## Known issues / follow-ups

1. **Three Go module names now coexist under `products/amliq/`**:
   - `engines/quantumbeam/` → `module quantumbeam` (round 2)
   - `engines/ml-fraud/` → `module quantumbeam` (round 2 — collision)
   - `api/` → `module github.com/aegis-aml/aegis` (this round)
   A unified module layout (likely a Go workspace with three modules:
   `github.com/finsavvyai/amliq/{api,engines/quantumbeam,engines/ml-fraud}`)
   is the first task in `products/amliq/CONSOLIDATION_TODO.md`.
2. **No imports of `@finsavvyai/*` packages** anywhere in the migrated tree.
   The API stands alone today; wiring to `@finsavvyai/auth`, `telemetry`,
   `policy-engine`, and `shared-types` is part of consolidation.
3. **AMLIQ decision surface is partially present** in `api/` but built around
   the aegis brand. The unified design is in `api/decision.md`.
4. **Legacy infra references** — `wrangler.jsonc`, `render.yaml`,
   `Dockerfile` reference the aegis Cloudflare / Render accounts. Retarget
   before any deploy attempt.
5. **8 source files exceed the 200-line cap**. Inherited from upstream;
   first non-trivial edit triggers a split per portfolio CLAUDE rules.

## Tests / build

Not built, not tested by this migration (per round-4 hard rules — copy only).

## Files NOT touched

- `products/amliq/engines/`, `products/amliq/internal/` — owned by round 2.
- `products/amliq/MIGRATION_NOTES.md` (top-level) — round 2 artefact.
- `/portfolio/aegis/` — read-only source.
