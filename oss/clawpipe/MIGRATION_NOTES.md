# Clawpipe Migration Notes

## Sources

### Primary: clawpipe

- Path: `/Users/shaharsolomon/dev/projects/portfolio/clawpipe/`
- Commit SHA at copy time: `c27f3cbdd43456f449739800d36f41ec5adacf8e`
- Last commit timestamp: `2026-05-22T23:20:50+03:00`

### Sub-component: clawpipe-server

- Path: `/Users/shaharsolomon/dev/projects/portfolio/clawpipe-server/`
- Commit SHA at copy time: `61d1f21f0b384b670b50e0ba4a2a76b56965055c`
- Last commit timestamp: `2026-03-19T01:51:36+02:00`
- Target: `oss/clawpipe/server/`

### Sub-component: clawpipe-booster-benchmark

- Path: `/Users/shaharsolomon/dev/projects/portfolio/clawpipe-booster-benchmark/`
- Commit SHA at copy time: `efa8bb5cfc94cfcefac7c35365be26b00e230df7`
- Last commit timestamp: `2026-05-08T21:48:04+03:00`
- Target: `oss/clawpipe/benchmark/`

Migration date: 2026-05-25
Migrated by: QESTRO-LUNAOS agent (round 4)

## Method

`rsync -av` with the standard round-4 exclusions:

```
node_modules/  dist/  build/  coverage/  .git/  .wrangler/  .next/
venv/  vendor/  __pycache__/  *.log  .DS_Store  .pytest_cache/
.coverage  *.egg-info/
```

The two sub-components were copied first into their `server/` and
`benchmark/` subdirectories, then the root clawpipe rsync was run with
`--exclude=clawpipe-server/ --exclude=clawpipe-booster-benchmark/` to
avoid overwriting them.

Git history was NOT preserved.

## Sizes

| Source | Raw | After exclusions |
|---|---|---|
| clawpipe (root only) | 3.1 GB | ~893 MB |
| clawpipe-server | 407 MB | 98 MB |
| clawpipe-booster-benchmark | 44 MB | 5.5 MB |
| **Total `oss/clawpipe/`** | | **996 MB** |

File count after copy: ~17,631

## Workspace integration

- Root `oss/clawpipe/package.json` has name `clawpipe` and is picked up
  by the existing `oss/*` glob in `pnpm-workspace.yaml` — no edit
  required.
- The nested `oss/clawpipe/server/packages/control-hub-node/package.json`
  is named `@finsavvyai/control-hub-node`. This is the **only**
  `@finsavvyai/*` package brought in by clawpipe. Because the workspace
  glob is single-level it is NOT picked up at the root and therefore
  does NOT collide with the canonical packages in `/packages/`. If we
  later want it in the root workspace, this needs an explicit decision
  and a rename or scope-collision review.

## Known issues / broken imports

- An MS Office lock file (`~$clawpipe-audit-deck.pptx`) was copied at
  the root — harmless, can be cleaned up later.
- Files exceeding the 200-line cap: ~1,697. All are pre-existing prod
  code copied as-is.
- Multiple SDK subdirectories (`dotnet-sdk/`, `elixir-sdk/`, `go-sdk/`,
  `php-sdk/`) are language-specific clients. They are NOT built as
  part of the TS workspace.

## Cross-product references

- The internal `@finsavvyai/control-hub-node` package lives under
  `server/packages/`. It mirrors a naming convention used by the
  canonical platform packages. Future consolidation work should
  decide whether to dedupe.

## Open handoffs

- LICENSE present in source.
- README present in source.
- No new top-level deps introduced.
