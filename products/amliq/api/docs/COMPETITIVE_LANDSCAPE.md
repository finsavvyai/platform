# AMLIQ — full competitive landscape

Compiled 2026-04-20. Sibling to `COMPETITIVE_WORLDCHECK.md`, which
covers the incumbent in depth. This doc profiles the rest of the
field — AI-native peer, two enterprise incumbents, and the open-data
substrate — and lines each one up against AMLIQ's shipping wedges.

| Vendor | Class | Shipping wedge AMLIQ beats them on |
|--------|-------|-------------------------------------|
| ComplyAdvantage | AI-native peer | Explainability (they tout ML, don't expose it); open audit trail; MCP server |
| LexisNexis Bridger Insight XG | Enterprise incumbent #2 | Self-serve pricing; sub-50ms API; modern UX |
| Dow Jones Risk & Compliance | Enterprise incumbent #3 | Real-time over batch-first; developer DX; MCP |
| OpenSanctions | Data substrate (we consume it) | Full platform — matching engine, UI, workflow, audit |

---

## 1. ComplyAdvantage

### Profile
- **Positioning**: AI-driven financial-crime risk detection.
- **Product**: Mesh platform — sanctions/PEP/adverse-media screening +
  transaction monitoring + payments.
- **Performance claims**: 70% false-positive reduction, 95% review
  automation, 85–90% Level-1 analyst productivity gain.
- **Tech**: Cloud-native, REST + JSON, modular API surface. ML models
  for behavioural analytics, ID clustering, graph analysis.
- **Pricing**: Starter from $99.99–$119.99/mo (100 entities). Public
  entry tier — unusual among the legacy stack, common for AI-native
  peers.
- **Target**: Mid-market fintech, crypto, payments, small banks.

### Where AMLIQ wins
1. **Explainability is a box they don't open.** Their marketing talks
   about "intelligently identifying complex patterns" — classic
   black-box ML. AMLIQ ships the 6-layer cascade with per-layer
   `algorithm`, `score`, `weight`, `matched`, and `explanation`
   fields (`api/screen_demo_helpers.go`, `matchToDetailMap`).
2. **Public latency dashboard.** `/status` on AMLIQ displays rolling
   p50/p95/p99 every 5s. ComplyAdvantage publishes no latency
   numbers.
3. **MCP server.** Compliance officer asks Claude "has John Smith
   been sanctioned?" and gets an answer from AMLIQ's MCP tool.
   ComplyAdvantage has REST only.
4. **On-prem binary.** Same Go binary as SaaS, shippable to
   regulated environments where ComplyAdvantage requires cloud
   egress.
5. **Full OpenSanctions FTM ingest.** We parse the richer
   `entities.ftm.json` feed, not the flattened `targets.simple.csv`
   — observed DOB coverage gain from 17% → 35%+ on the same upstream.
   Peers that build on the simple CSV inherit its ceiling.

### Where AMLIQ has work to do
- **Transaction monitoring** — ComplyAdvantage Mesh bundles it.
  AMLIQ's roadmap has transaction screening, not yet shipping.
- **Payment rails integration** — They have direct integrations
  with dozens of processors; AMLIQ relies on the customer's own
  integration layer.

---

## 2. LexisNexis — WorldCompliance / Bridger Insight XG

### Profile
- **Positioning**: Enterprise compliance workstation.
- **Product**: Bridger Insight XG — consolidated KYC, sanctions,
  PEP, SOE, and adverse-media screening. Powered by WorldCompliance
  data under the hood.
- **UX/UI**: Seven-language console; "Accept List" for whitelisting
  false positives; designed around case management, not API-first.
- **Tech**: SaaS with enterprise onboarding; integration via
  connectors and bulk batch feeds.
- **Data**: Global sanctions, enforcement actions, PEPs, SOE,
  registration lists, adverse media.
- **Pricing**: Enterprise contracts; G-Cloud (UK public sector)
  pricing document is the only public signal.
- **Target**: Banks, insurers, regulated enterprises, government.

### Documented weakness
> "90% of screening alerts are false positives" — appears in vendor
> and analyst write-ups as a near-universal acknowledged problem.

### Where AMLIQ wins
1. **Developer DX.** TypeScript/Python/Go SDKs, OpenAPI spec, MCP
   server, iframe embed. Bridger is a console with connector
   bolt-ons.
2. **Self-serve signup + published pricing.** AMLIQ can be
   evaluated in 10 minutes. Bridger requires an enterprise
   procurement cycle (multi-week minimum).
3. **Match-level transparency.** Per-hit reasoning + cryptographic
   audit receipts. Bridger's "Accept List" is a black-box override
   store.
4. **Sub-50ms latency with published numbers.** Bridger batches
   are explicitly designed for throughput, not synchronous
   onboarding flows.

### Where AMLIQ has work to do
- **Data breadth** — LexisNexis bundles deep public-records
  coverage (pipes into corporate searches, news, legal records).
  AMLIQ covers the sanctions + PEP + adverse-media triad and does
  not yet surface full corporate-records enrichment.

---

## 3. Dow Jones Risk & Compliance

### Profile
- **Positioning**: Trust the WSJ brand; compliance on institutional
  data quality.
- **Products**: RiskCenter (screening console), Risk Journal,
  Data Feeds & APIs, Due Diligence Reports.
- **Strengths**: Sanctions Control & Ownership (SCO) data for
  OFAC 50% rule compliance; low false-positive reputation; manual
  validation for high-risk cases.
- **Tech**: API + feeds + console. Integration surface is flexible
  but enterprise-oriented.
- **Pricing**: No public pricing; "contact sales" gate.
- **2026 analyst note**: workflow is batch-focused, "less effective
  for organisations that prioritise real-time monitoring."

### Where AMLIQ wins
1. **Real-time by design.** AMLIQ's screening path is synchronous
   and sub-50ms; Dow Jones is batch-first.
2. **Public status page.** The batch-first posture means no
   meaningful latency numbers to publish anyway.
3. **Developer-first integration.** Same DX story as vs. LexisNexis.
4. **Transparent pricing.** Same gate-vs-published story.

### Where AMLIQ has work to do
- **Manual-validation tier** — Dow Jones's edit-before-publish
  curation is a feature for tier-1 bank risk committees. AMLIQ's
  equivalent is the investigator workflow + per-tenant override
  store; shipping, but not the same brand trust.
- **SCO / 50% rule enrichment** — Dow Jones has a dedicated
  ownership-data product. AMLIQ relies on OpenSanctions' entity
  graph here.

---

## 4. OpenSanctions (data substrate, not competitor)

### Profile
- **Positioning**: Open database of international sanctions,
  persons of interest, PEPs. Consolidated and deduplicated from
  320+ sources across 240+ countries.
- **Business model**: Free for non-commercial; licensing for
  commercial (multiple tiers, sales@opensanctions.org). Exemptions
  for journalists, activists, startup discounts.
- **Product**: Raw data (FTM JSON, simple CSV, nested JSON),
  Senzing JSON, names.txt, plus an optional Data API Platform.
- **Licence guarantees**: Updated multiple times daily, SLA-backed
  under commercial licence.

### AMLIQ's relationship
- **Consumer, not competitor.** AMLIQ's PEP pipeline reads the
  `entities.ftm.json` FTM feed as ground-truth data.
- **Commercial licence required** for production traffic —
  must be in place before marketing AMLIQ tiers that screen
  against this data.
- **Upstream contribution** is the right posture — file parser
  fixes and coverage improvements back to the OpenSanctions
  repos.

### Risks to hedge
1. Upstream dataset licence enforcement — keep receipts.
2. Rate-limit or access change from OpenSanctions CDN — mitigate
   with the new `FetchToDisk` path (decouples throttled upserts
   from network read) and mirror-to-S3 option on the roadmap.
3. OpenSanctions shipping their own screening UI — already exists
   at a basic level via their Data API Platform. AMLIQ's wedge is
   still the 6-layer matching engine, workflow, and regulatory
   audit story.

---

## 5. Multi-vendor matrix

| Wedge | AMLIQ | World-Check | ComplyAdvantage | LexisNexis | Dow Jones | OpenSanctions |
|-------|-------|-------------|------------------|------------|-----------|----------------|
| Explainability per hit | ✓ shipping | ✗ | ✗ | ✗ | ✗ | n/a |
| Public latency numbers | ✓ shipping | ✗ | ✗ | ✗ | ✗ | n/a |
| Published pricing | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Self-serve signup | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ (data only) |
| SDKs (TS/Py/Go) | ✓ | ~ | ✓ | ~ | ~ | ~ |
| MCP server | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| On-prem option | ✓ | By contract | ✗ | By contract | ~ | n/a |
| Transaction monitoring | Roadmap | ✗ | ✓ | ✓ | ~ | ✗ |
| Ownership / SCO | Via OS | ✓ | ✓ | ✓ | ✓ (product) | ✓ (graph) |
| Real-time screening | ✓ | Partial | ✓ | ✗ (batch) | ✗ (batch-first) | Via API |
| Full FTM JSON ingest | ✓ | n/a | Unknown | n/a | n/a | Source |

## 6. Strategic takeaways

1. **The wedge that beats everyone simultaneously is explainability.**
   No vendor exposes per-layer reasoning; AMLIQ shipped it today.
2. **Public latency is a marketing asset that costs nothing.** None
   of them publish. Every minute AMLIQ does is reputation build.
3. **MCP server is genuinely novel in this category.** No competitor
   has shipped one as of April 2026.
4. **Transaction monitoring** is ComplyAdvantage's clearest
   defensible moat vs. AMLIQ; it should not be a 2026 bet. 2027.
5. **OpenSanctions is mandatory infrastructure,** not a competitor.
   Close the commercial licence before first paying customer.
6. **The 1.4M-row opensanctions_peps table + 127K us-sam + the
   FTM enrichment delta** already make AMLIQ's coverage plausible
   vs. tier-2 vendors. Tier-1 bank parity needs adverse media
   depth and SCO — both 2026-H2 roadmap items.

## Sources

**ComplyAdvantage**
- [ComplyAdvantage home](https://complyadvantage.com/)
- [Mesh platform](https://complyadvantage.com/mesh/)
- [Sanctions & watchlists](https://complyadvantage.com/fincrime-risk-intelligence/sanctions-watchlists-screening/)
- [Pricing — G2](https://www.g2.com/products/complyadvantage/pricing)
- [Integration docs](https://complyadvantage.com/integration/)

**LexisNexis Bridger Insight XG**
- [Product page](https://risk.lexisnexis.com/products/bridger-insight-xg)
- [Bridger + WorldCompliance case study](https://risk.lexisnexis.com/global/en/insights-resources/case-study/strengthen-sanctions-compliance-with-lexisnexis-bridger-insight-xg)
- [G-Cloud pricing (UK public sector)](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/documents/711997/794708721306169-pricing-document-2024-05-03-0935.pdf)
- [Brochure PDF](https://21775616.fs1.hubspotusercontent-na1.net/hubfs/21775616/Bridger%20Insight%20XG%20-%20Brochure%20(2).pdf)

**Dow Jones Risk & Compliance**
- [Dow Jones Watch List — CSI](https://www.csiweb.com/how-we-help/financial-crimes/sanctions-screening/dow-jones-watch-list/)
- [AEB compliance integration](https://www.aeb.com/en/compliance-screening/dow-jones-risk-and-compliance-content.php)
- [G2 reviews 2026](https://www.g2.com/products/dow-jones-risk-compliance/reviews)
- [Ondato best-of 2026](https://ondato.com/blog/best-sanctions-screening-providers/)

**OpenSanctions**
- [Licensing page](https://www.opensanctions.org/licensing/)
- [Commercial FAQ](https://www.opensanctions.org/docs/commercial/faq/)
- [Pricing tier FAQ](https://www.opensanctions.org/faq/29/pricing-tier/)
- [Why-pay-for-downloadable-data FAQ](https://www.opensanctions.org/faq/156/paying-for-use/)
- [Business licences — 2021 launch post](https://www.opensanctions.org/articles/2021-12-10-sustainability/)
- [GitHub repo](https://github.com/opensanctions/opensanctions)
