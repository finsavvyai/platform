# Claude for Startups — Application Draft

*For submission to anthropic.com/startups. Last updated 2026-05-06.*

---

## Company

**Name:** TenantIQ
**Founded:** 2026 (active development; production live at api.tenantiq.app + app.tenantiq.app)
**Stage:** Pre-seed / bootstrap
**Website:** https://app.tenantiq.app
**Compare page:** https://app.tenantiq.app/compare
**Founder:** Shahar Solomon — info@finsavvyai.com

## One-line

The Microsoft 365 control plane for MSPs managing other people's tenants — the part Claude in M365 can't do at scale.

## Why Claude

TenantIQ is **Claude-API-first**. Every customer-facing AI surface in the product is Claude:

- **CIS control explainer** — Claude per-finding, tenant-context-aware (POST `/api/cis-benchmark/explain`). 24h KV cache, 3-tier degradation (Claude → cache → static fallback).
- **Compliance gap explainer** — same pattern across SOC 2 / HIPAA / GDPR / ISO 27001 (POST `/api/compliance-posture/explain`).
- **Anomaly detection narration** — Claude summarizes login anomalies + activity spikes for MSP technicians.
- **Skill marketplace + agent templates** — Claude-shaped task bundles for onboarding, compliance review, license audit, incident response.

We also use a smart-router (`packages/ai/src/router`) that defaults to Claude and falls back to Gemini / Groq / DeepSeek only when Claude is unreachable. Anthropic Claude is ~95% of inference volume.

## Production scale (verified 2026-05-06)

- **Tests:** 1517 passing
- **Test files:** 165
- **API route TS files:** 197
- **D1 tables:** 34, with a 33-table account-deletion cascade contract test
- **CIS controls evaluated against live Graph data:** 31+
- **Cron jobs:** 26
- **Live customer surfaces:** api.tenantiq.app, app.tenantiq.app
- **Public no-auth scan:** /api/prospect/scan (5/hr/IP rate-limited)

## What Claude credits would unlock

1. **Wider AI explainer coverage.** Today CIS + compliance get Claude. Adding Defender XDR, Intune, PIM (~3,500 controls × tenant-context tokens) is the next step but needs ~10× current spend.
2. **Per-customer tenant briefings.** Weekly Claude-authored executive summary per tenant, mailed by the MSP. Templated but tenant-specific.
3. **MCP server for TenantIQ** — see below. Becomes a first-class data source inside Claude clients (Cowork, Claude Managed Agents).

## Why TenantIQ wins as an Anthropic customer story

The 2026-05-05 *"Claude for Financial Services"* launch named 8 data partners and customer wins (IG Group 70hr/wk, Travelers −30% handle time). The MSP vertical needs the equivalent — a named co-customer that runs Claude in production at scale across N customer tenants.

TenantIQ's metrics map cleanly:
- **CIS control resolution time:** measurable improvement when AI explainer is on vs off (track via `remediation_log`).
- **Tenant onboarding minutes-to-value:** 10 min via the agent template, vs 2–3 hours manual.
- **Compliance review labor:** SOC 2 + HIPAA + GDPR + ISO 27001 review goes from days to ~6 minutes per tenant.

## Ask

- **API credits:** $5,000–$10,000 to fund the explainer expansion (item 1 above).
- **MCP server registration / partnership listing** alongside Moody's, D&B, etc.
- **Customer-story slot** in Anthropic's MSP / IT-services vertical content track (mirror the Travelers/IG Group format).

## Materials available

- Full source repo (private GitHub); read-only clone for review on request.
- Live production access (api.tenantiq.app + app.tenantiq.app) — public scan endpoint open.
- Internal honesty-pass docs (`.luna/tenantiq/no-bluf-report.md`) showing zero AI-generated bluff in commits.
- Architecture diagram + cert-prep evidence bundle (`scripts/cert-evidence-bundle.ts` output).

---

## Submission checklist

- [ ] Paste short answers into anthropic.com/startups form
- [ ] Attach: Compare page URL, /scan/microsoft.com result URL, GitHub repo invite
- [ ] Reference 2026-05-05 finserv launch in cover note ("MSP vertical equivalent")
- [ ] Follow up at the 2026-05-07 webinar with practitioner team
