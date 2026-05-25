# aegis.agent1 — Archived (worktree variant)

**Snapshot date:** 2026-05-25
**Snapshot type:** manifest-only (worktree variant; canonical original migrated under AMLIQ-TENANTIQ agent scope)
**Disposition:** worktree-variant

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/aegis.agent1/`
- **Commit SHA:** n/a (no .git; worktree copy)
- **Last commit:** n/a
- **Size on disk:** 41M
- **File count:** 2,173
- **Canonical original:** `portfolio/aegis/` (migrated to `products/amliq/api/`)

## Reason
Parallel-agent run variant from a past sprint loop (`*.agent1` / `*.agent2`
suffix convention). Per addendum §3 INFRA → ARCHIVE bucket: "All
*.agent1, *.agent2 directories → ARCHIVE → Worktree variants from
parallel-agent runs; snapshot and delete."

## Overlap assessment
This variant's content is a worktree-time clone of `aegis/`. Any
divergent work has either been merged into `aegis/` already (per merge
logs in `/portfolio/_merge_logs/`) or was discarded by the merge
arbiter. Not load-bearing.

## Suggested final disposition
**Delete after 30 days** once the canonical aegis → products/amliq/api/
migration is verified green by AMLIQ-TENANTIQ agent.
