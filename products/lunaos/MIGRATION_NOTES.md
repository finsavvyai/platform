# LunaOS Migration Notes

## Sources

### Primary: luna-os

- Path: `/Users/shaharsolomon/dev/projects/portfolio/luna-os/`
- Commit SHA at copy time: **N/A — repo has `.git/` but zero commits**
  (`fatal: your current branch 'master' does not have any commits yet`)
- Latest filesystem mtime: 2026-05-23 (top-level)
- Migration date: 2026-05-25
- Migrated by: QESTRO-LUNAOS agent (round 4)

### Legacy: lunaforge (harvest predecessor)

- Path: `/Users/shaharsolomon/dev/projects/portfolio/lunaforge/`
- Commit SHA at copy time: `f20c8f7339a07fe065d48c73aa0af234938a0532`
- Last commit timestamp: `2025-11-24T12:43:34+02:00`
  (~6 months ago — within the 12-month "stale" threshold, copied per
  addendum §3 under `legacy/`)
- Target: `products/lunaos/legacy/`

## Method

`rsync -av` with the standard round-4 exclusions:

```
node_modules/  dist/  build/  coverage/  .git/  .wrangler/  .next/
venv/  vendor/  __pycache__/  *.log  .DS_Store  .pytest_cache/
.coverage  *.egg-info/
```

Note: `luna-os` contains nested git repos
(`lunaos-mobile`, `lunaos-docs`, `lunaos-intellij`, `luna-vault`). Their
`.git/` directories were excluded by the rsync; the working trees were
copied. To recover their history, consult the source repo.

Git history was NOT preserved at any level this round.

## Sizes

| Source | Raw | After exclusions |
|---|---|---|
| luna-os | 6.8 GB | 1.9 GB (incl. legacy/) |
| lunaforge | 2.1 GB | 997 MB (becomes `legacy/`) |

File count after copy (including legacy/): ~22,787

## Workspace integration

- The root `products/lunaos/package.json` has name `luna-os` and is
  picked up by the existing `products/*` glob in
  `pnpm-workspace.yaml` — no edit required.
- LunaOS does NOT currently import any `@finsavvyai/*` packages, so
  per round-4 rule no additional workspace entries needed.
- The bundled `OpenHands/` and `antigravity-awesome-skills/`
  directories are vendored upstream code and not pnpm packages at the
  root.

## Known issues / broken imports

- luna-os source had no commits; the SHA field above is intentionally
  N/A. Future restores must reference the source filesystem snapshot
  date.
- Files exceeding the 200-line cap: ~929 across luna-os, ~plus more
  inside `legacy/`. All are pre-existing product code copied as-is per
  round-4 rule.
- The two `.html` standalone files at the root
  (`lunaos-3d-architecture.html`, `lunaos-demo-clips.html`) are demo
  artifacts; they are not packaged.
- A `pushci.yml` file lives at the LunaOS root. This is leftover CI
  configuration referencing the PushCI product — not load-bearing, but
  PushCI maintainers may want to confirm or relocate.

## Cross-product references

- `lunaos-marketing` references Qestro and other products in copy;
  no code dependencies discovered.
- Qestro frontend onboarding components reference LunaOS dashboard as
  a design model (see Qestro `MIGRATION_NOTES.md`).
- A `pushci.yml` file at LunaOS root references PushCI configuration —
  cross-agent note for PUSHCI-OSS.

## Open handoffs

- Engine, agents, dashboard, studio, IDE bridges, mobile, vault, and
  docs are all currently siblings under one product root. As the
  workspace settles, consider whether any of these should graduate to
  their own product entry. Out of scope for round 4.
- `legacy/` harvest pattern documented in `CLAUDE.md`. Future PRs that
  elevate code from `legacy/` should update the Elevations section.
