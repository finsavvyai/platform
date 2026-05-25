# queryflux-git — Archived

**Snapshot date:** 2026-05-25
**Snapshot type:** manifest-only (source >100MB)
**Disposition:** off-thesis (overlap-checked for product fold-in)

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/queryflux-git/`
- **Commit SHA:** `5110dcf5f83940e5e118a981c1d608a58b234a5f`
- **Last commit:** 2026-05-23 16:44:37 +0300
- **Size on disk:** 578M
- **File count:** 37,126

## README excerpt
```
# QueryFlux

The AI-native database workspace for builders shipping apps with agents.

Database workspace for the vibecoding era: connect real databases,
understand schemas instantly, ask questions in natural language,
generate safe SQL, create backend code from database context, expose
scoped tools to AI coding agents through MCP.

Product Pillars:
- Talk To Your Database (schema-aware chat, NL→SQL, repair, optimize)
- Generate The Backend (REST, types, Prisma/Drizzle/SQLAlchemy/GORM)
- Ship Safely (destructive-query guardrails, env awareness, approval flows)
```

## Reason for archiving (per addendum §3)
Addendum: "queryflux, queryflux-git, querylens → ARCHIVE → or fold;
likely fold one into a product, archive duplicates."

## Overlap assessment (REQUIRED by addendum)
QueryFlux is the substantive repo of the trio. Recent commits (within
days). Positioning **does** intersect FinsavvyAI thesis:

- "AI-native" → on-thesis vocabulary
- "MCP tools for AI coding agents" → overlaps with `oss/mcp-tooling/`
- "approval flows for risky changes" → overlaps with PushCI gate model
- "human and agent audit logs" → overlaps with platform audit-log
  convention

**Possible fold targets:**
1. `oss/mcp-tooling/` — if QueryFlux's MCP server is well-isolated
2. `products/lunaos/` — as a database-runtime module
3. **Standalone product** — could become a 7th CORE product (vs current 7)

**Not appropriate for this agent to decide.** The fold-vs-archive
decision requires founder + product-strategy review. This snapshot
preserves the manifest so the decision is not blocked by deletion.

## Suggested final disposition
**Preserve 90+ days, do not delete.** Active code, on-thesis vocabulary,
genuine product overlap. Escalate fold-vs-archive decision to founder
before any deletion.
