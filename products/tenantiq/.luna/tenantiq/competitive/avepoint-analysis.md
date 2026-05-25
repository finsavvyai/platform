# AvePoint — Competitive Analysis for TenantIQ

> Compiled: 2026-05-04. All data drawn from public sources; URL cited per claim.
> Purpose: position TenantIQ against AvePoint (NASDAQ: AVPT) — the largest pure-play M365 governance vendor and TenantIQ's most credentialed competitor.

## Product

AvePoint's master narrative is the **Confidence Platform** — pitched as a "Unified Data Protection Platform for Enterprise" delivering integrated security, governance, and resilience across Microsoft 365, Google Workspace, Salesforce, Dynamics 365, Azure, Entra ID, and Power Platform. [avepoint.com](https://www.avepoint.com/), [avepoint.com/products/confidence-platform](https://www.avepoint.com/products/confidence-platform)

Surfaces inside Confidence Platform (12 modules listed publicly):
- **Cloud Backup & Ransomware Defense / Express Recovery** — anchor business; FedRAMP-authorized.
- **Records & Information Lifecycle Management** — defensible deletion, retention/classification, GDPR/HIPAA evidence reports. [avepoint.com/solutions/information-lifecycle-compliance](https://www.avepoint.com/solutions/information-lifecycle-compliance)
- **Policy Enforcement & Drift Control** — drift detection, baseline restore. [avepoint.com/products/policy-enforcement](https://www.avepoint.com/products/policy-enforcement)
- **Data & Security Insights** — DSPM-style risk + sensitivity scoring; integrates Microsoft 365 Retention Labels.
- **Cense** — license/cost management with user-level activity, Copilot engagement, AI license recommendations, one-click adjustments. **Not an AI agent** despite frequent confusion — it's a license-optimization product. [avepoint.com/products/license-management](https://www.avepoint.com/products/license-management)
- **AgentPulse Command Center** — AI-agent registry + governance. **GA 2026-03-09.** Multicloud (Copilot Studio, Microsoft Foundry, SharePoint agents, Vertex AI). Functionally **observability + policy enforcement**, not an autonomous operator. [globenewswire.com — AgentPulse GA](https://www.globenewswire.com/news-release/2026/03/09/3251900/0/en/AvePoint-Announces-General-Availability-of-AgentPulse-Command-Center-with-Multicloud-Agentic-AI-Governance.html), [avepoint.com/solutions/agentic-ai-governance](https://www.avepoint.com/solutions/agentic-ai-governance)
- **Elements Platform** — dedicated MSP-facing surface: User & Device Management, Workspace Management, Baseline Management. Pitched as "built for MSPs to standardise service delivery, automate compliance, and operate securely at scale." [avepoint.com/products/elements](https://www.avepoint.com/products/elements), [avepoint.com/solutions/multi-tenant-management](https://www.avepoint.com/solutions/multi-tenant-management)

**Ydentic acquisition (closed Jan 2025, not 2022)** brought hybrid IAM and multi-tenant user/device management; folded directly into Elements. [avepoint.com/news/avepoint-expands-ai-driven-cybersecurity-and-it-management-capabilities-with-ydentic-acquisition](https://www.avepoint.com/news/avepoint-expands-ai-driven-cybersecurity-and-it-management-capabilities-with-ydentic-acquisition)

**MSP framing is real, not bolt-on.** Elements has a brochure, baseline-for-MSPs blog, and a 5,000-MSP channel program — substantively deeper MSP-positioning than CoreView. Baseline Management page advertises drift detection, similarity-based matching (April 2026 release), and onboarding templates. [avepoint.com/products/elements/baseline-management](https://www.avepoint.com/products/elements/baseline-management), [avepoint.com/blog/msp-and-channel/elements-platform-updates-april-2026](https://www.avepoint.com/blog/msp-and-channel/elements-platform-updates-april-2026)

**CIS Benchmark coverage** — not publicly observable as a first-class engine. AvePoint baselines are template-and-drift, not control-by-control CIS evaluators with override audit. CIS surfaces only as one framework among many ("NIST, CIS") in marketing prose. [avepoint.com/products/elements/baseline-management](https://www.avepoint.com/products/elements/baseline-management)

## Tech

- **Public REST API** — `AvePoint Graph API` at `graph-{dc}.avepointonlineservices.com`, OAuth 2.0, client-secret or X.509 cert, TLS 1.2+, app-registration flow via AOS. Docs at `learn.avepoint.com/docs` and source on `github.com/AvePoint/cloud-api`. Substantively deeper than CoreView's workflow-trigger-only API. [learn.avepoint.com/docs/Overview.html](https://learn.avepoint.com/docs/Overview.html), [github.com/AvePoint/cloud-api](https://github.com/AvePoint/cloud-api)
- **No public MCP server** observable. AgentPulse governs AI agents but does not expose AvePoint itself as an MCP tool surface for third-party agents.
- **Mobile** — Office Connect for iOS/Android exists for end-user file access; **no native admin mobile app** observable. [appsource.microsoft.com — AvePoint Office Connect](https://appsource.microsoft.com/en-us/product/office/wa104381806)
- **Compliance posture** — FedRAMP (Moderate) Authorized since April 2021, sponsored by Department of Energy; **19 SaaS solutions on Confidence Platform are FedRAMP-Moderate authorized**; moving toward StateRAMP, TX-RAMP, DoD IL5/IL6. AOS-UG (US Gov) listed FedRAMP **High** on the FedRAMP Marketplace. ISO 27001:2022, ISO 27701, ISO 27017, SOC 2 Type II, CSA STAR L2, IRAP. [avepoint.com](https://www.avepoint.com/), [avepoint.com/blog/public-sector/fedramp-authorization-expansion](https://www.avepoint.com/blog/public-sector/fedramp-authorization-expansion), [fedramp.gov/marketplace/products/FR2025827270A](https://www.fedramp.gov/marketplace/products/FR2025827270A/), [avepoint.com/solutions/public-sector/federal](https://www.avepoint.com/solutions/public-sector/federal)
- **Microsoft Marketplace** — multiple listings live (Cense for M365, EnPower, AvePoint Cloud Management for Office 365). Microsoft's `adoption.microsoft.com` features AvePoint as a partner spotlight. [marketplace.microsoft.com — Cense](https://marketplace.microsoft.com/eu-es/product/saas/avepoint.cense_m365)

## Business

- **Public company** (NASDAQ: AVPT). **Q4 2025**: $114.7M revenue (+29% YoY); SaaS $88.9M (+37%); Total ARR $416.8M (+27%); Net New ARR $26.8M (+48%). **2026 guidance**: $509-517M revenue (+22% midpoint), ARR $525-531M (+27% midpoint). [signalbloom.ai — AvePoint Caps Strong 2025](https://www.signalbloom.ai/news/AVPT/avepoint-caps-strong-2025-with-29-q4-revenue-growth-guides-for-accelerated-momentum-in-2026), [fool.com — AVPT Q4 2025 transcript](https://www.fool.com/earnings/call-transcripts/2026/02/26/avepoint-avpt-q4-2025-earnings-call-transcript/)
- **Headcount ~3,043** (Dec 2025), 16-17% YoY growth for 3 consecutive years. ~5,000 channel partners, 25,000+ customers. [unifygtm.com — AvePoint headcount](https://www.unifygtm.com/insights-headcount/avepoint), [avepoint.com/solutions/multi-tenant-management](https://www.avepoint.com/solutions/multi-tenant-management)
- **Pricing** — public page is "Let us craft a unique plan." No dollar floors, no tier ladder, no public per-user/per-tenant rates. Models advertised: per-user, per-data-volume, or per-usage. [avepoint.com/pricing](https://www.avepoint.com/pricing)
- **Target market** — primarily large-enterprise + regulated/public-sector. Federal references include U.S. Treasury, IRS, NASA, U.S. Department of State, National Endowment for the Humanities. **GE Aerospace / DOD direct case studies not publicly observable** (DOD references are aggregate "1,000+ public-sector orgs"). [avepoint.com/solutions/public-sector/federal](https://www.avepoint.com/solutions/public-sector/federal), [carahsoft.com/avepoint](https://www.carahsoft.com/avepoint), [prnewswire.com — AOS-UG FedRAMP](https://www.prnewswire.com/news-releases/avepoint-online-services-for-us-government-achieves-fedramp-authorization-301262078.html)

## UX

- **No self-serve trial for Confidence Platform**; AgentPulse advertises "free trial — see your AI agents now" but Confidence Platform proper is demo-gated. [avepoint.com/solutions/agentic-ai-governance](https://www.avepoint.com/solutions/agentic-ai-governance)
- **Time-to-first-value** — gated by sales for the full platform.
- **Documentation** — `learn.avepoint.com` is reasonably deep; PDF Graph API spec and GitHub mirror exist. Better developer surface than CoreView.
- **G2 / Gartner pain points** (Confidence Platform reviews): "long set-up and learning curve," "customer support unresponsive and ineffective," "cost goes up if you need all the advanced options," "licensing has been a pain to keep updated," "interface less intuitive at first," "occasional slow restores or lag," "data governance policies not 1:1 with the options offered." [g2.com/products/avepoint-confidence-platform/reviews](https://www.g2.com/products/avepoint-confidence-platform/reviews), [gartner.com — AvePoint reviews](https://www.gartner.com/reviews/market/data-security-posture-management/vendor/avepoint/product/avepoint-confidence-platform)

## Reverse positioning

What AvePoint's surface implicitly admits:
- **AgentPulse is observability + policy, not autonomous action** — the GA messaging frames it as "visibility into the security posture of agentic AI" and "registry to consolidate every AI agent." There is no public claim that AgentPulse executes M365 admin actions on behalf of operators. [globenewswire.com — AgentPulse GA](https://www.globenewswire.com/news-release/2026/03/09/3251900/0/en/AvePoint-Announces-General-Availability-of-AgentPulse-Command-Center-with-Multicloud-Agentic-AI-Governance.html)
- **Cense is a license tool, not an AI agent** — branding adjacent to "AI license recommendations" creates confusion, but the product itself is license-optimization plumbing. [avepoint.com/products/license-management](https://www.avepoint.com/products/license-management)
- **CIS as a framework reference, not a first-class engine** — baseline-management is template-vs-drift, not "100+ CIS controls evaluated against Graph telemetry with per-tenant override + audit-grade justification."
- **12 modules + suites + Elements + Cense + AgentPulse** = a sprawl that G2 reviewers explicitly call out as "long set-up, learning curve, cost goes up if you need all the advanced options."
- **Pricing fully sales-gated** — no public floor, no MSP-friendly per-tenant SKU listed publicly.

What's missing vs TenantIQ (cross-referenced to the 14-feature TenantIQ inventory in `coreview-analysis.md`):

| TenantIQ has | AvePoint equivalent (publicly observable) |
|---|---|
| Per-tenant CIS overrides with audit-grade justification (ScubaGear-style) | Not advertised; baselines operate at template-similarity level. [baseline page](https://www.avepoint.com/products/elements/baseline-management) |
| 100+ CIS controls evaluated against Graph telemetry, with L1/L2 split | Not advertised; CIS appears only as a framework reference in marketing |
| Drift attribution to **actor** + generic drift revert | Drift detection + restore exists; **actor attribution per change not publicly documented** |
| Mailbox rule auditor (6 BEC indicator types) | Not advertised |
| Federated identity auditor (Entra workload identity) | Not advertised |
| Cross-tenant trust analyzer | Not advertised |
| SAML metadata auditor (cert expiry + SHA-1 + AuthnRequest signing) | Not advertised |
| Public no-auth prospect scan | Not advertised; AvePoint funnel is demo + AgentPulse free trial |
| Per-customer custom domain via DNS verification | Not advertised |
| License-tier upsell on remediation block (402 with concrete cost) | Cense is license-optimization, not remediation-time upsell |
| Account-deletion 33-table cascade with contract test | Not advertised |
| AI-powered CIS control explainer (Claude, tenant-context-aware) | Not advertised |
| ISO 27001:2022 Annex A engine (25 telemetry-evaluable controls) | AvePoint *holds* ISO 27001 cert, but does **not ship a customer-facing Annex A control evaluator** |
| MCP server for third-party agents | AgentPulse governs agents; AvePoint does not expose itself as an MCP tool surface |

## Where AvePoint legitimately wins (honest disclosure)

These are real moats. TenantIQ does not match them today:

1. **FedRAMP Authorization (Moderate, 19 SaaS solutions; AOS-UG at High).** TenantIQ has none. For US federal civilian / DoD prospects, this is a hard gate. [avepoint.com/blog/public-sector/fedramp-authorization-expansion](https://www.avepoint.com/blog/public-sector/fedramp-authorization-expansion)
2. **Public-company financial transparency.** Quarterly 10-Q/10-K, ARR disclosure, $416.8M ARR with 27% growth — institutional buyers can underwrite vendor risk in a way they can't with a private SaaS. [fool.com — AVPT Q4 2025 transcript](https://www.fool.com/earnings/call-transcripts/2026/02/26/avepoint-avpt-q4-2025-earnings-call-transcript/)
3. **Records management depth.** Defensible deletion, retention labels, classification, audit-ready GDPR/HIPAA reports across M365 and Google Workspace — a 20-year-old AvePoint pillar TenantIQ does not yet ship. [avepoint.com/solutions/information-lifecycle-compliance](https://www.avepoint.com/solutions/information-lifecycle-compliance)
4. **Enterprise customer base.** 25,000 customers, 5,000 channel partners, 5x Microsoft Global Partner of the Year, 3,043 employees, federal references (Treasury, IRS, NASA, State Dept, NEH). Specific GE Aerospace / DOD case studies are **not publicly observable** — but the public-sector breadth is unmatched in this market.
5. **Multi-cloud + cross-platform breadth.** Salesforce, Google Workspace, Dynamics 365, Azure, Entra, Power Platform — TenantIQ is M365-focused.
6. **Real public REST API with OAuth + cert auth.** Deeper than CoreView's workflow-trigger surface.

## Differentiation plan for TenantIQ

1. **Don't fight FedRAMP head-on.** Side-step the federal motion entirely; focus MSP + commercial mid-market until SOC 2 is in hand. Position FedRAMP as "we'll be there in 18 months" only when a buyer raises it.
2. **Lead with CIS depth, not breadth.** AvePoint markets "drift vs baseline." TenantIQ ships 100+ CIS controls evaluated against live Graph telemetry, with L1/L2 split, **per-tenant override + ScubaGear-style audit-grade justification**, and AI control-explainer. That's a category AvePoint does not advertise.
3. **Own "actor attribution + one-click revert."** AvePoint's public drift surface restores baselines. TenantIQ surfaces *who* changed *what* and *when*, with a one-click revert. Demo this on `/security/cis` and `/audit/history`.
4. **Public per-tenant pricing.** AvePoint is fully sales-gated; G2 reviewers cite "licensing has been a pain to keep updated." TenantIQ should publish per-tenant/month pricing on `/pricing` as a structural attack on AvePoint's high-friction motion. Tie it to the license-tier-upsell-on-remediation 402 UX as a conversion proof.
5. **Ship MCP + autonomous agent surfaces.** AgentPulse *governs* AI agents but does not *expose AvePoint as an MCP server*. TenantIQ's MCP server + skill marketplace is "build on top of us" — a developer surface AvePoint structurally does not match in 2026.
6. **ISO 27001:2022 Annex A as a customer-facing engine, not just a vendor cert.** AvePoint holds the cert; TenantIQ ships 25 telemetry-evaluable Annex A controls *inside the customer's tenant view*. Different product, same words — and the SOC-2-adjacent buyer wants the engine, not the vendor's own attestation.
7. **Mailbox-rule + federated-identity + SAML + cross-tenant-trust auditors.** Four detection categories AvePoint doesn't advertise. Bundle as "BEC + Identity Hardening Pack" — a wedge category AvePoint can't price-match without 6 months of build.
8. **MSP-economics framing.** AvePoint Elements is real but priced enterprise. TenantIQ frames the same MSP buyer as "per-tenant, public price, unlimited users — your margin grows with the customer." Direct attack on the pricing-friction G2 reviewers complain about.
9. **Concede records management.** Don't try to out-build 20 years of AvePoint records work. Integrate (read M365 Retention Labels, surface in compliance scorecard) but don't compete on defensible deletion.
10. **Speed of release.** AvePoint ships monthly platform updates (Feb / Apr / Jun 2026 blog posts confirm cadence). TenantIQ's release velocity needs to **publicly visible** — a `/changelog` with weekly entries is a credibility wedge against a 3,000-person company that ships monthly.

## Sources

- [AvePoint homepage](https://www.avepoint.com/)
- [Confidence Platform](https://www.avepoint.com/products/confidence-platform)
- [Cense (License Management)](https://www.avepoint.com/products/license-management)
- [AgentPulse / Agentic AI Governance](https://www.avepoint.com/solutions/agentic-ai-governance)
- [AgentPulse GA — globenewswire 2026-03-09](https://www.globenewswire.com/news-release/2026/03/09/3251900/0/en/AvePoint-Announces-General-Availability-of-AgentPulse-Command-Center-with-Multicloud-Agentic-AI-Governance.html)
- [Elements Platform](https://www.avepoint.com/products/elements)
- [Multi-Tenant Management for MSPs](https://www.avepoint.com/solutions/multi-tenant-management)
- [Baseline Management](https://www.avepoint.com/products/elements/baseline-management)
- [Elements April 2026 release notes](https://www.avepoint.com/blog/msp-and-channel/elements-platform-updates-april-2026)
- [Information Lifecycle / Records Management](https://www.avepoint.com/solutions/information-lifecycle-compliance)
- [Policy Enforcement & Drift Control](https://www.avepoint.com/products/policy-enforcement)
- [AvePoint Pricing](https://www.avepoint.com/pricing)
- [Ydentic acquisition announcement](https://www.avepoint.com/news/avepoint-expands-ai-driven-cybersecurity-and-it-management-capabilities-with-ydentic-acquisition)
- [FedRAMP authorization expansion blog](https://www.avepoint.com/blog/public-sector/fedramp-authorization-expansion)
- [AvePoint Online Services for US Government — FedRAMP](https://www.prnewswire.com/news-releases/avepoint-online-services-for-us-government-achieves-fedramp-authorization-301262078.html)
- [AOS-UG on FedRAMP Marketplace (High)](https://www.fedramp.gov/marketplace/products/FR2025827270A/)
- [Federal Civilian solutions page](https://www.avepoint.com/solutions/public-sector/federal)
- [Carahsoft AvePoint partnership](https://www.carahsoft.com/avepoint)
- [Q4 2025 earnings — Motley Fool transcript](https://www.fool.com/earnings/call-transcripts/2026/02/26/avepoint-avpt-q4-2025-earnings-call-transcript/)
- [Q4 2025 / 2026 guidance summary — SignalBloom](https://www.signalbloom.ai/news/AVPT/avepoint-caps-strong-2025-with-29-q4-revenue-growth-guides-for-accelerated-momentum-in-2026)
- [AvePoint Investor Relations](https://www.avepoint.com/ir)
- [AvePoint Graph API docs](https://learn.avepoint.com/docs/Overview.html)
- [AvePoint cloud-api on GitHub](https://github.com/AvePoint/cloud-api)
- [AvePoint Cense on Microsoft Marketplace](https://marketplace.microsoft.com/eu-es/product/saas/avepoint.cense_m365)
- [Office Connect — AppSource](https://appsource.microsoft.com/en-us/product/office/wa104381806)
- [Headcount data — Unify](https://www.unifygtm.com/insights-headcount/avepoint)
- [G2 — Confidence Platform reviews](https://www.g2.com/products/avepoint-confidence-platform/reviews)
- [Gartner Peer Insights — AvePoint Confidence Platform](https://www.gartner.com/reviews/market/data-security-posture-management/vendor/avepoint/product/avepoint-confidence-platform)
- [AvePoint Wikipedia](https://en.wikipedia.org/wiki/AvePoint)
