# Competitive analysis — AMLIQ vs. World-Check (Refinitiv / LSEG)

Compiled 2026-04-20. Sources inline at the bottom.

## Executive summary

World-Check is the 800-lb gorilla of sanctions + PEP screening: ~25
years in market, owned by LSEG (post the 2021 Thomson Reuters →
Refinitiv → LSEG rollup), deployed at the majority of tier-1 banks.
Its moat is data coverage and regulatory familiarity, not technology.
Public record and user reviews converge on three persistent
weaknesses — **false positives**, **opacity of matching**, and
**enterprise-only sales motion** — that map directly to AMLIQ's
announced wedges: transparent explainable matching, sub-50ms API,
developer-friendly DX, self-serve pricing, and an open audit trail.

## 1. Product

| Layer | World-Check | AMLIQ | Wedge |
|-------|-------------|-------|-------|
| Coverage | ~6M profiles, 240+ countries, sanctions + PEP + RCA + SIE + adverse media | OFAC / EU / UN / HMRC / OFSI / SECO / IsraeliMoD / NBCTF + 50+ country-direct feeds + OpenSanctions PEPs (710K FTM) + GLEIF LEIs | Parity on major lists, explicit on feed provenance |
| Matching | Fuzzy + "secondary" + configurable thresholds + auto-resolution | 6-layer cascade: exact → fuzzy → phonetic → token → embedding → graph, with per-layer score breakdown | **Per-hit score + per-layer reasoning** exposed in API + UI |
| Explainability | Black-box score only | Full explanation object: which layers hit, why, at what threshold | **Explain-every-match** is the flagship differentiator |
| Adverse media | Bundled from LSEG curated feed | GDELT + NewsAPI + Google News ingestion; tunable recency/source/category | Media is pluggable, not opaque |
| Workflow | Case mgmt, discounting, continuous monitoring | Alerts + investigations + audit, REST + MCP + iframe embeddable | Embeddable into customer's own UI |
| Integrations | Salesforce connector, "Connector for ProcessUnity" family | OpenAPI SDK (TS, Python, Go), MCP server, React embed | Developer-first, not partner-channel-first |

## 2. Technology

| | World-Check | AMLIQ |
|---|---|---|
| Stack | LSEG internal (opaque); legacy SOAP alongside REST | Go 1.22 clean-arch, React 18 + Vite, Postgres + pgvector, LemonSqueezy SaaS |
| Latency | Not publicly benchmarked; "real-time" marketing claim only. User reports cite "seconds" for synchronous screens | Sub-50ms target on API path; streaming ingest bounded per batch |
| API auth | OAuth; enterprise onboarding req'd (email sales) | API key + OAuth on dashboard, self-serve issue on signup |
| Rate limits | Negotiated per contract | Plan-tiered public quota |
| Format | JSON-over-REST, some XML legacy | JSON, streamed NDJSON for bulk, FTM for PEP upgrades |
| SDKs | Official none prominent; Salesforce app | TS + Python + Go SDKs + MCP server + React iframe |
| Audit trail | "Supports consistent documentation" (marketing) | Append-only `list_sync_audit` + per-screen receipt stored for tenant |
| Deployment | SaaS-only; private-cloud options by contract | SaaS + on-prem Docker bundle (same binary) |

## 3. Business

| | World-Check | AMLIQ |
|---|---|---|
| Target | Tier-1 banks, large FIs, law firms, professional services | Mid-market FIs, FinTech / neobanks, compliance teams at crypto / marketplaces, regulated SaaS |
| Sales motion | Enterprise, quote-based, multi-month procurement | Self-serve + PLG, LemonSqueezy checkout, contracts only at Enterprise |
| Pricing visibility | **None public** — "contact sales" gate | Tiered + published, per-API-call transparent |
| Starter cost | Six-figure contracts reported anecdotally | Orders-of-magnitude lower, tested against ComplyAdvantage's $99–$120/mo entry |
| Contract shape | Annual, data-licence bundled | Monthly or annual, usage-based possible |
| Compliance posture | ISO 27001, SOC 2 (via LSEG) | Targeting SOC 2 Type 1 in 90 days, Type 2 in 12 months |

## 4. Known weaknesses — direct evidence

**False-positive flood.** Even World-Check's own founder David Leppan
described the platform as a "monster, flagging every potential risk
and swamping banks with false positives, while those truly involved
in criminal networks are largely unaffected." Analyst and practitioner
reviews consistently list high false-positive rate as the #1
complaint.

**Wrongful listings & litigation exposure.**
- *Palestine Solidarity Campaign (2017)* — wrongly tagged as
  terrorism-affiliated; apology + compensation paid.
- *Maajid Nawaz (2017)* — wrongly flagged as terrorist; Vice
  investigation led to settlement with undisclosed damages.
- Reputational tail risk is a structural weakness of opaque curation
  without explainability.

**Integration friction.** Multiple reviewers call out the technical
integration cost and the heavyweight procurement. Salesforce-connector
marketing admits the target buyer is someone who *isn't* a developer.

**No transparent pricing.** Zero pricing signal is public. Every
discovery funnel ends at "contact sales."

## 5. AMLIQ differentiation plan

### 5.1 Features World-Check is missing (or buries)

1. **Per-hit explanation object** — every match ships with the
   triggering layer, the component scores, the matched tokens, and a
   human-readable one-liner. World-Check returns a single score.
2. **Sub-50ms screening API** — measured latency budget, not a
   marketing adjective. Publish p50/p95/p99 on a status page.
3. **MCP server** — compliance officers can run screens from their
   AI assistant (Claude / ChatGPT) out of the box. No competitor
   ships this today.
4. **Open audit trail** — every screen is stored per-tenant, hashed,
   cryptographically signed, and exportable as a regulator-ready PDF
   in one click.
5. **Embeddable iframe** — drop AMLIQ into any KYC/onboarding flow
   with `<iframe src="…">`; World-Check forces your UI into their
   silo via Salesforce-style connectors.
6. **Per-feed provenance** — UI shows, for each hit, which list
   produced it and when that list was last synced. No competitor
   exposes list freshness per entity.

### 5.2 UX improvements

- **One-click false-positive dismissal with reason codes** → feeds
  back into per-tenant matcher tuning. World-Check's "auto-resolution"
  is a black-box rule engine.
- **Search-as-you-type** on the entity browser — World-Check's
  console is slow, tabular, and cursor-based.
- **Dark-mode and keyboard-only operation** across the dashboard
  (Apple HIG). World-Check is a mid-2010s enterprise UI.
- **Mobile-first alert triage** — investigators can clear a case
  from a phone. World-Check is desktop-only.

### 5.3 Pricing opportunities

- Publish **every tier + cost per screen** on the marketing site.
  The "contact us" moat is World-Check's own weakness.
- **$0 free tier**, capped at N screens/mo, for integration
  evaluation. Closes the procurement gap against ComplyAdvantage
  ($99–$120/mo Starter).
- **Usage-based** add-on ($/screen over tier quota) — removes the
  seat-count negotiation that dominates World-Check contracts.
- **Transparent data-licence carve-outs** — no surprise re-export
  fees.

### 5.4 Technical advantages to build (differentiating, not parity)

1. **Explainability engine v1** (shipping): cascade + per-layer
   score + token diff + one-line NL explanation.
2. **Feed-transparency dashboard**: live freshness, row counts, last
   failed sync, per-entity provenance chain.
3. **Continuous monitoring stream** (server-sent-events) — push alerts
   to customer webhooks instantly on list updates. World-Check polls.
4. **Sanctioned-wallet graph for crypto** — native integration with
   OFAC SDN crypto addresses + chain heuristics; World-Check's crypto
   coverage is reactive, list-only.
5. **PEP FTM enrichment** — AMLIQ ingests OpenSanctions *full*
   FollowTheMoney feed (not the lossy `targets.simple.csv` flat
   projection), lifting DOB and position coverage beyond what
   competitors who read the same CSV can see.

### 5.5 Go-to-market positioning

- **Tagline** (from `docs/BRAND_PROMPTS.md`): *Clarity at every
  transaction.* Exact opposite of World-Check's opaque-by-design.
- **Lead with explainability** in all marketing — public demo where
  a visitor types a name, sees the full explanation object without
  signup.
- **Target audiences** in order:
  1. **FinTech / neobank compliance engineers** — self-serve,
     API-first, will never tolerate a Salesforce connector.
  2. **Regulated crypto exchanges** — OFAC SDN wallet graph + FTM
     PEP coverage.
  3. **Tier-2 banks & credit unions** — cost-conscious, want
     transparency, World-Check is overkill.
- **Channel**: developer-first content (dev.to, HN, podcasts),
  MCP marketplace presence, open-source ingestion tooling.
- **Proof points to publish**: live latency dashboard, public
  SOC 2 roadmap, sample explanations from a real ruleset, case
  studies on false-positive reduction vs. an anonymised incumbent.

## 6. Where AMLIQ should *not* try to compete (yet)

- **Adverse media curation depth** — World-Check has 25 years of
  manual analyst curation. AMLIQ parity via GDELT + commercial
  feeds, but deep exclusive human-curated media should stay out of
  scope for v1.
- **Tier-1 bank enterprise contracts** — procurement cycles are 9
  months; wedge is mid-market and FinTech until SOC 2 Type 2 + a
  couple of reference customers.
- **Salesforce ecosystem** — nice-to-have, not a wedge.

## 7. Risk & mitigation

| Risk | Mitigation |
|------|------------|
| Regulator comfort with "new" vendor | Ship ISO 27001, SOC 2 Type 1 in 90 days; publish audit reports |
| Data licensing disputes from OpenSanctions upstream | Contribute back, pay the commercial licence, keep receipts |
| World-Check price-dropping to compete | Our cost base is orders of magnitude lower; margin holds |
| False-positive parity regression on our own cascade | Continuous evaluation harness + golden-set coverage tests in CI |
| Wrongful-listing liability | Explainability + dismissal workflow + per-tenant override store; never carry a W-C-style 6M-row dragnet |

## 8. Immediate next steps (AMLIQ side)

1. ~~Publish the explainability API surface~~ **Shipped**
   (`6871492`). `POST /api/v1/screen` responses now carry `layers[]`
   with layer, algorithm, score, weight, matched token, and the
   per-layer explanation string + the aggregated ExplainChain.
2. ~~Stand up the public latency dashboard~~ **Shipped** (`6871492`).
   `GET /health/latency` returns rolling p50/p95/p99. `GET /status`
   serves an Apple-HIG HTML page that polls every 5s — auto-colours
   green under 50ms, amber over 200ms. Link to it from marketing.
3. Write the `How we're different from World-Check` marketing page —
   table-format, link every differentiation to a shipping feature or
   a dated roadmap item.
4. Add a competitive-intel cron: monitor LSEG dev portal, World-Check
   pricing leaks, G2 review velocity; alert on material changes.

## Sources

- [World-Check — Wikipedia](https://en.wikipedia.org/wiki/World-Check)
- [World-Check On Demand Reviews — G2](https://www.g2.com/products/world-check-on-demand/reviews)
- [Refinitiv World-Check Risk Intelligence — SoftwareSuggest](https://www.softwaresuggest.com/refinitiv-world-check-risk-intelligence)
- [LSEG World-Check One product page](https://worldcheck.refinitiv.com/)
- [World-Check KYC Screening — Refinitiv](https://www.refinitiv.com/en/products/world-check-kyc-screening)
- [LSEG World-Check One API fact sheet (PDF)](https://www.lseg.com/content/dam/risk-intelligence/en_us/documents/fact-sheets/world-check-one-api.pdf)
- [LSEG World-Check On Demand — Devportal](https://developers.lseg.com/en/api-catalog/customer-and-third-party-screening/world-check-data-api)
- [World-Check Verify: Real-Time API Screening — LSEG](https://www.lseg.com/en/risk-intelligence/screening-solutions/world-check-verify)
- [Top LSEG World-Check Alternatives in 2026 — Slashdot](https://slashdot.org/software/p/LSEG-World-Check/alternatives)
- [10 Best Refinitiv World-Check Alternatives — SaaSworthy](https://www.saasworthy.com/product-alternative/26396/refinitiv-world-check-risk-intelligence)
- [Have compliance databases gone too far? — Gherson LLP](https://www.gherson.com/blog/have-compliance-databases-gone-too-far-the-case-of-world-check/)
- [ComplyAdvantage Pricing — G2](https://www.g2.com/products/complyadvantage/pricing)
- [ComplyAdvantage Competitors — PlanetCompliance](https://www.planetcompliance.com/anti-money-laundering/complyadvantage-competitors/)
- [Common Customer Screening Tools — Financial Crime Academy](https://financialcrimeacademy.org/common-customer-screening-tools/)
