# AutomationHub Migration Notes

## Source

- Path: `/Users/shaharsolomon/dev/projects/portfolio/automationhub/`
- Commit SHA at copy time: **N/A — repo has `.git/` but zero commits**
  (`fatal: your current branch 'main' does not have any commits yet`)
- Latest filesystem mtime: 2026-05-13 (top-level)
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

- Source raw: 4.8 GB
- After exclusions: 1.2 GB
- File count: ~11,193

## Workspace integration

- `oss/automationhub/` has no top-level `package.json` matching pnpm
  workspace shape (the project is partly Python). The `oss/*` glob
  will simply not match it as a TS package — no workspace entry
  required.
- No `@finsavvyai/*` imports detected in source. No workspace
  additions performed this round.

## Known issues / broken imports

- Mixed-language project (Python backend + Node Cloudflare workers).
  No build attempts performed this round per round-4 policy on Go/
  multi-language projects (treated analogously: copy-only).
- Files exceeding the 200-line cap: ~1,689. Pre-existing product
  code, copied as-is.
- The `automationhub.code-workspace` is a VS Code workspace pointer;
  paths inside may reference the old portfolio location and will
  break under the new tree. Update on first edit.

## License + README

- LICENSE present in source.
- `README.md` + `README_PRODUCTION.md` present in source.

## Why this is OSS, not a product

Per addendum §3: "Workflow primitives — useful base for LunaOS". The
move treats AutomationHub as a reusable workflow runtime that LunaOS
agents (and other products) can consume, rather than a standalone
end-user product. No customer-facing brand carried over.

## Open handoffs

- Future LunaOS work may absorb parts of AutomationHub into
  `lunaos-engine` or `luna-agents`. Coordination owner: LunaOS
  maintainers.
- The Cloudflare-workers subtree (`cloudflare-workers/`) overlaps in
  concept with the canonical `infrastructure/cloudflare/`. Triage
  before any deployment integration.
