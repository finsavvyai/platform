# UPM (Universal Package Manager) — Migration Notes

## Source

| Source path | SHA | Date | Size | Target |
|---|---|---|---|---|
| /Users/shaharsolomon/dev/projects/03_Enterprize_application/products/devx-platform/upm | 99744789 | 2026-05-25 | 13M | oss/mcp-tooling/upm/ |

## Disposition decision (May 2026 ranking memo, 2026-05-25)

Originally missed by addendum §3. Ranked #3 overall in Feb 2026 portfolio assessment (86/88 — code 88, readiness 88, only gap was "Add LICENSE"). Folded under `oss/mcp-tooling/upm/` because:

- Developer tooling category
- OSS-shaped (no commercial backend; pure CLI/library)
- Complements existing mcp-tooling siblings (jpm, npmplus-core)
- Avoids creating a new top-level OSS package for a single tool

## Exclusions

Standard rsync excludes applied.

## Position

Sibling to:
- `oss/mcp-tooling/jpm/` (Feb 79/64, JavaScript package manager MCP)
- `oss/mcp-tooling/npmplus-core/` (Feb 79/76, npm MCP — stale Aug 2025; UPM may supersede)

If UPM supersedes the npmplus-core scope, mark npmplus-core for archive after verification.

## Known issues

- LICENSE was the sole gap flagged in Feb assessment — verify whether already added by upstream or still pending.
- May overlap conceptually with `jpm` (JS-specific) since UPM is "Universal" — confirm there's no duplication before public OSS release.

## Source preservation

Original at `/03_Enterprize_application/products/devx-platform/upm/` untouched.
