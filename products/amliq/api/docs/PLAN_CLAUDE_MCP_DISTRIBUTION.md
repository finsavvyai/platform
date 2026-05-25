# Plan — Claude MCP App + Cowork Compliance Template

**Status:** Proposed
**Created:** 2026-05-06
**Trigger:** Anthropic Briefing — Financial Services (2026-05-05)
**Memory:** `competitive_anthropic_finserv_briefing.md`
**Tasks:** see Sprint 9 in `docs/SPRINT_PLAN.md`

## Why

Anthropic launched Cowork + Claude Managed Agents with finserv-specific
templates and 8 native data partners (D&B, Moody's MCP, Fiscal AI,
Verisk, SS&C, GLG, Guidepoint, Third Bridge, IBISWorld). Counterparty
*data* is now built into Claude.

This commoditizes "look up an entity." To stay defensible, Aegis must:

1. **Live in the workflow**, not a separate dashboard → publish as a
   first-class Claude MCP app, the way Moody's did.
2. **Be the AML *judgment* layer**, not the data layer → expose the
   6-layer cascade, evidence, audit trail, ongoing-monitoring as MCP
   tools that data-only sources can't replicate.
3. **Plug into M365/Outlook** via Cowork agent templates so analysts
   hit Aegis without leaving their inbox.

If Aegis stays standalone, D&B + Moody's + Cowork collapse 60%+ of
buyer-perceived value into Claude itself.

## Scope (three deliverables)

**D1 — Public registered MCP server.** Today: `internal/mcp/` ships 5
tools (`screen_entity`, `check_pep`, `analyze_transaction`,
`get_entity_details`, `check_country_risk`) over a non-public binary.
Gap: TLS hostname, OAuth2 + per-tenant scoping, per-tool scopes,
LemonSqueezy meter hook, audit-log MCP resource, registry listing
(Anthropic Official + Smithery + Glama + mcp.so via
`luna-agents:ll-mcp-publish`).

**D2 — Two differentiation tools.** Data-only sources can't ship these.
- `explain_match` — given a match_id, return per-layer cascade
  (exact/fuzzy/phonetic/token/embedding/graph) with score, algorithm,
  matched substring, NL rationale. Audit-defense tool.
- `monitor_entity` — register entity for ongoing monitoring; push
  HMAC-signed webhook on list change / sanction add / PEP-tier change.
  Reuses existing webhook dispatcher.

**D3 — Cowork "Compliance Analyst" template.** Pre-configured agent
bundling Aegis MCP + Outlook + Excel + SharePoint. Flow: triage inbound
counterparty email → `screen_entity` → on hit, `explain_match` → draft
memo in Word with evidence + recommended disposition → on clear,
`monitor_entity`.

## Personas

P01 Sarah Cohen (Compliance Officer) · P02 Alex Petrov (Developer) ·
P05 Lisa Wang (Product Manager) · P09 Michael Torres (Enterprise Admin)
· P07 Yael Levi (Regulator/Auditor — for `explain_match`).

## Quality gates

Per `SPRINT_PLAN.md`: G1, G2, G4, G6, G7, G10. Plus new
**G11 MCP contract** — every tool ships with a recorded Claude-client
transcript proving end-to-end call from a Claude app.

## Out of scope

- Replacing Aegis dashboard UI (lives at `finsavvyai/amliq-frontend`).
- New pricing tier (handled in billing track).
- New sanctions list ingestion (see `ingestion_followups.md`).

## Risks

- **Anthropic ships native sanctions screener.** Mitigate: lock in
  registry presence + Cowork template before GA; lead with AML
  *judgment* (cascade, audit), not *data*.
- **MCP transport latency over hot path.** Aegis hot path is ~183µs;
  MCP tool-call adds network + serialization. Re-bench with envelope;
  target <100ms p95 end-to-end.
- **OAuth2 server is a real project.** Defer to Cloudflare Access or
  reuse `internal/auth` SAML if it can issue MCP tokens.

## Success metrics (90-day)

- 1+ listing on Anthropic Official MCP Registry.
- 10+ install events from outside the team.
- 1 design partner running the Cowork "Compliance Analyst" template
  end-to-end against real Outlook traffic.
- Marketing line: "ops-time saved per analyst" — needs instrumentation
  on `analyze_transaction` + `explain_match` invocations.

## Next

- Sprint 9 phase tasks landed in `SPRINT_PLAN.md` (S9-01 … S9-10).
- D1 tech spec to follow in `docs/MCP_PUBLIC_SERVER.md` once auth path
  (OAuth2 vs Cloudflare Access vs SAML reuse) is decided.
