# Claude for Startups — Submission Packet

**Submission target:** anthropic.com/startups (or partnerships@anthropic.com if no public form)
**Submitted by:** Shahar Solomon · info@finsavvyai.com
**Date prepared:** 2026-05-06

---

## Cover note (paste into form's free-text or send as email body)

> I'm submitting TenantIQ for Claude for Startups. We are the MSP-vertical equivalent of the customer story arc from your 2026-05-05 *Claude for Financial Services* launch — a Claude-API-first product that runs in production today, with concrete latency / labor metrics MSPs care about and an MCP server already exposing TenantIQ as a Claude data source.
>
> The wedge: when Anthropic shipped Claude-as-one-agent across M365 (Excel/Word/PowerPoint/Outlook), "AI inside one customer's tenant" became commoditized. MSPs manage 9–250+ Azure tenants concurrently — that's the surface horizontal Claude doesn't address. TenantIQ ships the multi-tenant control plane: per-tenant CIS overrides, drift attribution, license-tier gating, cross-tenant rollups, and now an MCP server (HTTP + SSE transports) so Claude clients (Cowork, Claude Managed Agents, Claude Desktop) can read and write TenantIQ posture directly.
>
> Three asks below; the most important is the MCP partnership listing. We're funding all current Claude API spend out of pocket and the model is already integral to the product.

---

## Short answers (mirror the form fields)

| Field | Answer |
|---|---|
| Company name | TenantIQ |
| Website | https://app.tenantiq.app |
| Compare page (positioning) | https://app.tenantiq.app/compare |
| Public scan demo (no signup) | https://app.tenantiq.app/prospect → output e.g. https://app.tenantiq.app/scan/microsoft.com |
| Founder | Shahar Solomon |
| Founder email | info@finsavvyai.com |
| Stage | Bootstrap / pre-seed |
| Vertical | MSP / IT-services security |
| Customer | MSPs managing 9–250+ M365 tenants |
| Production status | Live: api.tenantiq.app + app.tenantiq.app |
| Tests passing | 1571 (workspace 1932 incl. packages + web) |
| Anthropic spend | ~95% of inference; smart-router falls back only when Claude is unreachable |

## Why Claude (concrete surfaces)

1. **Per-control AI explainer** — `POST /api/cis-benchmark/explain`, `POST /api/compliance-posture/explain`. Claude-generated, tenant-context-aware, KV-cached 24h, 3-tier degradation (Claude → cache → static fallback).
2. **Anomaly narration** — Claude summarizes login + activity anomalies for MSP technicians.
3. **MCP server** — `https://api.tenantiq.app/api/mcp`. JSON-RPC 2.0 + Streamable HTTP + SSE. 13 tools (10 read + 3 write), 3 resources. Long-lived API keys at `/settings/api-keys`. **Already spec-compliant against modelcontextprotocol.io 2025-06-18.** This is the integration we want listed.
4. **Smart-router** with Anthropic as default; we instrument fallbacks so Anthropic remains the canonical path.

## Production scale (verified 2026-05-07)

- 1,571 unit + integration tests passing across 173 test files (apps/api)
- Workspace total: 1,932 passing (api 1,571 + web 150 + 6 packages 211)
- 224 API route TS files, 102 web pages, 196 Svelte components
- 34 D1 tables, 26 migrations, 21 cron jobs, 8 queue handlers
- 33-table account-deletion cascade contract test (M365 Cert C7, GDPR Art. 17)
- 31+ CIS controls wired to live Microsoft Graph data (CIS v3.1, L1+L2 tagged)
- 4 compliance frameworks (SOC 2 / HIPAA / GDPR / ISO 27001:2022 Annex A)
- 9 competitor frames covered on /compare with cited research dossiers
- Public no-auth scan: 5 scans/hr/IP rate-limited
- Daily smoke against prod via GitHub Actions cert-status workflow
- Public /changelog driven by git log; weekly cadence visible

## Three asks

1. **MCP partnership listing** alongside Moody's / D&B / GLG / etc. We already implement the spec; we just need to be discoverable from Cowork + Claude Desktop directories.
2. **API credits** ($5k–$10k) to fund explainer expansion to Defender XDR, Intune, and PIM (~3,500 controls × tenant-context tokens). Today only CIS + 4 compliance frameworks have AI explainers.
3. **Customer-story slot** in the MSP / IT-services vertical content track — the IG Group / Travelers format with TenantIQ metrics:
	- CIS control resolution time (with vs without AI explainer, tracked in `remediation_log`)
	- Tenant onboarding minutes-to-value: ~10 min via the agent template, vs 2–3 hr manual
	- Compliance review labor: SOC 2 + HIPAA + GDPR + ISO 27001 review goes from days to ~6 min/tenant

## Materials available on request

- Read-only GitHub clone of the monorepo (private) — invite issued on confirmation.
- Live tenant access credentials for hands-on review.
- Honesty-pass artifacts (`.luna/tenantiq/no-bluf-report.md`) showing every commit's claims verified against code.
- Architecture diagram + cert-prep evidence bundle (`scripts/cert-evidence-bundle.ts` output).

## Demo URLs (no signup, all verified live 2026-05-07)

- **Compare page** — https://app.tenantiq.app/compare (9 competitor frames)
- **CISO demo (15-min walkthrough)** — https://app.tenantiq.app/ciso-demo
- **Public scan with agent narration (SSE)** — https://app.tenantiq.app/scan/microsoft.com (try any domain)
- **OG image (dynamic SVG)** — https://api.tenantiq.app/api/prospect/og.svg?domain=microsoft.com
- **Aggregate live counters** — https://app.tenantiq.app/leaderboard
- **Changelog (weekly cadence visible)** — https://app.tenantiq.app/changelog
- **MCP public endpoint (no auth, scan_domain tool)** — `curl -X POST https://api.tenantiq.app/api/mcp-public -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'`
- **MCP gated endpoint (returns 401 unauthenticated, proves auth gate)** — `curl -X POST https://api.tenantiq.app/api/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'`
- **Demo MCP key for Claude Desktop (read-only synthetic data)** — `tiq_demo_visitor_2026` against the gated `/api/mcp` endpoint

## Submission steps

1. Paste cover note into the form's free-text field (or use as email body to partnerships@anthropic.com if no form).
2. Fill in form fields from the table above.
3. Attach links: `/compare`, `/scan/microsoft.com`, MCP_CONNECTION.md (or paste URL once published).
4. Reference the May 7 webinar in the cover — confirm whether MCP partner list is part of that announce.
5. Follow up at the webinar Q&A with one practitioner question that ties TenantIQ to the MSP vertical.

---

## Pre-submission smoke (last run 2026-05-07, all green)

```bash
# All five should print HTTP 200 except the last (401 = correct, proves gate)
for u in https://app.tenantiq.app/compare \
         https://app.tenantiq.app/ciso-demo \
         https://app.tenantiq.app/scan/microsoft.com \
         https://app.tenantiq.app/leaderboard \
         https://api.tenantiq.app/api/prospect/og.svg?domain=microsoft.com; do
  curl -s -o /dev/null -w "%{http_code} $u\n" "$u"
done
curl -s -o /dev/null -w "%{http_code} /api/mcp-public (expect 200)\n" \
  -X POST https://api.tenantiq.app/api/mcp-public \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
curl -s -o /dev/null -w "%{http_code} /api/mcp gated (expect 401)\n" \
  -X POST https://api.tenantiq.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

## Submission steps (do these in order)

- [ ] Run the smoke block above. Confirm 200 / 200 / 200 / 200 / 200 / 200 / 401.
- [ ] Open https://anthropic.com/startups (or partnerships@anthropic.com if no public form).
- [ ] Paste the cover note from this doc into the form's free-text field.
- [ ] Fill the form fields from the short-answer table.
- [ ] Reference the 2026-05-05 finserv launch in the cover note.
- [ ] Attach links: `/compare`, `/ciso-demo`, `/scan/microsoft.com`, `/changelog`.
- [ ] Submit.
- [ ] Email partnerships@anthropic.com a copy with subject "TenantIQ — MSP-vertical equivalent of finserv launch (Claude for Startups submission)" — covers the case where the form gets lost in the queue.
- [ ] Update `.luna/tenantiq/strategy/2026-05-05_anthropic_finserv_response.md` Move 4 status to "submitted YYYY-MM-DD".
- [ ] Tweet / LinkedIn-post the submission with `/compare/horizontal-ai` as the artifact, tagging @anthropicai. Even if Anthropic doesn't respond, the public attempt is content.
