# Syskit Point — Competitive Analysis for TenantIQ

> Compiled: 2026-05-04. All data drawn from public sources; URL cited per claim.
> Purpose: position TenantIQ against Syskit Point in the M365 governance / Copilot-readiness market.

## Product

Syskit Point pitches as "Microsoft 365 Governance and Security Simplified" — centralised inventory + policy automation + reporting across Teams, Groups, SharePoint, OneDrive, and Power Platform. [syskit.com/](https://www.syskit.com/)

Core surfaces:
- **Inventory + access management** — single pane across M365 workspaces, oversharing detection, external-user controls, real-time alerts. [syskit.com/products/point](https://www.syskit.com/products/point/)
- **Automated governance** — no-code policy rules applied across workspace lifecycles (creation → maintenance → disposal), naming policies, access reviews, storage optimisation. [syskit.com/products/point](https://www.syskit.com/products/point/)
- **Copilot Readiness Dashboard** — rules-based scan (not AI analysis): permission audit, sensitivity-label validation, removal of "anyone" links. Aligned to Microsoft's own readiness report rather than a proprietary benchmark. [syskit.com/blog/copilot-readiness-assessment](https://www.syskit.com/blog/copilot-readiness-assessment/), [syskit.com/blog/copilot-readiness-with-syskit-point](https://www.syskit.com/blog/copilot-readiness-with-syskit-point/)
- **AI Readiness / data-leak prevention** — tied to Copilot oversharing concerns; messaging is defensive ("prevent leaks when employees use AI"), not "AI runs the platform". [syskit.com/](https://www.syskit.com/)
- **Provisioning + Teams app** — request flow inside Microsoft Teams, Governance-plan-or-higher gate. [docs.syskit.com/.../syskit-point-teams-app](https://docs.syskit.com/point/governance-and-automation/syskit-point-teams-app/)
- **Vulnerabilities dashboard + auditing + alerts** — bundled into the Security plan. [syskit.com/pricing](https://www.syskit.com/pricing/)

MSP framing is **absent**. The site has no MSP page, no per-tenant pricing, no white-label, and no MSP partner program returned in searches. Logo wall is enterprise: LEGO, Coca-Cola, IBM, Lionsgate, Goodyear, IATA, Rimac, DP World. [syskit.com/](https://www.syskit.com/) Reseller-style messaging hits "3000+ enterprise customers." [softwarefinder.com/governance-risk-compliance-software/syskit-point](https://softwarefinder.com/governance-risk-compliance-software/syskit-point)

No CIS-benchmark-as-a-product surface. Search for `"Syskit Point" CIS benchmark` returned no first-party result — they speak in terms of Microsoft Secure Score, sensitivity labels, and oversharing, not CIS v3.1 controls. [google search trace] Compliance certifications they hold (SOC 2 Type 2, ISO 27001) refer to Syskit's own posture, not customer-facing benchmark engines. [syskit.com/products/point](https://www.syskit.com/products/point/)

## Tech

- **Public REST API** — OAuth 2.0 via Entra ID, bearer tokens, 4 granular scopes (`SharePoint.Read.All`, `Point.AsyncRequests`, `Point.Provisioning`, `Point.Admin`). **Provisioning, access management, and reporting only** — explicitly *not* general-purpose CRUD. Provisioning endpoints gated to Governance plan or higher. [docs.syskit.com/point/integrations/syskit-point-api](https://docs.syskit.com/point/integrations/syskit-point-api/)
- **Webhooks** — supported for event-driven integrations. [docs.syskit.com/point/integrations/syskit-point-api](https://docs.syskit.com/point/integrations/syskit-point-api/)
- **No GraphQL, no MCP, no public SDK** observable.
- **Mobile app** — none. Web-only; the only "mobile-adjacent" surface is the Teams app embed. [softwarefinder.com/governance-risk-compliance-software/syskit-point](https://softwarefinder.com/governance-risk-compliance-software/syskit-point)
- **Marketplace** — Syskit Point Enterprise listed on Azure Marketplace. [azuremarketplace.microsoft.com/.../syskit_point](https://azuremarketplace.microsoft.com/en-us/marketplace/apps/syskitltd.syskit_point) Microsoft 365 App Certification page exists. [learn.microsoft.com/.../syskit-point-cloud](https://learn.microsoft.com/en-us/microsoft-365-app-certification/saas/syskit-point-cloud)
- **SEO** — ranks for "M365 governance", "SharePoint permissions audit", "Copilot readiness assessment". Doesn't rank for "MSP M365" or "CIS Microsoft 365 benchmark" — those SERPs are owned by Lighthouse / Augmentt / Nerdio / CoreView.

## Business

- **Founded** — 2009 by Toni Frankola and Frane Borozan. HQ Zagreb, Croatia. [crunchbase.com/organization/acceleratio-ltd](https://www.crunchbase.com/organization/acceleratio-ltd)
- **Funding** — ~$9M total over 2 rounds, latest 2022-12-13 venture round. Investors include Cade Hill Investments and Redgate. No 2024-2026 round publicly disclosed. [crunchbase.com/funding_round/acceleratio-ltd-series-unknown--591ceb0b](https://www.crunchbase.com/funding_round/acceleratio-ltd-series-unknown--591ceb0b)
- **Headcount** — 63-75 employees (LinkedIn / Tracxn variance). [tracxn.com/d/companies/syskit](https://tracxn.com/d/companies/syskit/__oSh9_z4Ct22g3m0Idl6jOlE-HWgIj8H200tvmukz6-A)
- **Pricing — public.** Per-user-per-year, minimum 100 users. [syskit.com/pricing](https://www.syskit.com/pricing/)
  - Management: from €10/user/yr
  - Security: from €20/user/yr (auditing + alerts unlock here)
  - Governance: from €30/user/yr (recommended; lifecycle, policy automation, provisioning, Teams app)
  - Enterprise: custom, 1,000-user minimum, self-hosted Azure option
- **Target market** — mid-market and enterprise M365 governance teams. Logo set is enterprise; pricing minimum (100 users) excludes small MSP downstream tenants.
- **Growth signals** — steady product cadence, blog active, Copilot-readiness messaging is recent (2024-2025 push), no visible acquisition or megaround.

## UX

- **Sign-up friction** — 21-day free trial of the Governance edition, no credit card required. Self-serve sign-up at `demo.syskit.com/auth?startSignUpFlow=true`. Demo-data sandbox available without connecting a tenant. [syskit.com/products/point/free-trial](https://www.syskit.com/products/point/free-trial/), [docs.syskit.com/point/set-up-point-cloud/free-trial](https://docs.syskit.com/point/set-up-point-cloud/free-trial/)
- **Time-to-first-value** — sandbox demo data is immediate; trial requires Microsoft 365 tenant connection. Faster than CoreView's demo-only motion.
- **Documentation** — `docs.syskit.com` is open and reasonably structured. Swagger spec available at `<tenant>/swagger`. GitHub mirror `SysKitTeam/docs-point` exists. [github.com/SysKitTeam/docs-point](https://github.com/SysKitTeam/docs-point)
- **G2 / Gartner** — listed on G2 and Gartner Peer Insights; reviewers on Capterra/G2 broadly positive on reporting depth, with the typical "learning curve" complaint for governance tools. [g2.com/products/syskit-syskit-point/reviews](https://www.g2.com/products/syskit-syskit-point/reviews), [gartner.com/reviews/product/syskit-point](https://www.gartner.com/reviews/product/syskit-point)

## Reverse positioning

What Syskit's messaging implicitly admits:
- **No CIS engine.** They do "vulnerabilities dashboard" and "Microsoft Secure Score-aligned" reports — not CIS v3.1 control evaluation. The word "CIS" doesn't appear in product copy.
- **No autonomous AI.** Copilot Readiness is rule-based scanning, and the "AI" word is exclusively defensive (preventing Copilot data leaks). No agent, no NL admin assistant, no MCP.
- **Per-user pricing with a 100-user floor** — explicitly excludes the long tail of small-tenant MSP customers TenantIQ targets.
- **No MSP surface.** No partner program, no white-label, no per-tenant rollups, no cross-customer benchmark.
- **Public REST API is provisioning-scoped, not platform-scoped.** Cannot be used to build a third-party UI or MCP client on top.

What's missing vs TenantIQ:

| TenantIQ has | Syskit Point equivalent |
|---|---|
| MSP-native multi-tenant scope across N customer Azure tenants in one console | Single-tenant only — Enterprise plan adds self-hosted, not multi-customer rollup |
| Per-tenant CIS v3.1 overrides with audit-grade justification | No CIS engine at all |
| Drift attribution to actor via directoryAudits | Not advertised |
| ISO 27001:2022 Annex A control engine (25 telemetry-evaluable) | Syskit holds ISO 27001 internally; not surfaced to customers as a control engine |
| MCP server + autonomous agents with rollback | Absent — no MCP, no agent, defensive AI only |
| 6 MCP prompts wrapping skill templates | Absent |
| Public no-auth scan (`/api/mcp-public scan_domain`) | None — funnel is trial sign-up |
| Time-traveling agent at `/security/timewarp` (rebuild past tenant state from snapshots+drifts+audits) | Audit logs exist; no replay surface |
| Multi-agent debate mode (Conservative vs Pragmatic Claude) | Absent |
| License-tier upsell on remediation block (402 with concrete cost) | Per-user pricing makes this UX impossible |
| Account-deletion 33-table cascade with CI contract test (GDPR Art. 17) | Not advertised |
| Public `/leaderboard` with anonymised aggregate stats | Absent |
| Per-tenant agent activity feed at `/agents` (sub-second SSE via Durable Object) | Real-time alerts exist; no agent feed |
| Public per-tenant pricing $45-$99/mo with volume tiers | €10-€30/user/yr, 100-user minimum — fundamentally different unit economics |

## Differentiation plan for TenantIQ

1. **Attack the per-user-with-100-floor pricing.** Syskit is €10-€30/user/yr × 100 users minimum = €1,000-€3,000/yr floor *per customer tenant*. TenantIQ's $45-$99/mo per-tenant covers an entire SMB. Public pricing page should put both side-by-side. [syskit.com/pricing](https://www.syskit.com/pricing/)
2. **Own "MSP-native multi-tenant" outright.** Syskit has no MSP page, no cross-tenant rollup, no per-tenant pricing. Lead the homepage with "manage 50 customer tenants in one console" — Syskit structurally cannot match this without rebuilding their data model.
3. **Lead with a real CIS engine.** Syskit doesn't ship CIS v3.1 controls; they ship a vulnerabilities dashboard. Demo the per-tenant CIS overrides with audit-grade justification on `/security/cis` — a category Syskit doesn't compete in.
4. **Make MCP + autonomous agent the developer story.** Syskit's REST API is provisioning-scoped only. TenantIQ's MCP server + 6 prompt templates + skill marketplace is a developer surface they can't ship without an architecture change. Publish to MCP registry now.
5. **Beat their Copilot-readiness with AI-driven analysis.** Syskit's Copilot Readiness is rule-based permission scanning. TenantIQ's Claude-powered control explainer + multi-agent debate ("Conservative vs Pragmatic") is a category jump — a buyer evaluating both will see "rules vs reasoning."
6. **Time-traveling agent at `/security/timewarp` as the demo moment.** Syskit logs audit events; TenantIQ rebuilds any past tenant state from snapshots+drifts+audits. This is unattackable from a per-user-licensed legacy product.
7. **Public no-auth `scan_domain` as the funnel.** Syskit's funnel is a 21-day trial requiring Entra app registration. TenantIQ's public scan is zero-friction lead capture; pipe it into a `/leaderboard` with anonymised stats for organic SEO.
8. **ISO 27001:2022 Annex A engine as the SOC-2-adjacent buyer pitch.** Syskit holds ISO 27001 internally; TenantIQ ships it as a customer-facing control engine (25 telemetry-evaluable). Same buyer, different product depth.

Sources:
- [Syskit homepage](https://www.syskit.com/)
- [Syskit Point product page](https://www.syskit.com/products/point/)
- [Syskit Point pricing](https://www.syskit.com/pricing/)
- [Syskit Point free trial](https://www.syskit.com/products/point/free-trial/)
- [Syskit Point API docs](https://docs.syskit.com/point/integrations/syskit-point-api/)
- [Syskit Point Teams app docs](https://docs.syskit.com/point/governance-and-automation/syskit-point-teams-app/)
- [Copilot readiness assessment blog](https://www.syskit.com/blog/copilot-readiness-assessment/)
- [Copilot readiness with Syskit Point blog](https://www.syskit.com/blog/copilot-readiness-with-syskit-point/)
- [Free trial docs](https://docs.syskit.com/point/set-up-point-cloud/free-trial/)
- [Syskit Point on Azure Marketplace](https://azuremarketplace.microsoft.com/en-us/marketplace/apps/syskitltd.syskit_point)
- [Microsoft 365 App Certification — Syskit Point Cloud](https://learn.microsoft.com/en-us/microsoft-365-app-certification/saas/syskit-point-cloud)
- [Crunchbase — Syskit (Acceleratio)](https://www.crunchbase.com/organization/acceleratio-ltd)
- [Crunchbase 2022 venture round](https://www.crunchbase.com/funding_round/acceleratio-ltd-series-unknown--591ceb0b)
- [Tracxn — Syskit](https://tracxn.com/d/companies/syskit/__oSh9_z4Ct22g3m0Idl6jOlE-HWgIj8H200tvmukz6-A)
- [PitchBook — Syskit](https://pitchbook.com/profiles/company/223913-17)
- [G2 — Syskit Point reviews](https://www.g2.com/products/syskit-syskit-point/reviews)
- [Gartner Peer Insights — Syskit Point](https://www.gartner.com/reviews/product/syskit-point)
- [Software Finder — Syskit Point](https://softwarefinder.com/governance-risk-compliance-software/syskit-point)
- [GitHub — SysKitTeam/docs-point](https://github.com/SysKitTeam/docs-point)
