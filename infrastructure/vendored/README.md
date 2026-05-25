# Vendored Third-Party Code

**This directory contains code that is NOT authored by FinsavvyAI.** Each subdirectory is third-party software preserved here for reference, integration, or build-time use.

## Why this exists

Per founder clarification (2026-05-25, May ranking memo): the `08_open_source/` tree at `/Users/shaharsolomon/dev/projects/08_open_source/` was wrongly treated as if it might be FinsavvyAI product candidates. It is in fact third-party code (the founder uses it but did not author it).

Vendoring it here:
- Keeps a known-good copy for the monorepo's reproducibility
- Makes the third-party-vs-ours separation visible
- Prevents accidental migration of third-party projects as FinsavvyAI products

## Contents

- `opensource/` — bulk copy from `/08_open_source/` (rsync 2026-05-25 with standard build-artifact excludes)

## Hard rules

- **Do not edit any file under `opensource/`.** If a fix is needed, fork upstream and submit a PR there. Carry a patch as a separate file alongside the vendored copy if necessary.
- **Do not list any subdirectory here in `pnpm-workspace.yaml`.** These are not workspace members.
- **Do not strip or alter LICENSE files.** Each project's license is preserved as upstream shipped it.
- **Update workflow:** `rsync` from upstream source (or `git clone` then strip `.git`) — never `git submodule` (creates linkage we don't want for this directory).

## Attribution

Each subdirectory under `opensource/` is the property of its upstream maintainers. See the per-project LICENSE and README.

## Excluded from vendoring

- `node_modules/`, `__pycache__/`, `.venv/`, `venv/`, `dist/`, `build/`, `.next/`, `.wrangler/`, `vendor/`, `coverage/`, `*.log`, `.env*`, `*LEAKED*`, `.git/`

## If a project here turns out to BE ours

Move it out of `vendored/` to its proper home (`products/`, `oss/`, `packages/`) and document the move in `_archive/migration-status.md`.
