# jpm (JavaScript Package Manager) — Migration Notes

## Source

| Source path | Date | Size | Target |
|---|---|---|---|
| /Users/shaharsolomon/dev/projects/02_AI_AGENTS/mcp-servers/javascript-package-manager | 2026-05-25 | 1.9M | oss/mcp-tooling/jpm/ |

## Disposition decision (May 2026 ranking memo, 2026-05-25)

Folded under `oss/mcp-tooling/jpm/` per memo recommendation:

- Feb 2026 ranking: 79/64 — production-ready, clean
- Sibling to UPM and npmplus-core; same mcp-tooling family
- MCP server for JavaScript package management

## Position

- `oss/mcp-tooling/jpm/` — JavaScript-specific MCP package manager
- `oss/mcp-tooling/upm/` — Universal package manager (#3 overall)
- `oss/mcp-tooling/npmplus-core/` — npm-specific MCP (older, possibly superseded by UPM)

Confirm with founder whether jpm's JS-specific specialization complements UPM's universal scope (keep both) or duplicates it (archive jpm).

## Exclusions

Standard rsync excludes applied.
