# Microsoft 365 Lighthouse — Competitive Analysis for TenantIQ

> Compiled: 2026-05-04. All data drawn from public Microsoft Learn docs, Tech Community blog, and Microsoft Graph reference. URL cited per claim.
> Purpose: handle the universal buyer objection — "Microsoft already gives this to me free, why pay TenantIQ?"

## Product

Lighthouse is Microsoft's first-party multi-tenant admin portal for **CSP partners** managing **SMB** customers — "an admin portal that lets MSPs remotely manage multiple customer tenants … to secure and manage devices, data, and users at scale for small- and medium-sized business (SMB) customers." [Graph concept overview](https://learn.microsoft.com/en-us/graph/managedtenants-concept-overview)

Feature surface (verified against Microsoft Learn overview + What's-new):
- **Default SMB security baseline + custom baselines** — Microsoft-authored SMB baseline; users can clone, import, or build new baselines. [Baselines overview](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-deploy-standard-tenant-configurations-overview?view=o365-worldwide), [Create a baseline](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-create-a-baseline?view=o365-worldwide)
- **Drift detection vs assigned baseline** — surfaces which tasks/settings/users have drifted. No actor attribution and no generic one-click revert observed in docs. [Baselines overview](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-deploy-standard-tenant-configurations-overview?view=o365-worldwide)
- **Device compliance + Defender threat management** — multi-tenant view of compliance policies and Defender XDR Windows threats; requires Intune enrollment. [Overview](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-overview?view=o365-worldwide), [Requirements](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-requirements?view=o365-worldwide)
- **MFA / risky sign-ins / SSPR** — credential registration coverage + risky users. [Overview](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-overview?view=o365-worldwide)
- **Sales Advisor** — AI-driven renewal/upsell + Copilot opportunities (sales tooling, not security).
- **Executive Summary report** (Jan 2025) — per-tenant security/business posture report. [What's new](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-whats-new?view=o365-worldwide)
- **GDAP delegated-access management + RBAC roles** (Nov 2024) — Lighthouse Account Manager / Administrator / Author / Operator / Reader. [What's new](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-whats-new?view=o365-worldwide)
- **Service health + advisories** for managed tenants.

What Lighthouse does **not** ship (verified by absence in Microsoft Learn TOC + What's-new through May 2025): no CIS M365 Foundation Benchmark engine, no SOC 2 / HIPAA / GDPR / ISO 27001 control mapping, no mailbox-rule BEC auditor, no SAML metadata / federated-identity / cross-tenant-trust auditors, no public no-auth scan / prospect funnel, no MCP server / autonomous agent / developer-extensible skill marketplace, no license-tier upsell on remediation block, no public roadmap commitment to any of the above.

## Tech

- **Eligibility (gated)**: partner must be enrolled in **CSP program** (Direct-Bill or Indirect Reseller). Customer tenant must have **GDAP delegated access** and **≥ 1 license** of M365 Business Premium / E3 / E5 / Defender for Business / Windows 365 Business / Frontline / Education / Exchange Online. Hard cap: **≤ 2,500 licensed users per tenant**. Same geographic region as partner (Americas / EU / Asia+Australia). Tenants that don't meet requirements get only "limited experiences" — GDAP setup, user search, user details, tenant tagging, service health. The substantive value (baselines, drift, threats, devices) is gated on a paid M365 SKU. [Requirements](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-requirements?view=o365-worldwide)
- **API surface — Microsoft Graph `microsoft.graph.managedTenants`** namespace. **Beta only, MFA required, ~20 endpoints**, "not supported for production" per Microsoft's own warning. Covers `tenantRelationships/tenants`, device compliance trends, malware state, Windows protection state, risky users, credential registration summary. [Graph concept](https://learn.microsoft.com/en-us/graph/managedtenants-concept-overview), [managedTenant resource (beta)](https://learn.microsoft.com/en-us/graph/api/resources/managedtenants-managedtenant?view=graph-rest-beta)
- **No GA API, no MCP server, no public SDK** beyond standard MSGraph SDK. No webhooks for drift/alert events observable. Power Platform connector exists. [Tech Community](https://techcommunity.microsoft.com/blog/microsoft_365blog/introducing-the-microsoft-365-lighthouse-and-microsoft-power-platform-integratio/4069909)
- **Update cadence**: `whats-new` lists 1-3 small features per month, mostly Sales Advisor / tenant-details-page UX. Last entry **May 2025** (Edge AutoFill Credit Card + Enhanced Security Mode). No 2026 entries observed at compile time. Steady but slow on the **security** axis — 2024-2025 was dominated by sales/UX, not security depth. [What's new](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-whats-new?view=o365-worldwide)

## Business

- **Price**: $0 — no partner-tenant license, no per-customer fee, no per-user fee. [Overview](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-overview?view=o365-worldwide)
- **Vendor**: Microsoft — no vendor risk, no procurement friction, no MSA negotiation.
- **Funding model**: bundled into CSP economics. Microsoft's incentive is Business Premium / E3 / E5 attach + Copilot upsell via Sales Advisor, **not** advanced security tooling that would cannibalize paid Purview / Defender / Sentinel SKUs.
- **Target market**: SMB-focused CSP MSPs. The 2,500-user cap and SMB-baseline framing make it explicitly **not** for mid-market / enterprise MSPs running E5+Sentinel customers. Non-CSP MSPs, in-house IT teams, and security consultancies are ineligible.

## UX

- **Sign-up**: must already be a CSP partner with at least one delegated-access customer; sign-in only via partner-tenant credentials. [Sign up](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-sign-up?view=o365-worldwide)
- **Time-to-first-value**: gated by GDAP setup + customer SKU eligibility + Intune enrollment for device pages — multi-week onboarding common.
- **Documentation**: Microsoft Learn — broad, evergreen, conceptual; not OpenAPI-first. Beta API docs warn "use in production not supported".
- **Reported pain**: SMB-only ceiling; slow security-feature cadence; drift surface read-only with no revert; custom baselines require re-cloning when Microsoft updates a default task (May 2025 Edge + Dec 2024 MFA-for-admins both forced re-clones). [What's new](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-whats-new?view=o365-worldwide)

## Reverse positioning

What Lighthouse's structure implicitly admits:
- **"SMB-tailored baseline"** = Microsoft has decided not to build CIS / ISO / SOC 2 / HIPAA control mappings here. That's a deliberate scope choice — those frameworks live in Microsoft Purview Compliance Manager, a **paid** Microsoft product. Lighthouse is the on-ramp, Purview is the up-sell.
- **2,500-user cap + Business Premium minimum** = explicitly priced-out of the mid-market. Microsoft is happy to leave that segment to ISVs.
- **API still beta after 5+ years (Lighthouse GA was 2022)** = Microsoft is not investing in an extensibility surface. ISVs cannot build on Lighthouse.
- **"What's new" 2024-2025 dominated by Sales Advisor** = Microsoft's roadmap priority is Copilot/E5 attach revenue, not security-feature depth.
- **Re-clone-on-default-update churn** = baseline customization is brittle. Every Microsoft update breaks downstream custom baselines silently.
- **No drift actor attribution, no rollback** = Lighthouse can tell you something changed, but not who or how to undo it.

## Differentiation plan for TenantIQ

Frame this as a **decision tree**, not a feature war. Lighthouse wins on price and Microsoft-native integration for one customer profile; TenantIQ wins everywhere else.

**Lighthouse is the right answer if all of these hold**: you're a CSP partner, every customer has Business Premium / E3 / E5 / Defender for Business / Windows 365 / Frontline / EDU, every customer is < 2,500 users, and your security needs stop at Microsoft's SMB baseline + Defender threats + device compliance.

**TenantIQ wins if any of these is true**:
1. **No CSP, no Business Premium, or > 2,500 users** — Lighthouse is structurally unavailable. TenantIQ has no CSP gate, no customer SKU minimum, no user cap.
2. **CIS v3.1 with per-tenant overrides + audit-grade justification** — Lighthouse has SMB baselines, not CIS. TenantIQ ships ScubaGear-style per-control overrides (verified `apps/api/src/lib/cis/`, 1,667 LOC across 7 control-domain files).
3. **ISO 27001:2022 Annex A, SOC 2, HIPAA, GDPR** posture mapping — Lighthouse has none; Microsoft pushes you to paid Purview Compliance Manager. TenantIQ ships 25 telemetry-evaluable Annex A controls + 68 organisational + crosswalks.
4. **Drift attribution to actor + one-click revert** — Lighthouse shows drift; it doesn't say who changed it or let you undo.
5. **Mailbox-rule BEC auditor, federated-identity auditor, cross-tenant trust analyzer, SAML metadata auditor** — none of these are in Lighthouse.
6. **MCP server / autonomous agents / skill marketplace** — Lighthouse has no developer surface; its API has been beta for 5+ years.
7. **Public no-auth prospect scan** as a sales motion — Lighthouse is post-CSP-relationship only.
8. **License-tier upsell on remediation block** with concrete cost (TenantIQ's 402-with-cost UX) — Microsoft can't price this; they monetize elsewhere.
9. **CIS score trend with improving/regressing/stable verdict**, **AI-powered CIS control explainer**, **named drift baselines** — none in Lighthouse.

**Sales-page line**:
> M365 Lighthouse is free, and for a CSP partner managing all-Business-Premium SMB customers under 2,500 users, it's a fine starting point. Here's what it doesn't do: CIS v3.1 with per-tenant overrides, ISO 27001:2022 Annex A, SOC 2 or HIPAA mapping, drift attribution to the human who changed it, generic one-click revert, mailbox-rule BEC auditing, SAML metadata auditing, federated-identity auditing, public prospect scans, MCP, autonomous agents, or a production-supported API. TenantIQ does all of that — and works for non-CSP MSPs and customers without Business Premium.

**Don't compete on**: "free", "Microsoft-native", "no vendor risk". We lose all three.

**Compete on**: eligibility breadth (no CSP / SKU / size gate), compliance breadth (CIS + ISO + SOC 2 + HIPAA + GDPR vs SMB-baseline-only), detection depth (mailbox rules + federated identity + cross-tenant trust + SAML), operational depth (drift actor + revert), developer surface (MCP + skills + production API), sales motion (public no-auth scan + 402-with-cost).

## Sources

- [Microsoft 365 Lighthouse overview](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-overview?view=o365-worldwide)
- [Microsoft 365 Lighthouse requirements](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-requirements?view=o365-worldwide)
- [Microsoft 365 Lighthouse sign-up](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-sign-up?view=o365-worldwide)
- [Microsoft 365 Lighthouse FAQ](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-faq?view=o365-worldwide)
- [What's new in Microsoft 365 Lighthouse](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-whats-new?view=o365-worldwide)
- [Deploy standard tenant configurations (baselines)](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-deploy-standard-tenant-configurations-overview?view=o365-worldwide)
- [Create a baseline in Microsoft 365 Lighthouse](https://learn.microsoft.com/en-us/microsoft-365/lighthouse/m365-lighthouse-create-a-baseline?view=o365-worldwide)
- [Microsoft 365 Lighthouse API in Microsoft Graph (concept)](https://learn.microsoft.com/en-us/graph/managedtenants-concept-overview)
- [managedTenant resource type — Graph beta](https://learn.microsoft.com/en-us/graph/api/resources/managedtenants-managedtenant?view=graph-rest-beta)
- [Microsoft 365 Lighthouse + Power Platform integration](https://techcommunity.microsoft.com/blog/microsoft_365blog/introducing-the-microsoft-365-lighthouse-and-microsoft-power-platform-integratio/4069909)
- [Microsoft 365 Lighthouse: a new look and a bright future](https://techcommunity.microsoft.com/blog/microsoft_365blog/microsoft-365-lighthouse-a-new-look-and-a-bright-future/4089477)
- [CSP partner-facing Lighthouse page](https://microsoftpartners.microsoft.com/csp/m365-lighthouse/)
