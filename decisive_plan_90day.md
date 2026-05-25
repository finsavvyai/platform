# FinsavvyAI — Decisive 6-Month Execution Plan

**Status:** May 26, 2026. Locked decisions integrated. Execution started. First 90 days prove the product; the following 90 days convert revenue, compliance, and the Series A.

**The bet:** Run the consolidation finish line in parallel with launching AMLIQ Brain, then close Series A on a "developer wedge + compliance wedge + integrated platform" thesis backed by 5 paying Brain customers and SOC 2 Type 1.

**The deadline:** AMLIQ Brain GA + Series A close by **November 30, 2026**.

## Scope frame

This is no longer framed as a pure 90-day plan. It is a 6-month execution plan with two explicit phases:

| Phase | Window | Purpose | Exit signal |
|---|---|---|---|
| Phase 1 | First 90 days, W1-W12 | Prove AMLIQ Brain, keep AMLIQ Investigate migration moving, lock design partners, start SOC 2. | 3 agents in weekly partner use, SOC 2 audit in progress, first Brain Pro contract drafted. |
| Phase 2 | Second 90 days, W13-W24 plus Nov close buffer | Convert design partners to paid, finish SOC 2 Type 1, launch Brain GA, close Series A. | 5+ paying customers, $500K+ ARR run-rate, SOC 2 Type 1, Series A closed. |

Calendar note: the week-by-week execution schedule runs through W24 (ending November 8). November 9-30 is the close buffer for legal, funding wires, customer procurement, and GA follow-through.

**Execution tracker:** `docs/execution/decisive_6month_implementation_status.md`

---

## Locked decisions (no re-litigation)

| # | Decision | Lock | Source |
|---|---|---|---|
| 1 | Brain naming | **AMLIQ umbrella, two SKUs: `AMLIQ Investigate` + `AMLIQ Brain`** | Brief Pt 1 |
| 2 | v1 jurisdiction | **US only (FinCEN-first) M1-6. UK + EU M7-12.** | Brief Pt 2 |
| 3 | Deployment model | **Cloud-first GA + self-hosted available from day 1** | Founder lock |
| 4 | OSS strategy | **`FinSavvyAI_Distributed_RAG` → `oss/finsavvy-rag/` under Apache 2.0** | Brief Pt 4 |
| 5 | AMLIQ migration | **Parallel — Investigate continues per addendum, Brain shares same tree** | Founder lock |
| 6 | Design partners | **3 segments: IL fintech + US tier-2 bank + regulated crypto exchange** | Brief Pt 6 |
| 7 | Pricing | **Hybrid: platform fee + per-seat + agent-action caps. Starter $0/$400, Pro $20K/$300, Enterprise $80K/$250** | Brief Pt 7 |
| 8 | Sanctions/PEP | **3 tiers: OFAC public (Starter) → ComplyAdvantage partnership (Pro) → Dow Jones Risk customer-licensed (Enterprise)** | Brief Pt 8 |
| 9 | Fundraise | **Roll Brain into existing Series A pitch (no separate seed)** | Founder lock |
| 10 | M&A relationships | **Start now with LSEG, Moody's, NICE Actimize. Avoid Salesforce/Microsoft/Google pitches.** | Brief Pt 10 |

## Decided by default (override before irreversible action)

| # | Decision | Default | Override path |
|---|---|---|---|
| 11 | a2a-framework LICENSE | **MIT, added day 1** | Reply with Apache 2.0 or BSL |
| 12 | looma-sh | **Externalize to `/Users/shaharsolomon/dev/projects/looma/`. Stop archive sweep.** | Reply with park / sell / archive |
| 13 | pixel-pets | **Externalize. Move out of `portfolio/`. Do not delete.** | Reply with park / archive |
| 14 | queryflux-git | **Promote to 8th core product as `products/queryflux/`. Folds in `queryflux/` + `querylens/`.** | Reply to keep archived |
| 15 | 02_AI_AGENTS/llm | **Fold into AMLIQ Brain as self-hosted inference layer. Do not productize separately.** | Reply to spin out as separate product |
| 16 | autoboot (FastPM) | **Reclassify ARCHIVE, redirect fastpm.dev → finsavvyai.com.** | Reply to keep running |
| 17 | opensource/ folder | **Move to `infrastructure/vendored/opensource/`. Mark third-party (not yours).** | n/a |

**Execution has started.** Any owner override before end of day Wednesday May 27 replaces a default before irreversible work on that item.

---

## Six-month schedule — prove first, close second

### Week 1 — Cleanup + relationship starts (May 25-31)

**Goal:** clear the deck and start the three acquirer + one partner conversation.

| Day | Action | Owner | Status gate |
|---|---|---|---|
| Mon | Approve this plan | Founder | Signed |
| Mon | Add MIT LICENSE to `oss/a2a-framework/` AND `portfolio/a2a-framework/` | Eng | File exists, committed |
| Mon | Halt looma-sh + pixel-pets archive sweep. Mark `_archive/portfolio-snapshots/looma-sh/` and `.../pixel-pets/` as ON HOLD pending externalize. | Eng | Manifests updated |
| Tue | Reclassify autoboot in inventory: ARCHIVE (FastPM product, parked domain). Take `fastpm.dev` site down or redirect. | Founder + Eng | Site down |
| Tue | QueryFlux: copy `portfolio/queryflux-git/` to `products/queryflux/`. Fold `queryflux/` + `querylens/` underneath. Update `pnpm-workspace.yaml`. | Eng | Build green |
| Tue | Send 3 design-partner intro emails (IL fintech, US tier-2 bank, crypto exchange) | Founder | Sent |
| Wed | First ComplyAdvantage intro call scheduled (within 14 days) | Founder | Calendar invite |
| Wed | First LSEG/Refinitiv data-licensing intro scheduled (within 21 days) | Founder | Calendar invite |
| Thu | Move `08_open_source/*` to `infrastructure/vendored/opensource/`. README marking third-party. | Eng | Moved |
| Fri | Standup: confirm Week 1 done. If any item slipped, replan or escalate. | Founder + Eng | All green or 1-line slip explanation |

**Week 1 KPI:** All 9 actions complete or formally deferred with reason. If 3+ slipped → pause Week 2 start, fix tooling/throughput first.

---

### Week 2-4 — Foundations (June 1-21)

**Goal:** Brain skeleton stands up + parallel AMLIQ Investigate migration unblocked + OSS RAG release v0.1.

| Week | Stream A: Brain Build | Stream B: AMLIQ Migration | Stream C: GTM |
|---|---|---|---|
| W2 | `products/amliq/brain/` scaffold (TS + Python services). Wire `packages/auth`, `packages/telemetry`. Spike `tamper-evident audit log`. | Promote `fintech-suite/api-gateway` → `packages/ai-gateway` (addendum Week 1). Test green. | Each design partner: 30-min discovery call. Confirm SAR-draft + alert-triage as top pains. |
| W3 | Compliance corpus ingest pipeline (FinCEN RSS + FFIEC PDF crawler). Index into pgvector. | Fold `billing-payments` → `packages/billing` (addendum Week 2). Fold `analytics` → `packages/telemetry`. | First ComplyAdvantage call. Pricing model walked through. Define Pro-tier integration scope. |
| W4 | OSS prep: cut `FinSavvyAI_Distributed_RAG` into `oss/finsavvy-rag/` with hardened pgvector + tamper-log. Apache 2.0 license. Public README + getting-started. | Start QuantumBeam migration scoping (addendum Week 4-6). | First LSEG/Refinitiv call. Position as data-licensing customer first. Acquirer relationship is downstream. |

**Week 4 KPIs:**
- `oss/finsavvy-rag/` v0.1 published to GitHub (private repo first if not ready for public)
- `packages/ai-gateway` + `packages/billing` + `packages/telemetry` all integrating fintech-suite code (addendum schedule holding)
- 3 design partners booked for monthly check-ins through M6
- 1 of 3 acquirer relationships in active conversation (data-licensing first contact done)

**STOP gate:** if any design partner backs out after discovery → replace within 14 days OR replan ICP. Don't proceed to M2 with <2 partners locked.

---

### Month 2 — Search live, first agent, partners signed (June 22 - July 19)

**Goal:** Brain demo-able end-to-end. First agent (SAR Draft) working on real partner data.

| Week | Brain Build | AMLIQ Investigate | GTM / Relationships |
|---|---|---|---|
| W5 | Slack + Confluence + Drive MCP connectors live (reuse `oss/mcp-tooling`). Search UI v0 with citations. | Migrate `aegis/` backend → `products/amliq/` (addendum Week 4). | Design partner #1 (IL fintech) signed for paid pilot at month 4. |
| W6 | SAR template library v0 (US FinCEN). SAR Draft Agent skeleton — alert input → template + context fill → human review UI. | QuantumBeam fold-in to `products/amliq/engines/quantumbeam/`. | Design partner #2 (US tier-2 bank) signed. |
| W7 | Multi-tenant data isolation (per-tenant pgvector instance or namespace). Audit log productionized. | ML fraud-detection fold-in. | Design partner #3 (crypto exchange) signed. ComplyAdvantage partnership terms drafted. |
| W8 | SAR Draft Agent running on partner #1's real (sanitized) transaction data. Iterate weekly with partner. | AML scoring API consolidated. AMLIQ Investigate has a demoable surface again. | 2nd LSEG meeting. Moody's first intro. |

**Month 2 KPIs:**
- SAR Draft Agent produces first real draft against partner data
- All 3 design partners weekly-active on Brain
- AMLIQ Investigate migration ≥70% complete
- ComplyAdvantage commercial terms agreed
- 2 of 3 acquirer relationships warm

**STOP gate:** if SAR Draft Agent quality is <50% acceptable to partner #1 by end of M2 → spend M3 W1 fixing model/retrieval before adding 2nd agent. Don't stack features on a broken first agent.

---

### Month 3 — Second + third agent, compliance prep (July 20 - August 16)

**Goal:** All three agents working. SOC 2 Type 1 audit kicked off. Brain Pro tier sellable.

| Week | Brain Build | AMLIQ Investigate | GTM |
|---|---|---|---|
| W9 | Regulatory Change Agent v0 — subscribes to FinCEN updates, drafts policy delta + Jira ticket. | Investigate UI polish + first internal demo. | Pricing & packaging finalized. Brain Pro pricing page drafted. |
| W10 | Alert Triage Agent v0 — pre-classifies alerts with reasoning chain. | First design partner walks through Investigate (separate from Brain). | SOC 2 Type 1 audit firm engaged. Scope confirmed. |
| W11 | Jira + Teams MCP connectors. Connector library hits 6/6 Phase-1 scope. | Investigate beta-ready. | First sales conversation with partner #1 — convert pilot to paid M4. |
| W12 | All 3 agents in feedback-loop with all 3 partners. Bug bash + perf tuning. | Investigate documented + pricing set. | 3rd acquirer relationship started (NICE Actimize). |

**Month 3 KPIs:**
- 3 agents running, all 3 partners using all 3 agents weekly
- SOC 2 Type 1 audit in progress
- Investigate beta-ready for separate selling
- 3/3 acquirer relationships warm + monthly cadence established
- First Brain Pro contract drafted

**STOP gate:** if SOC 2 audit firm flags >5 material gaps → reprioritize M4 to closing audit gaps, push GA from M6 → M7.

---

### Month 4 — First paying customers, ComplyAdvantage live (August 17 - September 13)

**Goal:** Partner #1 converts to paid. ComplyAdvantage integration shipping. Brain has revenue.

| Week | Brain Build | AMLIQ Investigate | GTM |
|---|---|---|---|
| W13 | Security review + pen test (external firm). | Investigate priced + sales-collateral ready. | Partner #1 paid contract closed. First invoice issued. |
| W14 | ComplyAdvantage integration live in Pro tier. Sanctions screening wired into Alert Triage Agent. | First Investigate paid pilot (different customer or same). | Partner #2 converted to paid OR replaced. |
| W15 | Pen test findings remediated. SOC 2 evidence collection in progress. | | Partner #3 converted to paid OR replaced. Series A pitch deck updated with Brain slides + 3-customer logos. |
| W16 | Brain Pro tier feature-complete. Documentation site live. | | First public Brain demo (conference, podcast, or webinar). |

**Month 4 KPIs:**
- ≥2 of 3 design partners on paid contracts ($40K+ ACV each)
- ComplyAdvantage integration in production
- Pen test critical/high findings = 0
- Series A deck updated with Brain slides + customer logos

**STOP gate:** if <2 partners convert to paid → pause new feature work, do customer success deep dive in M5 before pushing for GA.

---

### Month 5 — Hardening + Series A pitch (September 14 - October 11)

**Goal:** SOC 2 Type 1 awarded. Series A in process with 3+ term sheets being negotiated.

| Week | Brain Build | Investigate | Fundraise |
|---|---|---|---|
| W17 | SOC 2 Type 1 audit closeout. Final evidence. | Investigate productization wrap. | Series A pitches start. Tier-1 firm conversations begin (Sequoia, a16z, Bessemer, Index, Insight). |
| W18 | Marketing site refresh on `websites/finsavvyai.com/` — add Brain + Investigate sections. | First 2 Investigate paid customers. | Founder + bizdev on warm intro tour. |
| W19 | Performance + scaling work. Multi-region readiness (EU groundwork). | | First term sheet target. |
| W20 | GA readiness checklist: support runbooks, on-call rotation, incident response. | | Multiple term sheets, start negotiation. |

**Month 5 KPIs:**
- SOC 2 Type 1 awarded
- 3 Brain paying customers + 2 Investigate paying customers ($300K+ ARR run-rate)
- ≥1 Series A term sheet received
- LSEG / Moody's / NICE Actimize each had ≥4 touchpoints over 5 months

**STOP gate:** if SOC 2 slips OR no term sheet by end of M5 → push GA to M7, focus M6 on the missing item.

---

### Month 6 — Launch + raise close (October 12 - November 8)

**Goal:** AMLIQ Brain GA public. Series A closed. Investigate Q3 production launch planned.

| Week | Activity |
|---|---|
| W21 | AMLIQ Brain GA announcement (PR, blog, social, partner co-marketing) |
| W22 | First post-launch sales push. Inbound from OSS RAG starts converting. |
| W23 | Series A term sheet selected + signed |
| W24 | Series A funds close. Hiring plan executes (eng + sales for Brain). |

**Month 6 KPIs:**
- AMLIQ Brain GA live, 5+ paying customers, $500K+ ARR run-rate
- Series A closed at $X target (set ceiling at $12-18M based on Brain traction)
- AMLIQ Investigate Q3 launch path locked, eng resources allocated
- Public-facing OSS finsavvy-rag has 200+ stars (inbound indicator)

---

## Out of scope through Month 6 (deliberately deferred)

- Banking core integrations (Mambu/Temenos/Finastra) — M7-9
- EU + UK jurisdictional expansion — M7-12
- Dow Jones Risk feed integration — wait for first Enterprise customer demand
- Insurance / healthcare expansion — earliest M10+
- Salesforce / Microsoft / Google M&A conversations — explicitly avoided
- LunaOS repositioning — separate workstream, not Brain-dependent
- OpenSyber strategic decision (compete vs partner vs sell) — separate workstream
- TenantIQ GTM acceleration — runs in background, not blocked by Brain
- PushCI + PipeWarden OSS launch — runs in parallel, separate eng owner

## Cross-cutting workstreams (running in background)

| Workstream | Owner | Cadence |
|---|---|---|
| AMLIQ Investigate migration (addendum schedule) | Eng lead | Weekly addendum-status update |
| Series A pitch maintenance | Founder | Update deck monthly with new logo + ARR |
| Acquirer relationships (LSEG, Moody's, NICE Actimize) | Founder | Monthly touchpoint each |
| OSS finsavvy-rag growth | Eng + DevRel | Weekly star/issue/contribution metrics |
| Design partner success | Founder + CSM | Weekly check-ins per partner |
| TenantIQ background | TenantIQ owner | Monthly status to founder |
| PushCI + PipeWarden OSS | PushCI owner | Monthly status to founder |
| Sprint harness / infra tooling | Eng infra | Continuous (existing operation) |

## Resource needs

| Resource | When | Cost / Justification |
|---|---|---|
| External SOC 2 Type 1 audit firm | M3 W10 | $20-40K. Vanta / Drata + auditor. Required for enterprise sales. |
| External pen test | M4 W13 | $15-25K. Required for SOC 2 + enterprise procurement. |
| ComplyAdvantage partnership (pass-through pricing) | M2 W7 | Revenue share, no upfront. |
| Dow Jones Risk feed | M7+ | Customer-licensed. No cost to FinsavvyAI. |
| Eng headcount | Existing team can run if 3+ engineers full-time on Brain | If not, hire 1 senior backend (Python/Go) by M2 |
| Sales / GTM | M4 onward | Either founder-led through M6 OR hire fractional VP of Sales for enterprise motion |
| Series A advisory | M5 | $0 if friends-and-family advisors; otherwise minimal |

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SAR Draft Agent quality below partner threshold | Medium | High | M2 W8 quality gate, full M3 W1 reserved for fixes if needed |
| Design partner backs out | Medium | High | Have 4 named warm-intro candidates, not 3, so swap is fast |
| SOC 2 Type 1 timing slips | Medium | Medium | Engage auditor in M3 (not M5) to leave buffer |
| ComplyAdvantage partnership stalls | Low | Medium | OFAC-only Starter tier ships either way |
| Acquirer relationships go cold | Low | Low (90-day) / High (18-mo) | Monthly cadence; quarterly review of who's hot |
| Series A market closes | Low-Medium | High | Make Brain ARR + customer logos the primary signal regardless of macro |
| 02_AI_AGENTS/llm fold-in stalls self-hosted story | Medium | Medium | Self-hosted as "available" not "GA-required" — can defer to M9 if needed |
| Competing entrant in vertical RAG | High | Medium | Speed + depth + design partners are the moat; don't slow down |

---

## Decision gates (where founder must say STOP or PIVOT)

| Gate | When | Trigger to pause/pivot |
|---|---|---|
| 1 | End W4 | OSS RAG release fails OR <2 design partners locked |
| 2 | End M2 | SAR Draft Agent <50% acceptable to partner #1 |
| 3 | End M3 | SOC 2 audit flags >5 material gaps |
| 4 | End M4 | <2 design partners converted to paid |
| 5 | End M5 | No Series A term sheet OR SOC 2 not awarded |
| 6 | End M6 | GA missed OR Series A unclosed |

Each gate has a "what to do if triggered" — see Risk register.

---

## What this plan deliberately does NOT do

- Re-litigate the consolidation plan or addendum — those are settled, just executing
- Plan past 6 months — that's a different document, after Series A close
- Address LunaOS / OpenSyber / TenantIQ strategy — separate workstreams
- Commit to specific Series A round size or terms — that's market-determined
- Hire a CRO, CMO, or VP Eng — founder-led through M6; org build is a post-A activity
- Promise vertical expansion (healthcare, insurance) — those come after AML proof
- Pretend timeline has zero slip risk — gates exist precisely because slip is expected somewhere

---

## One-line summary

**Run 4 parallel workstreams (Brain build, AMLIQ Investigate migration, GTM with 3 design partners, fundraise + acquirer relationships) for 6 months. Six STOP gates. End state: Brain GA + 5 paying customers + SOC 2 + Series A closed. Everything else deferred.**
