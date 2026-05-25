# AMLIQ Competitive Strategy Summary

**Date:** 2026-04-21  
**Sources:** Research files: COMPETE-complyadvantage.md, COMPETE-chainalysis-dowjones.md, COMPETE-lexisnexis-quantexa.md  
**Coverage:** ComplyAdvantage, Chainalysis KYT, Dow Jones Risk & Compliance, LexisNexis WorldCompliance, Quantexa

---

## 1. Market Landscape

The AML/CFT compliance market is dominated by two categories:

**Data Vendors** (sell risk intelligence, not workflow):
- LexisNexis WorldCompliance — 8M+ risk profiles, 45 of top 50 global banks, Tier 1 focus, expensive, no workflow
- Dow Jones Risk & Compliance — best-in-class adverse media (Factiva), data only, no case management, no TM
- ComplyAdvantage — most accessible data vendor ($99/mo entry), real-time refresh, agentic AI claims, no UBO/SAR

**Analytics/Monitoring Platforms** (sell intelligence, not ops):
- Chainalysis KYT — crypto-only, zero fiat/entity screening, $20K–$287K/year, enterprise-only
- Quantexa — entity resolution + graph analytics, $2.6B valuation, months-long implementation, $5B+ bank target

**The gap they all share:** None delivers a complete, end-to-end AML *operations* platform accessible to fintechs and mid-market teams at SaaS economics. That is AMLIQ's market.

---

## 2. AMLIQ Competitive Position

### Where AMLIQ Wins Today

| Capability | ComplyAdvantage | Chainalysis | Dow Jones | LexisNexis | Quantexa | AMLIQ |
|---|---|---|---|---|---|---|
| PEP / Sanctions Screening | Strong | No | Strong (data only) | Strong (data only) | No (ingests external) | Yes |
| Alert Queue + AI Smart Sort | Basic | Rules only | None | None | Secondary | **Strong** |
| AI Alert Summarization | Agentic (85% claim) | No | Weak (72/100) | No | Q Assist (new) | **Yes** |
| UBO Chain Visualization | **No** | No | No (data, no graph) | No | Graph (eng-intensive) | **Yes (native)** |
| Case Management | Basic | Reactor (addon) | None | None | Secondary | **Yes (native)** |
| Batch Screening UI | API/SFTP only | No | File feeds | Bridger (no UI) | Not featured | **Yes (managed UI)** |
| Audit Trail | Yes | Basic | None | Basic | Not primary | **Yes (compliance-grade)** |
| Webhooks & Automation | Yes | Limited | No | Not featured | Not featured | **Yes** |
| Billing / Self-Serve Access | No (cliff at 2K entities) | No ($20K+ min) | Complex | No | No | **Yes** |
| SMB / Fintech Accessible | Starter only | No | Technically yes | No | No (Cloud AML: $5B+ banks) | **Yes** |
| Time-to-Value | Days (API) | Weeks (sales) | Days (API) | Weeks–months | Months | **Days** |
| Modern UX | Clunky (G2) | Good | Poor (clunky, dated) | Dated | Functional | **HIG-level** |

### Where AMLIQ Is Behind

| Gap | Impact | Mitigation |
|---|---|---|
| No proprietary risk database | High — depends on data provider for screening quality | Partner or resell ComplyAdvantage / LexisNexis data; position AMLIQ as the ops layer |
| No identity / document KYC | Medium — forces 2-vendor approach | Partner with Sumsub or Onfido; create integrated KYC → screening funnel |
| No SAR/STR filing automation | Medium — closes the compliance loop | Build as Phase 2 premium feature; ComplyAdvantage also lacks this |
| No fiat transaction monitoring at scale | Medium — Chainalysis-class throughput not achievable yet | Position on entity screening + case management first; add TM in Phase 3 |
| No entity resolution graph (Quantexa-style) | Low for current target market | UBO visualization partially addresses this; full graph analytics is a long-term roadmap item |

---

## 3. Target Market & Positioning

### Primary Target
**Fintech and growth-stage compliance teams** (50–500 employees, $1M–$50M ARR, 1–10 compliance staff) who:
- Cannot afford LexisNexis/Quantexa enterprise contracts
- Are priced out of or constrained by ComplyAdvantage's Starter → Enterprise cliff
- Need more than Dow Jones provides (data only, no workflow)
- Need more than Chainalysis provides (crypto only, no entity screening)

### Secondary Target
**Mid-market banks and PSPs** ($100M–$5B in assets) looking to modernize away from legacy LexisNexis/Bridger deployments.

### Positioning Statement
> "AMLIQ is the only AML/CFT compliance platform that combines AI-powered entity screening, smart alert triage, integrated case management, UBO chain visualization, and real-time audit trails in a single modern product — at transparent SaaS pricing that scales with your business, not against it."

---

## 4. Go-To-Market Differentiation by Competitor

### vs. ComplyAdvantage
- **Win angle**: UBO chain visualization + self-serve rule config + SAR filing automation + no pricing cliff
- **Target**: ComplyAdvantage Starter users hitting the 2,000-entity cap; teams frustrated by vendor-assisted rule tuning
- **Message**: "All compliance in one place — UBO chains included, rules you control, pricing you can predict."

### vs. Dow Jones Risk & Compliance
- **Win angle**: Full ops platform vs. data-only; AI vs. weak ML (72/100); modern UX vs. clunky
- **Target**: Dow Jones customers who have the data subscription but lack workflow tools
- **Message**: "You already have the data. AMLIQ gives your team the platform to act on it — AI-assisted triage, case management, and full audit trail in one place."

### vs. Chainalysis KYT
- **Win angle**: Unified fiat + entity screening in one tool; AI alert triage; integrated case management; SMB pricing
- **Target**: Crypto exchanges and VASPs needing entity screening alongside on-chain monitoring; fintech teams priced out of Chainalysis
- **Message**: "Entity screening, alert triage, and case management — everything Chainalysis isn't."

### vs. LexisNexis WorldCompliance
- **Win angle**: Operational platform vs. data + screening engine; AI-native; transparent pricing; fintech-speed onboarding
- **Target**: LexisNexis customers who've built a Bridger deployment and need to modernize workflow layer
- **Message**: "The operational intelligence layer LexisNexis cannot be — AI-powered triage and case management on day one, at a fraction of the cost."

### vs. Quantexa
- **Win angle**: Day-one value vs. months-long implementation; SaaS economics vs. enterprise TCO; fintech-accessible
- **Target**: Compliance teams that evaluated Quantexa and couldn't justify the implementation timeline or cost
- **Message**: "Comparable intelligence, no 6-month implementation, no hidden infrastructure costs."

---

## 5. Feature Roadmap Priorities (Competitive Gaps to Close)

Priority ordered by competitive impact and market demand:

### P0 — Required for Competitive Credibility
1. **SAR/STR filing automation** — Only AMLIQ and ComplyAdvantage are short on this; adding it is a concrete differentiator over all five competitors
2. **Self-serve rule builder** — ComplyAdvantage requires vendor assistance; analysts want control
3. **Transparent tiered pricing** — Published pricing page with clear entity/volume tiers up to $5K/month; no sales call required below enterprise

### P1 — Defensive Moats to Strengthen
4. **AI alert summarization audit trail** — Download AI rationale per case for regulator review (unique among competitors)
5. **Webhook event catalog** — Document and expand the webhook system; position as automation-first vs. Dow Jones/LexisNexis
6. **Batch screening progress UI** — Current advantage vs. all competitors; keep it polished and differentiated

### P2 — Market Expansion
7. **KYC partner integration** — Sumsub or Onfido embedded flow for identity + screening in one funnel
8. **Crypto transaction monitoring** — Even basic on-chain exposure screening positions AMLIQ ahead of Dow Jones/LexisNexis in modern fintech sales
9. **Quantexa-lite entity resolution** — Enhanced network graph using UBO + case + transaction linkage (extend existing UBO visualization)

---

## 6. Sales & Marketing Ammunition

### Proof Points to Build
- "Deploy in minutes" onboarding video (contrast with Quantexa's months)
- Side-by-side pricing comparison table (AMLIQ vs. ComplyAdvantage's opacity)
- UBO chain demo — no competitor has this as a live in-product demo
- Smart sort + AI summary live demo — address alert fatigue narrative

### Analyst & Review Strategy
- G2 and Capterra: Competitors' weak spots are UX, pricing, and support. Collect reviews targeting those dimensions.
- Juniper Research / Chartis: Target "AML Operations" category rather than "AML Data" category — AMLIQ wins on ops, not data.
- Security certifications: SOC 2 Type II, ISO 27001 in roadmap (required for enterprise deals; ComplyAdvantage and LexisNexis both hold these).

---

*All competitive data based on public sources as of April 2026. Pricing, features, and market positioning change rapidly — review quarterly.*
