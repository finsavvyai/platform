# Decisive 90-Day Plan — Execution Tracker

Source: `decisive_plan_90day.md` (locked 2026-05-25).
Target: AMLIQ Brain GA + Series A close by **2026-11-30**.

## Decisions reconciled vs prior matrix work

| # | Plan decision | Reality (after this session's work) | Status |
|---|---|---|---|
| 1 | Brain naming: AMLIQ Investigate + AMLIQ Brain | n/a code | locked |
| 2 | US-first M1-6 | n/a code | locked |
| 3 | Cloud-first + self-hosted day 1 | architectural | locked |
| 4 | finsavvy-rag → oss/, Apache 2.0 | Week 2-4 work, dispatched | in_progress |
| 5 | AMLIQ parallel migration | round-2 done; Brain shares same tree | locked |
| 6 | 3 design partners | founder action | pending |
| 7 | Hybrid pricing | n/a code | locked |
| 8 | Sanctions 3-tier (OFAC/CompA/DJR) | n/a code | locked |
| 9 | Brain into existing Series A | founder action | locked |
| 10 | LSEG/Moody's/NICE relationships | founder action | pending |
| 11 | a2a MIT | ✅ done commit `29b03823` | DONE |
| 12 | looma-sh externalize to `/Users/shaharsolomon/dev/projects/looma/` | ✅ rsync in progress; portfolio source deletion = user manual | in_progress |
| 13 | pixel-pets externalize out of portfolio | ✅ rsync to `/Users/shaharsolomon/dev/projects/pixel-pets-external/` in progress | in_progress |
| 14 | QueryFlux → 8th product | ✅ done commit `29b03823` | DONE |
| 15 | FinSavvy Cluster placement | **OVERRIDE**: keep at products/finsavvy-cluster/ AND Brain depends on it via inference layer | RESOLVED |
| 16 | autoboot ARCHIVE + fastpm.dev redirect | ✅ archive done commit `29b03823`; redirect = user manual | in_progress |
| 17 | opensource → vendored | ✅ done commit `bb4db8e1` | DONE |

## Week 1 status (May 25-31)

| Day | Action | Status |
|---|---|---|
| Mon | Approve plan | DONE (founder) |
| Mon | a2a MIT LICENSE | ✅ DONE commit `29b03823` |
| Mon | Halt looma + pixel-pets archive sweep | ✅ DONE — moved to externalized/ before any delete |
| Tue | Reclassify autoboot ARCHIVE | ✅ DONE commit `29b03823` |
| Tue | Take fastpm.dev down + redirect | ☐ user manual — see `_archive/fastpm-2026-05/TAKE_DOWN_ACTIONS.md` |
| Tue | QueryFlux migration to 8th product | ✅ DONE commit `29b03823` |
| Tue | 3 design-partner intro emails | ☐ founder action |
| Wed | ComplyAdvantage intro call scheduled | ☐ founder action |
| Wed | LSEG intro call scheduled | ☐ founder action |
| Thu | opensource → vendored | ✅ DONE commit `bb4db8e1` |
| Fri | Standup | ☐ founder + eng |

**Week 1 KPI:** 6/9 code items DONE. 3 founder-action items pending.

## Week 2-4 plan execution

### Stream A — Brain Build (dispatched as 5-agent swarm 2026-05-25)

| Week | Action | Owner |
|---|---|---|
| W2 | `products/amliq/brain/` scaffold (TS + Python) | BRAIN-SCAFFOLD agent |
| W2 | Wire `packages/auth` + `packages/telemetry` | BRAIN-SCAFFOLD agent |
| W2 | Spike tamper-evident audit log (cryptographic hash chain) | AUDIT-TAMPER agent |
| W3 | Compliance corpus ingest pipeline (FinCEN RSS + FFIEC PDF crawler → pgvector) | CORPUS-PIPELINE agent |
| W4 | Cut FinSavvyAI_Distributed_RAG → `oss/finsavvy-rag/` Apache 2.0 + README | RAG-OSS-PREP agent |
| W2 | Cluster ↔ Brain bridge per resolved #15 | CLUSTER-BRIDGE agent |

### Stream B — AMLIQ Investigate migration

Per addendum schedule (already in flight rounds 1-4). Tracked via `_archive/migration-status.md`.

### Stream C — GTM

Founder-led, tracked in `docs/GTM_TOP3_60DAY.md` and this doc.

## STOP gates

| Gate | When | Trigger |
|---|---|---|
| 1 | End W4 | OSS RAG release fails OR <2 design partners locked |
| 2 | End M2 | SAR Draft Agent <50% acceptable to partner #1 |
| 3 | End M3 | SOC 2 audit flags >5 material gaps |
| 4 | End M4 | <2 design partners converted to paid |
| 5 | End M5 | No Series A term sheet OR SOC 2 not awarded |
| 6 | End M6 | GA missed OR Series A unclosed |

## Out of scope (deliberately deferred)

Banking core integrations, EU/UK expansion, Dow Jones Risk integration, insurance/healthcare, Salesforce/MS/Google M&A, LunaOS repositioning, OpenSyber strategic decision, TenantIQ GTM acceleration (background only), PushCI+PipeWarden OSS launch (parallel only).

## Cross-cutting workstreams (background)

| Workstream | Owner | Cadence |
|---|---|---|
| AMLIQ Investigate migration | Eng lead | Weekly status update |
| Series A pitch maintenance | Founder | Monthly |
| Acquirer relationships (LSEG, Moody's, NICE) | Founder | Monthly each |
| OSS finsavvy-rag growth | Eng + DevRel | Weekly metrics |
| Design partner success | Founder + CSM | Weekly per partner |
| TenantIQ background | TenantIQ owner | Monthly to founder |
| PushCI + PipeWarden OSS | PushCI owner | Monthly to founder |

## Next review

Day 30 mid-window checkpoint (~2026-06-24). Day 60 (~2026-07-24). Final ~2026-11-30.
