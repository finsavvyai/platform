# MCP Tooling Migration Notes

## Source

- Path: `/Users/shaharsolomon/dev/projects/portfolio/mcpoverflow/`
- Commit SHA at copy time: `209847bbbab75bd341d5fd26ffdfd45aa7b7a274`
- Last commit timestamp: `2026-05-23T12:18:10+03:00`
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

- Source raw: 2.5 GB
- After exclusions: 74 MB
- File count: ~856

## Why renamed: mcpoverflow -> mcp-tooling

Per addendum §3:

> mcpoverflow | OSS | oss/mcp-tooling/ | Matches plan's "MCP tooling"
> OSS line

The brand `mcpoverflow` is the source name; the addendum places it
under the generic `oss/mcp-tooling/` slot because the consolidation
plan's OSS roster has a single line for "MCP tooling" rather than
brand-specific names. The bundled `package.json` still reads
`"name": "mcpoverflow"` — this is intentionally left intact for now.
Future decisions can either keep mcpoverflow as the canonical OSS
brand under the `mcp-tooling/` directory, or rename the package and
add a second brand.

## Workspace integration

- Root `oss/mcp-tooling/package.json` is named `mcpoverflow`. The
  outer `oss/*` workspace glob picks it up by directory, regardless
  of package name.
- No `@finsavvyai/*` imports detected in source. No workspace
  additions performed.

## Known issues / broken imports

- Files exceeding the 200-line cap: ~148. Pre-existing product code,
  copied as-is.
- Multiple deploy/dockerfile artifacts at root
  (`deploy-cloudflare.sh`, `docker-compose.*.yml`, `Dockerfile.*`)
  reference the old portfolio paths and infrastructure context.
  These will need triage before any production deploy attempt from
  the new monorepo.
- A stale deploy log (`deploy-staging-20251120-191616.log`) was
  copied — harmless, can be cleaned later.

## License + README

- LICENSE present in source.
- README present in source.

## Open handoffs

- The package is functionally an MCP toolset. Cross-coordination with
  Qestro (which ships an MCP server) and LunaOS (which orchestrates
  agents) is open work — out of scope for round 4.
- No new top-level deps introduced.
