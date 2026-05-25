# Augmentt — Competitive Analysis for TenantIQ

> Compiled: 2026-05-04. All data drawn from public sources; URL cited per claim.
> Purpose: position TenantIQ against Augmentt at the small-MSP / SMB end of the M365-management market.

## Product

Augmentt is an Ottawa-based, MSP-native multi-tenant Microsoft 365 security and management platform founded in 2020 by ex-N-able alumni Derik Belair and Gavin Garbutt (Garbutt sold N-able to SolarWinds in 2013). Headline messaging is "Protect accounts from threats, detect breaches instantly and get a clear view of all your tenants from a single platform." [augmentt.com](https://www.augmentt.com/), [betakit.com](https://betakit.com/ottawa-startup-augmentt-lands-18-million-to-help-safeguard-cloud-software-for-smbs/)

The product splits into three "Autopilot" SKUs plus a free entry product:

- **Augmentt Discover** — SaaS / shadow-IT discovery against a 22,000+ app database, agent-or-agentless, MFA + security-setting audit. Augmentt explicitly ships **100 free seats of Discover per MSP** under its Free Community Software Program. [augmentt.com/discover](https://www.augmentt.com/discover/), [augmentt.com newsroom — Free Community Software](https://www.augmentt.com/newsroom/augmentt-removes-the-complexity-of-saas-management-with-the-launch-of-its-free-community-software-program-for-msps/)
- **Secure Autopilot** — one-click application of CIS / NIST / Microsoft Secure Score / SCuBA-aligned baselines, Conditional Access policy management across tenants, drift detection + correction, auto-block of high-risk sign-ins, MFA management across CA/Security Defaults/legacy/Duo. [augmentt.com/secure-autopilot](https://www.augmentt.com/secure-autopilot/)
- **Engage Autopilot** — multi-tenant user lifecycle (clone-onboard, scheduled offboard, MFA reset, mailbox rules, OOO, Temporary Access Pass) from a unified dashboard. [augmentt.com/engage-autopilot](https://www.augmentt.com/engage-autopilot/)
- **Intune Autopilot** — device management automation (referenced in nav, no dedicated landing page reachable). [augmentt.com](https://www.augmentt.com/)

Coverage is **Microsoft 365 first, Google Workspace second**. Discover ingests Google Workspace user data; Secure/Engage are M365-only. [augmentt.com/itsm](https://www.augmentt.com/itsm/), [augmentt.com/discover](https://www.augmentt.com/discover/)

Compliance framing: Microsoft Secure Score + CIS + NIST + SCuBA. **No SOC 2 / HIPAA / GDPR / ISO 27001 reporting surface advertised** on product pages. [augmentt.com/secure-autopilot](https://www.augmentt.com/secure-autopilot/)

## Tech

- **API** — partner-gated, "available to our partners using Autopilot to leverage the data in Augmentt reports." Not OAuth/REST self-serve documented; auth + endpoints behind support gating. [kb.augmentt.com — Augmentt API](https://kb.augmentt.com/kb/guide/en/augmentt-api-VTMmYbqvAE/Steps/3726332)
- **No MCP server, no public SDK, no GraphQL** observable.
- **No autonomous AI agent.** Public site frames "Autopilot" as scheduled automation + one-click remediation, not LLM agency. The April 2026 blog discusses Microsoft Agent 365 as third-party news, not Augmentt capability. [augmentt.com/blog — M365 Updates March 2026](https://www.augmentt.com/blog/m365-updates-march-2026/)
- **Microsoft Marketplace / AppSource** — not publicly observable. Search of `appsource.microsoft.com` returns Augmentir (different company) but no Augmentt listing. [AppSource search](https://appsource.microsoft.com/en-us/marketplace/apps?search=augmentt)
- **GDAP-aware** — multi-CSP GDAP support shipped recently to handle MSP M&A scenarios. [augmentt.com — Microsoft Partner Portal AOJ](https://www.augmentt.com/microsoft-partner-portal-made-simple-for-msps-aoj/)
- **Mobile app** — not publicly observable.

## Business

- **Funding** — **CAD $18M Series A**, Nov 2025, Camber Partners-led. Described variously as USD $12.8M and CAD $18M depending on conversion at announcement. No public Seed disclosed. [prnewswire — Series A](https://www.prnewswire.com/news-releases/augmentt-raises-18m-series-a-from-camber-partners-to-scale-security-automation-for-msps-302625688.html), [betakit](https://betakit.com/ottawa-startup-augmentt-lands-18-million-to-help-safeguard-cloud-software-for-smbs/), [thesaasnews](https://www.thesaasnews.com/news/augmentt-secures-cad-18-million-series-a)
- **Headcount** — LinkedIn page lists **46 employees** (band 11-50). Tracxn snapshot from July 2024 was also 11-50. [LinkedIn — Augmentt](https://www.linkedin.com/company/augmentt/), [Tracxn](https://tracxn.com/d/companies/augmentt/__TXL4LEGzFABJ7yHF0RLmU_STppv9lRtnHGz9Tp_6QRg)
- **Pricing** — **"Per Seat Pricing" with no upfront fees + 100 free Discover seats per MSP**, but exact dollar figures not on the public pricing page. Page advertises "flexible terms with one, two, and three-year deals, volume discounts, and billing in your local currency" and routes to "REQUEST PRICING." [augmentt.com/pricing](https://www.augmentt.com/pricing/), [augmentt.com/discover](https://www.augmentt.com/discover/)
- **Customer count** — not publicly disclosed. Site says "hundreds of MSPs"; partner page only logos All Covered + Netsurit. [augmentt.com](https://www.augmentt.com/), [augmentt.com/our-partners](https://www.augmentt.com/our-partners/)
- **Distribution** — Pax8 vendor, Bluechip Infotech (APAC distribution), Everything MSP listing, CloudRadial + Lifecycle Insights + Gradient MSP integrations. Strong MSP channel motion. [Pax8 — Augmentt](https://www.pax8.com/en-us/vendors/augmentt/), [augmentt.com/integrations](https://www.augmentt.com/integrations/)
- **Target market** — explicit: small-to-mid MSPs serving SMB customers. Distinct from CoreView (enterprise) and Nerdio (mid-market AVD-anchored).

## UX

- **Sign-up friction** — **lowest of the cohort**: free trial + 100 free Discover seats forever. No demo gate. [augmentt.com/free-sign-up](https://augmentt.com/free-sign-up/bluechip)
- **Time-to-first-value** — Discover is agentless-capable, so a partner can land a tenant and get a Shadow IT inventory same day. [augmentt.com/discover](https://www.augmentt.com/discover/)
- **PSA integrations as ticket sinks** — ConnectWise, Autotask, Syncro, Halo all open tickets directly with severity mapping. CloudRadial + Lifecycle Insights + Gradient MSP for QBR/billing. [augmentt.com/integrations](https://www.augmentt.com/integrations/)
- **Documentation** — knowledge base at `kb.augmentt.com` is partner-portal style, not OpenAPI-first. API page itself is a stub.
- **G2** — review page exists; specific pain themes were not retrievable in this pass. [G2 — Augmentt](https://www.g2.com/products/augmentt/reviews) (not publicly observable in detail without rendered scrape)

## Reverse positioning

What Augmentt's messaging implicitly admits:

- **"Autopilot" is automation, not agency.** Scheduled rules + one-click remediation. No LLM-driven planner, no MCP, no developer agent surface.
- **Discover as funnel, not endpoint.** 100 free seats is pure top-of-funnel motion to upsell to Secure/Engage. Strong economics for them, but reveals that the primary product is paywalled.
- **CIS depth is shallow vs CoreView/TenantIQ.** Marketing copy mentions CIS as one input alongside Secure Score and SCuBA; no per-tenant override semantics, no audit-grade exception flow, no Annex A mapping advertised.
- **No public compliance breadth.** SOC 2 / HIPAA / GDPR / ISO 27001 are absent from product pages — Augmentt's buyer is the MSP technician, not the compliance officer.
- **API is partner-only and report-shaped.** A developer can't build on top of Augmentt the way TenantIQ's MCP+skills surface intends.
- **No Microsoft Marketplace listing observable** — they sell via Pax8/distribution and direct, not via co-sell on AppSource.

What's missing vs TenantIQ:

| TenantIQ has | Augmentt equivalent |
|---|---|
| Per-tenant CIS overrides with audit-grade justification (ScubaGear-style) | Templates + drift detection; no audit-grade per-control exception flow advertised |
| Drift attribution to **actor** + generic drift revert | Drift detection + auto-correct, no actor attribution observable |
| Mailbox rule auditor (6 BEC indicator types) | Not advertised |
| Federated identity auditor + cross-tenant trust analyzer | Not advertised |
| SAML metadata auditor (cert expiry + SHA-1 + AuthnRequest signing) | Not advertised |
| ISO 27001:2022 Annex A engine (25 evaluable controls) | Not advertised |
| AI CIS control explainer (Claude, tenant-context-aware) | "Autopilot" is rule automation, not LLM explainer |
| MCP server + skill marketplace | Not advertised |
| 33-table account-deletion cascade with contract test | Not advertised |
| Public no-auth prospect scan | Free-trial gated; closest analog is the 100 free Discover seats |
| `/agents` live feed + `/security/timewarp` | Not advertised |
| License-tier upsell with concrete cost on remediation block (402) | Not advertised — pricing model is per-seat, not per-action |

What Augmentt has that TenantIQ does not (be honest):

- **A free tier MSPs can stand up without a demo call.** TenantIQ's prospect scan is no-auth but rate-limited; Augmentt's 100 free Discover seats is a deeper foothold.
- **Google Workspace user ingestion in Discover.** TenantIQ is M365-only; for an MSP serving mixed estates Augmentt is a single pane of glass.
- **Distribution muscle — Pax8 vendor, Bluechip APAC.** TenantIQ is direct-only.
- **Per-seat economics already accepted by SMB MSPs.** TenantIQ's per-tenant flat fee has to overcome a learned per-seat habit at this segment.

## Differentiation plan for TenantIQ

1. **Match the free funnel — but with depth.** Counter Augmentt's "100 free Discover seats" with a TenantIQ free tier that is **read-only Secure scope, unlimited seats, 1 tenant**. Free Discover is shadow-IT inventory; TenantIQ free can be "your CIS posture + drift baseline + 1 prospect scan, free forever." Different value prop, same funnel friction.
2. **Lead "audit-grade CIS" against Augmentt's "rule automation."** Augmentt's Secure Autopilot applies a baseline; TenantIQ's per-tenant override + AI control explainer + ISO 27001 Annex A engine speak to the SOC-2/HIPAA/ISO buyer Augmentt's product page doesn't address.
3. **Own the MCP / agent surface.** Augmentt's "Autopilot" is scheduled rules. TenantIQ's MCP server + autonomous skills + `/agents` live feed is a category Augmentt structurally cannot match in 2026 without a re-architecture; their API is partner-gated and report-shaped.
4. **Drift attribution to actor.** Augmentt detects + corrects drift; TenantIQ tells you **who** changed it and lets you generic-revert with a one-click. This is the QBR-page-stealer Augmentt's Engage doesn't ship.
5. **Compliance breadth as the wedge.** SOC 2 / HIPAA / GDPR / ISO 27001 / 33-table GDPR Art. 17 cascade — Augmentt has none of these advertised. Position TenantIQ as "Augmentt-shaped MSP UX, CoreView-shaped compliance depth."
6. **Don't fight Augmentt on per-seat pricing at SMB.** Their cost basis is built for it. Anchor TenantIQ at per-tenant flat for MSPs serving 25+ users/tenant, where Augmentt's per-seat math gets worse than ours.
7. **Microsoft Marketplace co-sell.** TenantIQ ships on Microsoft Commercial Marketplace; Augmentt does not appear to. Lean on co-sell credit and committed-spend retirement as a procurement story Augmentt can't match.
8. **License-tier upsell with concrete cost on remediation block (402).** Augmentt sells per-seat; the per-action 402 with named tier and dollar cost is a UX they can't price cleanly without restructuring billing.

Sources:
- [Augmentt homepage](https://www.augmentt.com/)
- [Augmentt pricing](https://www.augmentt.com/pricing/)
- [Augmentt Discover](https://www.augmentt.com/discover/)
- [Augmentt Secure Autopilot](https://www.augmentt.com/secure-autopilot/)
- [Augmentt Engage Autopilot](https://www.augmentt.com/engage-autopilot/)
- [Augmentt Integrations](https://www.augmentt.com/integrations/)
- [Augmentt SaaS Discovery](https://www.augmentt.com/saas-discovery/)
- [Augmentt ITSM](https://www.augmentt.com/itsm/)
- [Augmentt Free Community Software newsroom](https://www.augmentt.com/newsroom/augmentt-removes-the-complexity-of-saas-management-with-the-launch-of-its-free-community-software-program-for-msps/)
- [Augmentt API knowledge base](https://kb.augmentt.com/kb/guide/en/augmentt-api-VTMmYbqvAE/Steps/3726332)
- [Augmentt M365 Updates March 2026 blog](https://www.augmentt.com/blog/m365-updates-march-2026/)
- [Augmentt Microsoft Partner Portal AOJ post](https://www.augmentt.com/microsoft-partner-portal-made-simple-for-msps-aoj/)
- [Augmentt Free sign-up](https://augmentt.com/free-sign-up/bluechip)
- [Augmentt Our Partners](https://www.augmentt.com/our-partners/)
- [Augmentt LinkedIn](https://www.linkedin.com/company/augmentt/)
- [Crunchbase — Augmentt](https://www.crunchbase.com/organization/augmentt)
- [Series A — PRNewswire](https://www.prnewswire.com/news-releases/augmentt-raises-18m-series-a-from-camber-partners-to-scale-security-automation-for-msps-302625688.html)
- [Series A — BetaKit](https://betakit.com/ottawa-startup-augmentt-lands-18-million-to-help-safeguard-cloud-software-for-smbs/)
- [Series A — The SaaS News](https://www.thesaasnews.com/news/augmentt-secures-cad-18-million-series-a)
- [Series A — FinSMEs](https://www.finsmes.com/2025/11/augmentt-raises-18m-in-series-a-funding.html)
- [Tracxn — Augmentt](https://tracxn.com/d/companies/augmentt/__TXL4LEGzFABJ7yHF0RLmU_STppv9lRtnHGz9Tp_6QRg)
- [Pax8 vendor page — Augmentt](https://www.pax8.com/en-us/vendors/augmentt/)
- [G2 — Augmentt reviews](https://www.g2.com/products/augmentt/reviews)
- [Microsoft AppSource search](https://appsource.microsoft.com/en-us/marketplace/apps?search=augmentt)
