# flujo — Archived

**Snapshot date:** 2026-05-25
**Snapshot type:** manifest-only (source >100MB)
**Disposition:** off-thesis (flagged for possible LunaOS fold-in)

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/flujo/`
- **Commit SHA:** `577fb85b62037352d207d184c427c6b82e074231`
- **Last commit:** 2025-03-14 22:49:08 -0500
- **Size on disk:** 1.5G
- **File count:** 81,401

## README excerpt
```
# DISCLAIMER
====> FLUJO is still an early preview! <====

FLUJO is an open-source platform that bridges workflow orchestration,
Model-Context-Protocol (MCP), and AI tool integration. Unified
interface for managing AI models, MCP servers, and complex workflows
— all locally and open-source.

Powered by PocketFlowFramework, built with CLine.

SECURITY: extensive logging enabled by default exposes encrypted
API keys to terminal output.
```

## Reason for archiving (per addendum §3)
Addendum flags this as "ARCHIVE → or fold". Per the **'check if active
first; if so flag for fold-into-LunaOS instead'** instruction:

**Activity check:** Last commit 2025-03-14 — over 14 months stale. Not
active. → **Archive, do not fold.**

## Overlap assessment
There IS conceptual overlap with LunaOS (MCP orchestration + workflows),
but the implementation is built atop PocketFlowFramework + CLine — not
the architecture LunaOS is settling on. Harvesting code would cost more
than rebuilding clean inside LunaOS. The security note (logged API keys)
also disqualifies direct fold-in.

**Recommendation to LUNAOS team (out of scope here):** review flujo's
node/edge schema and visual flow JSON shape as prior art only; do not
import code.

## Suggested final disposition
**Delete after 90 days.** Preserve manifest for prior-art reference.
Large (1.5G), stale, security-flagged.
