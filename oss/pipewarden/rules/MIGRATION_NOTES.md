# Code Safety Suite — Folded Into PipeWarden Rules

## Provenance

- **Source path:** `/Users/shaharsolomon/dev/projects/portfolio/code-safety-suite/`
- **Commit SHA at copy:** `no-git` (source had no `.git` directory)
- **Copy date:** 2026-05-25
- **Copy method:** `rsync -a` with portfolio-standard excludes
- **Agent:** PUSHCI-OSS (round 4)
- **Addendum reference:** §3 — OSS components table, "code-safety-suite OSS → merge into oss/pipewarden/rules/ — Folds into PipeWarden rule set"

## What was excluded

Standard round-4 excludes plus:
- `.pytest_cache/`, `logs/`, `gradle/` — runtime / build state
- `.DS_Store`

## Size and file counts

| Stage | Size | Files |
|---|---|---|
| Source raw | 463 MB | 223 |
| After rsync | 2.9 MB | 212 |
| After gradle cleanup | 2.9 MB | ~209 |

Largest portion of source bulk was `monitor/frontend/node_modules/` (439 MB),
fully excluded.

## What was preserved

- `monitor/` — Java/Kotlin monitoring agent and Express + React UI
- `src/` — TS sources (security scanners)
- `tests/` — Vitest test suites
- `SPRINTS.md` — historical sprint plan (now reference only)
- `QA_REPORT.md`
- `package-wave5.json` — historical npm package manifest
- `vitest.config.ts`

## Known issues / integration

- This is a fold-in: the legacy `code-safety-suite` was a separate scanner
  product. It is now folded under `oss/pipewarden/rules/` as a **rule
  source**, not a parallel scanner. Future work needs to:
  1. Map each `code-safety-suite` scanner check to a PipeWarden rule
     definition under `oss/pipewarden/rules/<category>/`.
  2. Retire the standalone Express server in `monitor/` once parity
     reached, or repurpose it as a UI for PipeWarden decisions.
  3. Decide if the Java/Kotlin agent in `monitor/` (`monitor/src/`,
     `monitor/build.gradle*`) stays — it's outside PipeWarden's Go-only
     architecture constraint.
- **`SPRINTS.md` contains `@finsavvyai/pay` text references** — these are
  historical sprint plans, not runtime imports. Safe to retain.
- **No tests run yet against the folded code** — integration is out of
  scope for this round.

## Status

This is a copy-only fold. No code in PipeWarden currently invokes
anything under `rules/monitor/` or `rules/src/`. Integration is a
follow-up task; tracked in PipeWarden's main `CONSOLIDATION_TODO.md` (to
be created by the fold-integration task).
