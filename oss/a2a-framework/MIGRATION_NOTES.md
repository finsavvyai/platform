# a2a-framework Migration Notes

Round 4, Days 61-90. Agent: SDLC-OPENSYBER.

## Source

| Source | Detail |
|---|---|
| Source path | `portfolio/a2a-framework` |
| Git SHA | **none** — source directory has no `.git/` |
| Last filesystem mtime | 2026-05-13 (config files), tests modified same day |
| New path | `oss/a2a-framework/` |
| Copy date | 2026-05-25 |

## Freshness verdict: ACTIVE

Per addendum §3 instruction: "Keep if active; archive if stale (check last commit)."

The source has no git history (`.git` missing), so the commit-based check from the round-4 conventions is not applicable. Fallback to filesystem mtime check: most recent file modification is 2026-05-13, **12 days before this migration** — clearly **active**, not stale.

Treating as active OSS component. Migrated normally to `oss/a2a-framework/`.

## LICENSE check

**No LICENSE file** found in source repo. This is a problem for an OSS-positioned package.

**TODO (caller):** add an MIT or Apache-2.0 LICENSE file before any public OSS release. Until then, the framework is effectively all-rights-reserved.

## Exclusions applied

Standard rsync excludes (node_modules, dist, build, coverage, .git, .wrangler, .next, venv, .venv, vendor, __pycache__, .pytest_cache, .cache, .turbo, *.log).

## File counts

- Source: 230 files, 1.9M (before excludes)
- Target: 152 files, 1.1M (after excludes)

## Notable contents

- `a2a-agent-record/`, `a2a-cli/`, `a2a-server/` — three sub-projects
- `src/`, `tests/` — root-level TypeScript sources
- `package.json` — declares `a2a-framework@1.0.0` (NOT `@finsavvyai/a2a-framework` — confirms it's an external OSS asset, not a workspace package)
- `vitest.config.ts`, `tsconfig.json` — standard TS toolchain

## Workspace inclusion

The `package.json` uses the bare name `a2a-framework`, not a `@finsavvyai/*` namespaced name. Per round-4 conventions ("do NOT add to pnpm-workspace.yaml unless they import `@finsavvyai/*`"), this package is NOT added to the workspace. 0 `@finsavvyai/*` imports found in source.

If the product team wants to consume `a2a-framework` from within the monorepo, options are:
1. Rename to `@finsavvyai/a2a-framework` (publish-time rename) and add to workspace.
2. Keep external naming and publish to npm as `a2a-framework`.
3. Add it to the workspace under its current name (pnpm supports non-scoped packages).

## Files exceeding 200-line cap

17 source files exceed the 200-line cap (the legacy CLAUDE.md is 260 lines, plus 16 code files). Migrated as-is per round-4 convention; refactor backlog.

## Cross-product references

No SDLC.cc / OpenSyber / PipeWarden references found. `a2a-framework` is a standalone agent-to-agent communication framework — orthogonal to the runtime-security triangle.
