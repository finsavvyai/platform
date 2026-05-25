# TokenForge Migration Notes

## Source

- Path: `/Users/shaharsolomon/dev/projects/portfolio/tokenforge/`
- Commit SHA at copy time: `5f66ba4093e58e8809f7bfc30babfbcbfda9c834`
- Last commit timestamp: `2026-05-02T17:38:11+03:00`
- Migration date: 2026-05-25
- Migrated by: QESTRO-LUNAOS agent (round 4)

## Method

`rsync -av` with the standard round-4 exclusions:

```
node_modules/  dist/  build/  coverage/  .git/  .wrangler/  .next/
venv/  vendor/  __pycache__/  *.log  .DS_Store  .pytest_cache/
.coverage  *.egg-info/
```

Git history was NOT preserved.

## Size

- Source raw: 414 MB
- After exclusions: 3.3 MB
- File count: ~445 (most of source bulk was node_modules)

## Workspace integration

- Root `oss/tokenforge/package.json` is named `tokenforge-monorepo`
  and uses its own internal `pnpm-workspace.yaml`. The outer
  monorepo's `oss/*` glob picks up the root package name only; the
  inner `packages/` are managed by tokenforge's own workspace
  configuration.
- No `@finsavvyai/*` imports in source. No outer workspace edits
  performed this round.

## Known issues / broken imports

- Files exceeding the 200-line cap: ~16. Pre-existing product code,
  copied as-is.
- The package has its own `pnpm-workspace.yaml` and `pnpm-lock.yaml`.
  Running `pnpm install` at the FinsavvyAI monorepo root will follow
  the outer workspace; running `pnpm install` inside
  `oss/tokenforge/` will follow the inner one. Document this in the
  README of tokenforge before users try to build it.

## License + README

- README present in source.
- LICENSE NOT present in source — see "License remediation" below.

## License remediation

Per round-4 conventions: "ensure LICENSE exists (Apache-2.0 default if
missing)." An Apache-2.0 LICENSE file has been added at
`oss/tokenforge/LICENSE` (default OSS license for FinsavvyAI per task
spec). The copyright holder is recorded as "FinsavvyAI" — adjust if
contributor attribution should be different.

## Strategic handoff (named in addendum)

Addendum §3 names tokenforge as "Telemetry SDK (plan's named OSS)".
This positions tokenforge as the public, open-sourced telemetry SDK
for the FinsavvyAI ecosystem.

Round 1 produced a hardened `@finsavvyai/telemetry` package at
`/packages/telemetry/` with the audit-log emitter and a redact module
(see round-1 swarm conventions). The intended end-state is:

- The canonical audit-log shape + redact utilities live inside
  tokenforge (open, public SDK).
- The hosted/private FinsavvyAI surfaces import or wrap tokenforge.

**Action for round 4 (this PR):** do NOT wire this up. Round 4 is
copy-only for OSS. The reconciliation between
`@finsavvyai/telemetry` and tokenforge is a separate planned task
that requires:

1. Surface comparison (what's in each, what overlaps).
2. License compatibility check (telemetry inherits portfolio
   licensing; tokenforge inherits Apache-2.0 going forward).
3. Decision on directionality (does telemetry depend on tokenforge,
   or vice versa, or both consume a shared `tokenforge-core`).
4. Migration of round-1 hardening (errors, stable codes, audit log
   contract) into the OSS surface without regressing test coverage.

That work is intentionally deferred — see `HANDOFF.md` for the
trigger conditions.

## Open handoffs

- See `oss/tokenforge/HANDOFF.md` (created this round) for the
  full reconciliation note.
- No new top-level deps introduced.
