# AMLIQ Brain — Locked Decisions, Remaining Recommendations, Updated Investor Narrative

Companion to `amliq_brain_product_brief.md`. Captures the founder decisions made on 2026-05-25 and provides explicit recommendations on the remaining open items.

---

## Part 1 — Decisions locked

| # | Decision | Lock-in | Implication |
|---|---|---|---|
| 5 | Existing AMLIQ migration vs Brain priority | **Parallel** — run both with shared engineering | AMLIQ Investigate (aegis + QuantumBeam + ML fraud fold) continues per Week 4-6 of the addendum; Brain shares the same `products/amliq/` tree and the same platform packages. No duplication of auth/billing/telemetry effort. |
| 9 | Brain fundraise | **Existing Series A pitch** — integrate Brain, don't separate seed | Series A story expands from "infrastructure for AI-generated software" to "infrastructure + one vertical product (AMLIQ) with two SKUs (Investigate + Brain)." Raises the ceiling on the round size without splintering the cap table. |
| 3 | Self-hosted vs cloud | **Both from day 1** — cloud-first GA, self-hosted available at higher tier | Cloud serves the Series B+ fintech ICP cheaply. Self-hosted is the door-opener for tier-1 banks and EU customers with data-residency mandates. Same codebase; deployment-mode toggled by config. `02_AI_AGENTS/llm` distributed cluster becomes the self-hosted inference backbone. |

## Part 2 — Recommendations on the remaining 7 decisions

For each: my recommendation, why, and what to do if you disagree.

### Decision 1 — Naming

**Recommendation:** **AMLIQ umbrella with two SKUs: `AMLIQ Investigate` + `AMLIQ Brain`.**

Single brand, two product surfaces. Investigate is the analyst tool (per-case workflow); Brain is the org-level platform (knowledge + agents + audit). Marketing site shows them as complementary, sold together at enterprise tier and separately at mid-market.

Why: avoids splintering the 8-product narrative; the Doti acquisition was for a focused product; "AMLIQ" already has thesis equity; "Brain" is descriptive enough that buyers immediately understand what they're buying.

If you disagree: alternative is launching Brain as a separate brand (e.g., "Sentinel" or "Ledger Brain"). Doing so adds 6+ months of brand-building before market signal.

---

### Decision 2 — Scope of v1 (jurisdiction)

**Recommendation:** **US only (FinCEN-first) for first 6 months. UK + EU added month 7-12.**

US has the highest enforcement intensity (SAR is the most-penalized BSA violation), the largest mid-market fintech/tier-2 bank ICP, the clearest regulatory feed structure (FinCEN, FFIEC, OFAC), and the easiest design partner acquisition (your network is denser here than EU).

UK + EU added in month 7-12 unlocks: London tier-2 banks (HSBC challengers, fintech bank challengers), Israeli fintechs serving EU (familiar buyer behavior), and MiCA-compliant crypto exchanges.

If you disagree: starting US+UK+EU triples scope and the SAR template library alone is a 2-month effort per jurisdiction. The "broad on day 1" play only makes sense if you have committed design partners in all three regions.

---

### Decision 4 — Open-source primitives

**Recommendation:** **Open-source `FinSavvyAI_Distributed_RAG` upgrade as `oss/finsavvy-rag/` (Apache 2.0).**

Three reasons:

1. **Matches the FinsavvyAI thesis.** "OSS gravity" is a stated moat layer in the existing investor narrative. Adding a second OSS asset (alongside PipeWarden) makes the moat real.
2. **Inbound for Brain.** Developers searching for "self-hosted enterprise RAG with audit logs" find the OSS, install it, and become aware of Brain. Same playbook as PipeWarden → PushCI.
3. **Defensive against Doti's acquirer.** Salesforce now owns Doti's stack. Open-sourcing the RAG primitives makes "open alternative to Doti's approach" a real positioning option for the OSS community — which benefits Brain's commercial product positioning by association.

Keep proprietary: the compliance corpus ingest pipelines, SAR template library, audit-log tamper-evidence scheme, multi-tenant orchestration, customer-managed encryption integration. Those are the commercial moat.

Apache 2.0 over MIT for enterprise-friendliness (patent grant) — matches what most enterprise infrastructure OSS uses.

If you disagree: keep `FinSavvyAI_Distributed_RAG` proprietary. You lose the inbound channel but gain control. Worth doing only if you believe the RAG primitives are competitively unique (they're not — pgvector + FastAPI + Caddy is commodity).

---

### Decision 6 — Design partner targets

**Recommendation:** **Three partners, three different segments, all closeable within 30 days via warm intros.**

1. **One Israeli fintech (Series B-C)** — your network's densest pool. Target: a payments / lending / neobank with an MLRO who already has SAR pain. Likely candidates in your network: payments processors, crypto-adjacent fintechs, MoneyTech. **Goal:** fast iteration partner, weekly feedback, reference logo for IL market.
2. **One US tier-2 regional bank** — credibility logo for North American market. Harder warm-intro path but possible via Israeli VC connections (Bessemer, Glilot, Insight have bank relationships). **Goal:** procurement-cycle learning + enterprise feature requirements.
3. **One crypto exchange (US or EU regulated)** — highest pain density, lowest established-vendor competition. Coinbase / Kraken are out of reach; target tier-2: Bitstamp, Bitpanda, eToro (Israeli connection), Crypto.com regional ops. **Goal:** prove cross-jurisdiction value early.

Avoid: tier-1 banks (procurement cycles are 12+ months — won't fit 6-month MVP timeline), insurance carriers (different regulatory framework, harder ICP for v1).

If you disagree: pick partners you can close in 14 days. Speed of design-partner feedback determines speed of MVP iteration.

---

### Decision 7 — Pricing model

**Recommendation:** **Hybrid: platform fee + per-seat for Brain users + usage caps on agent actions.**

Concrete structure:

| Tier | Platform/yr | Per-seat/mo | Agent actions/mo included | Overage |
|---|---|---|---|---|
| **Brain Starter** (≤5 users, cloud only) | $0 | $400 | 200 SAR drafts + 1,000 alert triages | $2/SAR, $0.50/alert |
| **Brain Pro** (≤25 users, cloud) | $20K | $300 | 1,500 SAR drafts + 10,000 alert triages | discounted |
| **Brain Enterprise** (unlimited, self-host option) | $80K | $250 | Unlimited | n/a |

ACV bands: Starter $20-30K, Pro $40-70K, Enterprise $100-200K. Mid-market fits Pro band cleanly.

Why hybrid: per-seat alone underprices the value per agent action; usage-only is unpredictable for compliance budget planning; platform-fee floor protects against tiny-team customers who consume lots of agent runs. The combination is what Hummingbird/Unit21 do — proven model for this buyer.

If you disagree: simpler all-in per-seat ($500/compliance-user/month). Easier to sell, leaves money on the table at high-usage accounts.

---

### Decision 8 — Build vs partner for sanctions/PEP feeds

**Recommendation:** **Three-tier approach matching the SKU tiers.**

- **Starter:** OFAC SDN + EU consolidated + UN public lists only (free, ingested by us)
- **Pro:** Add ComplyAdvantage embedded screening (partnership, revenue share or pass-through pricing)
- **Enterprise:** Dow Jones Risk feed (customer brings their own license, we integrate)

Why: building proprietary sanctions/adverse-media data is a 5-10 year investment ($50M+) — not your fight. Owning the *workflow* (how the data is used, surfaced, audited, agent-actioned) is the differentiation.

ComplyAdvantage partnership is the highest-leverage move: they're well-funded, have the data, lack the agent-product surface. A clean integration could become a referral pipeline both ways. Worth a 1-hour intro call this month.

If you disagree: license Dow Jones Risk from day 1 ($$$ — but you can sell at higher ACV). Only justified if a design partner explicitly requires it for procurement.

---

### Decision 10 — Acquirer-target shortlist

**Recommendation:** **Build active relationships with three over the next 12 months. Two horizontal AML incumbents + one parallel-stack defender.**

1. **LSEG** (owner of World-Check) — *defensive acquisition.* If AMLIQ Brain takes ground from World-Check at the mid-market, LSEG will want to acquire to defend, not lose share. Build the relationship via Refinitiv's data-licensing org first — natural conversation about adverse-media feeds.

2. **Moody's** (acquired RDC, BvD, kompany, Passfort — actively rolling up AML/KYC) — *strategic-stack acquisition.* Moody's playbook is bolting AI-native products onto its existing risk-data spine. AMLIQ Brain fits.

3. **NICE Actimize** — *modernization acquisition.* NICE's AML platform is on-prem and dated. Acquiring AMLIQ Brain gives them an AI-native cloud story. Lower probability than LSEG/Moody's but worth the meeting.

Secondary watch list: **ComplyAdvantage** (if partnership goes well, acquisition is the natural exit), **FIS** (modernization angle), **Snowflake Compliance Cloud** (their data-cloud + your application layer is a natural pairing).

Avoid actively pitching: Salesforce (just bought Doti — won't double-buy in 18 months), Microsoft (Copilot for Compliance internal effort), Google (Vertex AI — not interested in vertical SaaS).

Why this matters now: the founders of Doti spent ~6 months in conversations with Salesforce before the deal. M&A relationships compound. Start now even if exit is 18-24 months out.

---

## Part 3 — Updated Investor Narrative (integrating Brain into Series A)

This replaces the AMLIQ paragraph in the existing addendum's investor narrative and adds a new paragraph for Brain. Drop-in ready.

### Updated elevator pitch (one paragraph)

> FinsavvyAI is the operational stack for AI-generated software. As AI writes more code and runs more workflows, that work needs to be validated before merge, tested at runtime, orchestrated across environments, secured against autonomous misuse, and governed for compliance — and today those concerns are handled by separate point tools built for human developers and human compliance officers. We ship a unified platform (PushCI, Qestro, LunaOS, OpenSyber, SDLC.cc, TenantIQ, AMLIQ) with an open-source wedge (PipeWarden) that detects risky AI-generated PRs the moment they're proposed, and a vertical wedge (AMLIQ Brain) that becomes the organizational AI layer for compliance teams in regulated financial services — where horizontal enterprise-AI products (Salesforce/Doti, Glean) cannot legally or economically follow. Developers adopt PushCI for free, expand into Qestro and OpenSyber as AI usage hits production. Compliance teams adopt AMLIQ Brain for organizational AI search, expand into AMLIQ Investigate for deep case workflows, then into SDLC.cc + TenantIQ for board-level AI governance. Our category is **AI-native infrastructure for regulated AI work** — two GTM motions, one platform.

### Updated longer narrative (replace the AMLIQ paragraph + add Brain paragraph)

**The two wedges.** PushCI + PipeWarden OSS is the developer wedge. AI code-generation is now a daily workflow for ~30% of working developers, but the merge gate has not adapted: linters and SAST tools were built for human authorship patterns and miss the failure modes specific to LLM output. PipeWarden is the open-source detection engine; PushCI is the hosted product. **AMLIQ Brain is the compliance wedge.** Compliance officers at tier-2 banks and Series B+ fintechs face a budget squeeze: World-Check (LSEG) costs $150-500K/year and Glean ($50K+ horizontal AI search) doesn't know AML. AMLIQ Brain is a vertical AI layer that priced for the mid-market ($20-80K) does what horizontals won't — knows sanctions data, integrates with banking cores, drafts SARs, and tracks regulatory change. Salesforce just paid $100M for Doti (horizontal Israeli enterprise-AI search startup) after one year — validating that the AI-organizational-layer category is real. We're building the vertical version of that, where the buyer cannot use horizontal solutions.

**The expansion.** From either wedge, customers expand across the integrated platform. From the developer side: PushCI → Qestro (runtime QA) → OpenSyber (agent security) → SDLC.cc (governance). From the compliance side: AMLIQ Brain (organizational AI for compliance team) → AMLIQ Investigate (deep case management) → SDLC.cc (board-level AI policy) → TenantIQ (M365 governance for the same regulated org). Both motions converge at SDLC.cc and the platform layer, which is where revenue compounds.

**The moat** has four layers. First, **OSS gravity** — PipeWarden and (new) the FinsavvyAI RAG primitives both seed inbound and credibility. Second, **shared infrastructure** — auth, billing, telemetry, AI gateway, and policy engine built once, leveraged by 7+ products. Third, **the integrated trace** — every product writes to the same telemetry layer, so a single regulated organization can track a SAR from AMLIQ Brain draft → SDLC.cc approval → audit-grade log. Fourth, **vertical depth** — AMLIQ Brain knows AML/sanctions/regulatory feeds in a way horizontal enterprise-AI deliberately doesn't, because the economics of horizontal scale don't justify vertical investment.

**The category** is AI-native infrastructure for regulated AI work — both the AI software that engineering teams build, and the AI workflows that compliance and risk teams run. Two adjacent categories, one platform. The right comparison is what Datadog was to cloud monitoring (developer wedge that became infrastructure) crossed with what Bloomberg Terminal was to financial workflow (vertical-depth product that incumbents couldn't horizontally serve).

**Why now (updated).** Four forcing functions: (1) AI code-gen is past early-majority threshold inside engineering; (2) regulators (EU AI Act, US executive orders, Israeli AI directives, BSA modernization) are moving from guidance to enforceable compliance — creating a buyer for both SDLC.cc and AMLIQ Brain; (3) runtime AI agents are entering production — creating a buyer for OpenSyber and AMLIQ Brain (same agents now write code AND draft SARs); (4) **horizontal enterprise-AI consolidation** — Salesforce/Doti, Microsoft/Copilot, Google/Vertex have absorbed the horizontal AI-search category, leaving regulated verticals deliberately underserved. Window for vertical AI infrastructure is wide open and closing fast (estimated 18-24 months before the same acquirers move down-vertical).

**Use of funds (updated).** A Series A funds (a) finishing the platform consolidation (auth, billing, telemetry, AI gateway, policy engine) so new product launches cost weeks not quarters; (b) PushCI + PipeWarden GTM (developer growth, GitHub Marketplace, OSS content); (c) AMLIQ Brain GTM (design partners, SOC 2, compliance buyer outreach) — the highest-ACV motion, where one enterprise contract = 50 PushCI Pro accounts; (d) AMLIQ Investigate productization (the QuantumBeam fold-in and AML scoring consolidation per the addendum's weeks 4-6).

---

## Part 4 — Next concrete actions (this week)

Now that decisions are locked, the founder's next-7-day actions:

1. **Approve the brief + this decisions doc** — sign-off unlocks engineering work
2. **Identify 3 design-partner targets** — names + warm-intro paths (15 min)
3. **First ComplyAdvantage intro call** — partnership/data integration scoping (30 min)
4. **First LSEG conversation** — start at Refinitiv data-licensing for adverse-media feed access (long-game acquirer relationship)
5. **Series A pitch deck update** — add the AMLIQ Brain slide using narrative above (1-2 hours)
6. **Engineering kickoff** — Brain skeleton in `products/amliq/brain/`, RAG primitives promotion from `FinSavvyAI_Distributed_RAG`, first connector spike (Slack)

I can do #5 (deck slide draft) and #6's planning artifact (engineering task list) now if you want. Just say which.
