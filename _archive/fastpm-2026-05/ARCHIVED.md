# autoboot (FastPM product) — Archived

**Snapshot date:** 2026-05-25
**Snapshot type:** manifest-only (source >100MB)
**Disposition:** parked-domain

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/autoboot/`
- **Commit SHA:** `4bff57dd20e381f57cc16ff8c3c3de333ac0fe79`
- **Last commit:** 2026-01-07 20:43:11 +0200
- **Size on disk:** 6.7G
- **File count:** 117,615

## README excerpt
```
# FastPM MCP Server

> Automatic development server restart with intelligent project detection

FastPM is a Model Context Protocol (MCP) server that automatically detects
your project type and provides seamless development server restart
capabilities. Perfect for AI-assisted development workflows where you want
instant server restarts after code changes.

Hosted at https://fastpm.dev/.netlify/functions/mcp (domain parked).
```

## Reason for archiving (per addendum §3)
The FastPM product itself is archived because `fastpm.dev` is a parked
domain. **Per addendum**: the `autoboot` directory name is also reused as
an active sprint/automation harness (see INFRA table); this archive
entry retires the **product framing** only — the harness usage stays
live in `/portfolio/autoboot/` and is not migrated by this agent.

## Overlap assessment
The same `autoboot/` directory currently serves two roles:
1. FastPM MCP product (this archive entry)
2. Active sprint/automation harness (per addendum INFRA bucket)

Out of scope to disentangle here — addendum already flags it. Suggested
follow-up: a future swarm should fork the harness portion into a clean
INFRA tree before the source repo is deleted.

## Suggested final disposition
**Preserve original ≥90 days.** Two reasons:
1. Dual-role with active INFRA harness — premature deletion risks
   breaking sprint tooling.
2. Large repo (6.7G, 117k files); manifest carries only minimal metadata.
   If anyone needs the FastPM product code later, it must come from the
   original tree.

After harness disentanglement (out-of-scope ticket): delete the product
portion only, retain the harness.
