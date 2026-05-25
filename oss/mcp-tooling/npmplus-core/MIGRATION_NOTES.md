# npmplus-core — Migration Notes

## Source

| Source path | Date | Size | Target |
|---|---|---|---|
| /Users/shaharsolomon/dev/projects/02_AI_AGENTS/mcp-servers/npmplus-core | 2026-05-25 | 1.2M | oss/mcp-tooling/npmplus-core/ |

## Disposition (2026-05-25)

Folded under `oss/mcp-tooling/npmplus-core/` per May ranking memo.

### Status

- Feb 2026 ranking: 79/76
- **Last commit Aug 2025 (stale ~9mo)**
- May ranking memo: "Decision: fold under oss/mcp-tooling/ or archive if jpm supersedes."

### Recommended next step

Verify whether `oss/mcp-tooling/upm/` (Universal) + `oss/mcp-tooling/jpm/` (JS-specific) together supersede npmplus-core's scope. If yes: archive npmplus-core to `_archive/portfolio-snapshots/`. If npmplus-core has unique features (e.g., npm registry mirroring, dependency caching, plus-features beyond what UPM/jpm do): keep and refresh.

## Exclusions

Standard rsync excludes applied.
