# SDLC.cc Migration Notes

Round 4, Days 61-90. Agent: SDLC-OPENSYBER.

## Consolidation summary

SDLC.cc is a 3-repo consolidation per addendum §3:

| Source repo | SHA (HEAD at copy) | New path | Role |
|---|---|---|---|
| `portfolio/sdlc-cc` | `06fd4c357ba7f38814eae234a2a041e23ccbdd68` | `products/sdlc-cc/` (root) | Primary product — Go API, web frontend, Office add-ins (Excel/Outlook/PowerPoint/Word/Teams), browser extensions |
| `portfolio/sdlc-core` | `9b92b756ad5c22c5478f495a41908453dd8a52ff` | `products/sdlc-cc/core/` | Shared Go library — AI, audit, cache, DLP, quota subsystems |
| `portfolio/sdlc-platform` | `8cb6708e85a6cce0ad1fddf9da413f7fab70a649` | `products/sdlc-cc/platform/` | Hosted layer — services, apps, dev portal, extensions, deployment infra |

Copy date: 2026-05-25. Git history not preserved (round-4 convention).

## Exclusions applied

Standard rsync excludes plus additional build-artifact patterns (consistent with round-4 spirit):

- `node_modules/`, `dist/`, `build/`, `coverage/`, `.git/`, `.wrangler/`, `.next/`
- `venv/`, `.venv/`, `vendor/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.tox/`
- `.cache/` (Go build cache), `.terraform/` (Terraform provider binaries)
- `.vscode-test/` (VS Code test installation), `target/` (Rust build dir)
- `test-results/`, `playwright-report/` (Playwright run artifacts)
- `*.log`
- `services/gateway/server`, `services/gateway/bin/` (compiled Go binaries, 100MB+)

## File counts (after exclusions)

- `products/sdlc-cc/` root: 509 files, 15M
- `products/sdlc-cc/core/`: 196 files, 800K
- `products/sdlc-cc/platform/`: 3977 files, 71M
- **Total: ~4682 files, ~87M**

Source totals before excludes: 280k+ files, 12G+. The bulk was node_modules, Rust target dirs (vector-core debug build), Terraform provider binaries (~1GB), VS Code test installs (~600MB), Playwright run artifacts (~530MB), compiled Go binaries.

## Known broken imports / dependencies

After move, the following `@finsavvyai/*` imports in `sdlc-cc/platform/` will not resolve until the platform-side packages are wired or stubbed:

- `@finsavvyai/auth` — exists in `finsavvyai-platform/packages/auth` (resolves if added to workspace)
- `@finsavvyai/mcp-core` — DOES NOT exist in monorepo yet. Must be created or stubbed
- `@finsavvyai/monitor` — exists in `oss/design-system/monitor` (different impl from platform `telemetry`); naming collision risk
- `@finsavvyai/pay` — exists in `oss/design-system/pay` (different impl from platform `billing`); naming collision risk
- `@finsavvyai/test-config` — exists in `oss/design-system/test-config`

37 files in `sdlc-platform` reference one or more `@finsavvyai/*` packages. See CONSOLIDATION_TODO.md for the unification plan.

## Files exceeding 200-line cap

**654 files** in `products/sdlc-cc/` exceed the portfolio 200-line cap. These are migrated as-is per round-4 convention. Refactor backlog tracked in CONSOLIDATION_TODO.md.

## Cross-product references

- `core/audit/recorder.go` and `core/audit/pg_repository.go` reference adjacent systems (governance ↔ runtime security).
- `platform/sdlc-extension/src/storage.ts` references OpenSyber/PipeWarden surfaces.
- Detail: see HANDOFF in agent summary for SDLC ↔ OpenSyber ↔ PipeWarden trace.

## Secrets check

Source `sdlc-cc/.dev-key` and `sdlc-cc/.env.dev` exist in `portfolio/`. These were copied with the rest of the dotfiles. **TODO (caller):** verify these are dev-only placeholders, not production secrets. If real, rotate and gitignore before any commit.
