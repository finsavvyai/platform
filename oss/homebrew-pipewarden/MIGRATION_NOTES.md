# Homebrew PipeWarden Tap — Migration Notes

## Provenance

- **Source path:** `/Users/shaharsolomon/dev/projects/portfolio/homebrew-pipewarden/`
- **Commit SHA at copy:** `3562a37120ccf83a7d83501d4f844a2564f63958`
- **Copy date:** 2026-05-25
- **Copy method:** `rsync -a` with portfolio-standard excludes
- **Agent:** PUSHCI-OSS (round 4)
- **Addendum reference:** §3 — OSS components table, "homebrew-pipewarden OSS → oss/homebrew-pipewarden/ — Distribution tap"

## What was excluded

`node_modules/`, `.git/`, `.DS_Store` (none present in source — repo only
contains a Formula and a README).

## Size and file counts

| Stage | Size | Files |
|---|---|---|
| Source raw | 136 KB | 2 |
| After rsync | 8 KB | 2 |

The 2 files:
- `Formula/pipewarden.rb` — Homebrew formula
- `README.md` — tap usage instructions

## Known issues

- This is a **distribution tap** for `brew tap finsavvyai/pipewarden`. The
  formula points at GitHub release artifacts published by the PipeWarden
  build pipeline (see `oss/pipewarden/.goreleaser.yml`). Releases continue
  to be cut from the upstream repo's tags, **not** from this monorepo
  location.
- If the canonical release pipeline moves into the monorepo, the formula's
  download URL and SHA256 will need to be updated to reference the new
  release artifacts.
- No code-level dependencies on `@finsavvyai/*` packages (formula is Ruby
  DSL; no JS/TS involved).

## Status

Copy-only migration. No structural changes. The tap continues to function
as before from its GitHub remote.
