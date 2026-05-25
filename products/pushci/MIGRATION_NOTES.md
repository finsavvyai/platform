# PushCI — Migration Notes

## Provenance

- **Source path:** `/Users/shaharsolomon/dev/projects/portfolio/pushci/`
- **Commit SHA at copy:** `506a9a102e9b654d875e77deebef74d222b32c60`
- **Copy date:** 2026-05-25
- **Copy method:** `rsync -a` with portfolio-standard excludes
- **Agent:** PUSHCI-OSS (round 4, day 31-60 of 90-day consolidation plan)
- **Addendum reference:** §3 — Core products table, line "pushci CORE → products/pushci/"

## What was excluded

Standard round-4 excludes:
`node_modules/`, `dist/`, `build/`, `coverage/`, `.git/`, `.wrangler/`, `.next/`,
`venv/`, `vendor/`, `__pycache__/`, `*.log`

Pushci-specific excludes:
- `target/` — Rust build output under `agent-platform/` (1.1 GB)
- `Pods/`, `ios/build/` — CocoaPods + Xcode build under `mobile/` (~154 MB)
- `coverage.out`, `*.cov` — Go coverage artifacts
- `*.db`, `*.db.bak*`, `.env`, `.env.bak*` — local state and secrets
- `playwright-report/`, `test-results/` — test run artifacts
- `*.tsbuildinfo` — TS incremental cache
- `.DS_Store`

Post-copy manual deletion:
- `/pushci` (top-level dev Go binary, 12 MB Mach-O arm64) — rebuildable via `go build ./cmd/pushci`

## What was included

Pre-built CLI binaries in `bin/` were preserved because the npm `package.json`
`files` array lists them — they are required for the npm distribution package.
These should eventually move to a release-artifact pipeline; flagged below.

## Size and file counts

| Stage | Size | Files |
|---|---|---|
| Source raw | 3.4 GB | ~24,649 |
| Target after rsync | 157 MB | 15,346 |
| Target after binary cleanup | 145 MB | 15,345 |

## push-ci.dev consolidation

Per addendum §3: "push-ci.dev CORE → merge into products/pushci/website/ — Symlink alias today; consolidate."

`/Users/shaharsolomon/dev/projects/portfolio/push-ci.dev` is a **symlink** to
`/Users/shaharsolomon/dev/projects/portfolio/pushci` (verified via `readlink`).
No bulk copy was needed — the website source already lives under `pushci/`
itself (see `web/landing/` and the `Formula/` tap). A pointer note is at
`products/pushci/website/POINTER.md` documenting the alias resolution.

## Known issues / broken imports

- **Self-referencing Go imports** (`github.com/finsavvyai/pushci/internal/...`):
  these are valid module-relative imports that resolve via `go.mod`. They will
  continue to work once the Go module is built from this new location, but the
  `go.mod` `module` declaration still names the original GitHub path. No code
  change needed for build; release publishing will need a decision on whether
  the canonical module path changes.
- **No `@finsavvyai/*` workspace imports** found anywhere in pushci. The
  internal `package.json` files (api, web/dashboard, web/landing, mobile,
  extensions/cursor, extensions/vscode) all use only third-party deps.
- **~71 source files exceed the 200-line cap** (59 TS/TSX in api+web, 12 Go in
  internal+cmd). These pre-date portfolio rules and were copied as-is per round
  conventions. They are not blockers for migration but should be tracked for
  refactor in a future round.
- `coverage.out` was excluded (~720 KB Go coverage artifact). Coverage thresholds
  remain enforceable from source via `go test -coverprofile=coverage.out`.

## Not added to pnpm workspace

Per task §7: pushci's TS subpackages (`api`, `web/dashboard`, `web/landing`,
`mobile`) have no `@finsavvyai/*` imports, so they are **not** added to the
root `pnpm-workspace.yaml`. They remain self-contained with their own
lockfiles. Future integration with `@finsavvyai/auth`, `@finsavvyai/billing`,
`@finsavvyai/telemetry` is an opportunity (see HANDOFF in agent output).
