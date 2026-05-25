# AMLIQ

**AI-native AML investigations. Replace World-Check at 1/10 the cost.**

AMLIQ is the AML (Anti-Money Laundering) investigation product in the FinsavvyAI portfolio. Where legacy AML stacks (World-Check, LexisNexis, Refinitiv) push analysts through fragmented sanctions lists, manual case files, and per-record fees, AMLIQ runs autonomous investigations on top of two production-grade fraud-scoring engines and exposes a single decision API + analyst console.

> Status: **in migration**. This directory was populated by Round 2 of the FinsavvyAI monorepo consolidation. Build wiring is not yet complete — see `MIGRATION_NOTES.md` and the per-engine READMEs.

## Why AMLIQ exists

- World-Check pricing is six figures per seat, per year; coverage is shallow and screening latency is high.
- AML analyst workflow is the textbook "humans copy-pasting between four tabs" problem an autonomous agent can collapse.
- The thesis (see `finsavvyai_consolidation_plan_addendum.md` §2) is that AI-native operational tooling will displace legacy compliance vendors on cost, latency, and explainability — in that order.

## Engine layout

```
products/amliq/
├── README.md                      ← you are here
├── CLAUDE.md                      ← AMLIQ engineering rules (extends portfolio)
├── MIGRATION_NOTES.md             ← source paths, skip-list, known breakage
├── engines/
│   ├── quantumbeam/               ← quantum-enhanced fraud-scoring engine (Go)
│   │                                originally portfolio/fintech-suite/quantumbeam/
│   │                                positioned as sub-engine, NOT a standalone product
│   └── ml-fraud/                  ← classical ML fraud-detection engine (Go)
│                                    originally portfolio/fintech-suite/.../fraud-detection/
└── internal/
    └── shared/                    ← cross-engine shared utilities/types
                                     originally portfolio/fintech-suite/.../services/shared/
```

Both engines currently declare `module quantumbeam` in their `go.mod`. They are divergent copies of the same fraud-scoring code base (ml-fraud is the newer fork with extra audit + OIDC modules). Decision on whether to unify or keep two engines is deferred — see `MIGRATION_NOTES.md`.

## Decision API (target shape)

AMLIQ exposes one external surface:

```
POST /v1/aml/score         → run a single subject through both engines, return blended score + audit id
POST /v1/aml/investigate   → open an investigation case (multi-subject, multi-source)
GET  /v1/aml/cases/{id}    → retrieve case state + evidence trail
GET  /v1/aml/audit/{id}    → retrieve the immutable audit record for any scoring decision
```

Every scoring decision MUST write one audit record (see `CLAUDE.md`).

## Engines at a glance

| Engine | Path | Tech | Purpose |
|---|---|---|---|
| QuantumBeam | `engines/quantumbeam/` | Go + Python (VQC, QAOA) | Quantum-enhanced pattern detection |
| ML Fraud | `engines/ml-fraud/` | Go + Python (Isolation Forest, LSTM, Random Forest) | Classical ML scoring & anomaly detection |

## What this is **not**

- Not a standalone fraud product. QuantumBeam is *folded in* as a sub-engine, per `finsavvyai_consolidation_plan_addendum.md` §1.
- Not a payments product. Payment orchestration lives in `packages/billing/`.
- Not an OSS distribution. AMLIQ is a closed-source commercial product; engines and policy live here.

## Next steps (post round-2 migration)

1. Resolve the two `module quantumbeam` clashes — either rename one or split into a Go workspace.
2. Build the AMLIQ decision API on top of both engines (currently absent — neither engine exposes an AML-flavoured surface).
3. Wire up audit logging via the platform `packages/telemetry` audit channel.
4. Stand up the analyst web console at `products/amliq/web/` (migration of `amliq-frontend` is a separate ticket, see addendum §3).
