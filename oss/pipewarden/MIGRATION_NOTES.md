# PipeWarden — Migration Notes

## Provenance

- **Source path:** `/Users/shaharsolomon/dev/projects/portfolio/pipewarden/`
- **Commit SHA at copy:** `184cfb8c18d245801735e0b1f417d8cb01ff91e7`
- **Copy date:** 2026-05-25
- **Copy method:** `rsync -a` with portfolio-standard excludes
- **Agent:** PUSHCI-OSS (round 4)
- **Addendum reference:** §3 — OSS components table, "pipewarden OSS → oss/pipewarden/ — Plan's primary OSS asset"

## What was excluded

Standard round-4 excludes:
`node_modules/`, `dist/`, `build/`, `coverage/`, `.git/`, `.wrangler/`, `.next/`,
`venv/`, `vendor/`, `__pycache__/`, `*.log`

PipeWarden-specific excludes:
- `target/` — Rust build output (none in this repo today; guard exclude)
- `coverage.out`, `*.cov` — Go coverage artifacts (~534 KB)
- `*.db`, `*.db.bak*`, `.env`, `.env.bak*` — local state and secrets
- `*.tsbuildinfo` — TS incremental cache
- `.DS_Store`
- `/bin/` — pre-built Go binaries (76 MB) — rebuildable via `go build ./cmd/...`
- `/pipewarden` (top-level dev binary, 21 MB)
- `handlers.test` (stale 26 MB Mach-O test binary, removed post-rsync)

## What was preserved

- **`LICENSE` (MIT)** — original OSS license preserved verbatim
- All Go source, configs, deploy manifests, docs, design-system, marketing
- `.goreleaser.yml`, `.goreleaser.airgap.yml` — air-gapped release pipeline
- `Dockerfile`, `docker-compose.yml`

## Size and file counts

| Stage | Size | Files |
|---|---|---|
| Source raw | 214 MB | 794 |
| After rsync | 31 MB | 774 |
| After binary cleanup (`handlers.test`) | 5.4 MB | 773 |

## code-safety-suite fold-in

Per addendum §3: "code-safety-suite OSS → merge into oss/pipewarden/rules/ —
Folds into PipeWarden rule set"

`/Users/shaharsolomon/dev/projects/portfolio/code-safety-suite/` was rsynced
into `oss/pipewarden/rules/`. See `oss/pipewarden/rules/MIGRATION_NOTES.md`
for details (separate document because it has its own provenance).

## Known issues / broken imports

- **Self-referencing Go imports** (`github.com/finsavvyai/pipewarden/internal/...`):
  valid module-relative imports resolved via `go.mod`. No change required for
  build; the `go.mod` module path still names the original GitHub location.
- **No `@finsavvyai/*` workspace imports** in actual Go or TS code.
  Two **doc/script** references exist:
  - `scripts/pushci-publish.sh` mentions `@finsavvyai/pushci` (npm package name)
  - `rules/SPRINTS.md` mentions `@finsavvyai/pay` (sprint planning text only)
  These are not runtime imports; no breakage.
- **~83 Go source files exceed the 200-line cap**. Pre-date portfolio rules,
  copied as-is per round conventions. Tracked for future refactor.

## Not added to pnpm workspace

PipeWarden is a Go project; no TS workspace integration needed.
The single `package.json` at the root is a thin wrapper (similar to PushCI's
top-level package.json). It is **not** added to the workspace.

## OSS posture

- License: **MIT** (preserved from source — see `LICENSE`)
- New `CONTRIBUTING.md` added at this directory root.
- `CLAUDE.md` was preserved as `CLAUDE.legacy.md`; new monorepo-aware
  `CLAUDE.md` at the same path.
- `README.md` was preserved as `README.legacy.md`; new monorepo-aware
  `README.md` at the same path.
