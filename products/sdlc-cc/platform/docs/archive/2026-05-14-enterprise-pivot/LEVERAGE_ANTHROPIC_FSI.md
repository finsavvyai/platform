# Leveraging Anthropic's 2026-05-05 FSI Announcement

**Date**: 2026-05-05 (same day as the announcement)
**Source**: Anthropic email "Built for the way financial teams actually works"

## Three Anthropic moves to leverage

1. **Cowork financial agents** — pre-built templates deployable via Cowork or as Claude Managed Agents
2. **Claude as one agent across Excel/PowerPoint/Word/Outlook** — "most comprehensive M365 footprint of any AI in financial services"
3. **8 new data partners** — D&B, Fiscal AI, GLG, Guidepoint, IBISWorld, Verisk, SS&C, Moody's MCP, Third Bridge

## Strategic principle: ride the wave, don't fight it

Anthropic owns the model + the agent runtime + the M365 integration.
We own the layers that make those products deployable in regulated
industries. **Compete on dimensions Anthropic structurally cannot
build for** — fintech-vertical DLP, MSP-grade multi-tenant governance,
AML-domain knowledge.

## Per-product leverage

### sdlc.cc — DLP layer for Cowork financial agents

**What changes**: Cowork financial agents are now Anthropic's
flagship FSI offering. Banks will deploy them. Each agent calls
`api.anthropic.com` under the hood. Without a gateway, customer
PANs / IBANs / account refs flow upstream in raw form.

**Our wedge**: sit in front of Cowork agents via DNS hijack + TLS
termination. The bank's analyst uses Cowork normally; the agent
hits api.anthropic.com; corp DNS resolves that to sdlc.cc; we DLP
+ audit + forward. Same Cowork experience, regulator-grade data
hygiene.

**P0 to ship**: transparent-proxy mode in sdlc-cc (DNS+TLS termination).
Detailed in `aegis-cc` repo `docs/TRANSPARENT_PROXY_DEPLOY.md` (next
ship). Without this, sdlc.cc only catches Anthropic SDK + Claude Code
clients (those that respect `ANTHROPIC_BASE_URL`). With it, we catch
Cowork, Desktop, web app, browser extensions — every Anthropic surface.

**Pitch sharpening**:
- Old: "Compliance LLM gateway for FIs"
- New: "The DLP + audit layer for Anthropic's Cowork financial agents.
  Banks announced Cowork pilots in regulated environments need a
  compliance proxy in 30 days; we ship one today."

### TenantIQ — MSP control plane for Claude in M365

**What changes**: Anthropic now ships native Claude across
Excel/Word/Outlook/PowerPoint. TenantIQ's "AI for M365 management"
positioning is now competitive *with Anthropic itself*. Bad fight.

**Our reframe**: TenantIQ stops being "AI on M365" and becomes "the
multi-tenant MSP governance plane for the Claude-in-M365 deployments
Anthropic just shipped". MSPs need:
- Per-tenant policy (which agents allowed, which Claude features
  enabled, which data sources permitted)
- Per-tenant billing (the MSP charges its bank-customer for Claude
  usage; needs metering at the tenant level)
- Per-tenant audit (compliance proof of which agents touched which
  M365 surfaces in each tenant)
- Per-tenant DLP (chain to sdlc.cc when the customer is regulated)
- Per-tenant skill enablement (turn on FSI agents only for tenants
  whose end-customer is an FI)

Anthropic's M365 integration ships as ONE Claude per tenant. The MSP
managing 50 tenants needs a layer above to govern all 50 — that's
TenantIQ.

**Pitch sharpening**:
- Old: "AI-powered M365 management for MSPs"
- New: "Govern Claude across all your customers' M365 tenants. Policy,
  audit, billing, DLP integration with sdlc.cc — the MSP control plane
  for Anthropic's M365 release."

**Concrete next moves**:
- Update landing page (apps/web/src/routes) to lead with the new pitch
- Build per-tenant skill-enablement UI (existing skills/+page.svelte
  is the natural home)
- Surface a "Governance Dashboard" view of Claude usage across all
  managed tenants

### AMLIQ — entity intelligence ingestion from new data partners

**What changes**: 8 new MCP-connectable data sources, several of
them AML/KYC-relevant: D&B (commercial entity + business credit),
Moody's MCP (credit ratings), Fiscal AI (company fundamentals),
Verisk (insurance — speciality risks).

**Our wedge**: aegis already has MCP plumbing (`internal/mcp/`).
Adding these as ingestion sources makes AMLIQ entities richer than
any standalone AML platform. An AMLIQ entity for "Acme Corp" can
now show: AML hits + credit rating + business credit + officer
history + adverse media + M365 footprint (via TenantIQ join).

This is exactly the cross-portfolio data fusion that no
single-product competitor can match.

**Concrete next moves**:
- aegis MCP integration: add Moody's MCP server + D&B MCP server as
  named data sources in `internal/mcp/`
- Entity enrichment pipeline: when an AMLIQ entity is screened, pull
  credit + ratings data via MCP, attach to the entity record
- Customer-facing UI: entity detail page surfaces the enriched data
  alongside existing sanctions hits

Lower priority than sdlc.cc transparent-proxy + TenantIQ reposition —
this is a 1-week clean ship after those two land.

## Joint positioning — the three-piece kit

The pitch that survives across product boundaries:

> "Anthropic shipped Cowork financial agents this week. Three things
> need to be in place for a bank to actually deploy them in production:
> (1) DLP + audit on every prompt (sdlc.cc), (2) MSP-grade governance
> if the bank's IT is outsourced (TenantIQ), (3) AML-grade backend data
> for the agents to call out to (AMLIQ).
> 
> We're the three-piece kit that makes Anthropic's announcement
> deployable in regulated industries."

This is "compounding wedges, not head-on competition." Each product
makes Anthropic's offering MORE deployable, not LESS.

## Sales motion — the immediate move

Reach out within 7 days to:
1. **Existing AMLIQ pilot prospects** — frame as "the announcement
   means your Anthropic strategy needs DLP + audit; we already ship
   that"
2. **Israeli FIs you have warm intros at** — frame as "Cowork is
   coming, here's how to deploy it safely"
3. **MSPs you know managing M365 for FIs** — frame as the TenantIQ
   reposition

The window is now. Anthropic's marketing engine is going to push
Cowork hard for the next 90 days. Banks evaluating Cowork in that
window are exactly your ICP.

## Open decisions

1. **Cowork BASE_URL support** — verify with Anthropic SE this week.
   If yes, the bank's path-of-least-resistance changes.
2. **Direct ad presence** — should sdlc.cc landing page mention
   "for Cowork" prominently? Yes, but legally check Anthropic's
   trademark posture first.
3. **Webinar timing** — Anthropic hosts their FSI session May 7. If
   you can be on a follow-up webinar within 30 days as a Cowork
   compatibility partner, that's massive distribution.
4. **TenantIQ pivot speed** — do we ship the MSP-governance reframe
   in 1 week or 4 weeks? Sooner is better given Anthropic's
   marketing window.
