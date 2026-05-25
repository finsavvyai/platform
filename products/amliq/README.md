# AMLIQ

**AI-native AML investigations. Replace World-Check at 1/10 the cost.**

AMLIQ is the AML (Anti-Money Laundering) investigation product in the
FinsavvyAI portfolio. Where legacy AML stacks (World-Check, LexisNexis,
Refinitiv) push analysts through fragmented sanctions lists, manual case
files, and per-record fees, AMLIQ runs autonomous investigations on top
of two production-grade fraud-scoring engines and exposes a single
decision API + analyst console.

> Status: **in migration**. This directory was populated by rounds 2 and 4
> of the FinsavvyAI monorepo consolidation. Build wiring is not yet
> complete — see `MIGRATION_NOTES.md`, `api/MIGRATION_NOTES.md`,
> `web/MIGRATION_NOTES.md`, and `CONSOLIDATION_TODO.md`.

## Why AMLIQ exists

- World-Check pricing is six figures per seat, per year; coverage is
  shallow and screening latency is high.
- AML analyst workflow is the textbook "humans copy-pasting between four
  tabs" problem an autonomous agent can collapse.
- Thesis (`finsavvyai_consolidation_plan_addendum.md` §2): AI-native
  operational tooling will displace legacy compliance vendors on cost,
  latency, and explainability — in that order.

## Directory layout (post round 4)

```
products/amliq/
├── README.md                     ← you are here
├── CLAUDE.md                     ← AMLIQ engineering rules (extends portfolio)
├── MIGRATION_NOTES.md            ← round-2 source paths, skip-list (engines)
├── CONSOLIDATION_TODO.md         ← post-migration ticket list
│
├── api/                          ← (round 4) unified decision API
│   │                               originally portfolio/aegis/
│   ├── decision.md               ← DESIGN of the unified AML decision surface
│   ├── MIGRATION_NOTES.md
│   └── (aegis tree as imported — go.mod = github.com/aegis-aml/aegis)
│
├── web/                          ← (round 4) analyst console (React + Vite)
│   │                               originally portfolio/amliq-frontend/
│   ├── MIGRATION_NOTES.md
│   └── (amliq-frontend tree as imported)
│
├── engines/                      ← (round 2) scoring engines — DO NOT EDIT
│   ├── quantumbeam/              ← quantum-enhanced fraud-scoring (Go + Python)
│   └── ml-fraud/                 ← classical ML fraud-detection (Go + Python)
│
└── internal/                     ← (round 2) cross-engine Go utilities
    └── shared/
```

## Decision API (target shape — design only today)

See `api/decision.md` for the full spec. Summary:

```
POST /v1/aml/decision    → Subject + Transaction → AmlDecision
POST /v1/aml/investigate → open multi-evidence case
GET  /v1/aml/cases/{id}  → case state + evidence
GET  /v1/aml/audit/{id}  → immutable audit record
GET  /health             → mesh health shape
```

Every decision MUST emit one audit record (round-1 shape, AMLIQ
extensions in `meta`). Audit sink failure blocks the response.

## Engines at a glance

| Engine | Path | Tech | Purpose |
|---|---|---|---|
| QuantumBeam | `engines/quantumbeam/` | Go + Python (VQC, QAOA) | Quantum-enhanced pattern detection (<50 ms target) |
| ML Fraud | `engines/ml-fraud/` | Go + Python (Isolation Forest, LSTM, Random Forest) | Classical ML scoring & anomaly detection |

Both engines currently declare `module quantumbeam`; `api/` declares
`module github.com/aegis-aml/aegis`. Three Go module identities coexist —
unification is the first item in `CONSOLIDATION_TODO.md`.

## What this is **not**

- Not a standalone fraud product. QuantumBeam is *folded in* as a
  sub-engine, per `finsavvyai_consolidation_plan_addendum.md` §1.
- Not a payments product. Payment orchestration lives in `packages/billing/`.
- Not an OSS distribution. AMLIQ is a closed-source commercial product;
  engines and policy live here.

## How the four trees relate

```
        ┌────────────────────────┐
        │  web/  (React console) │  ←──  HTTP/JSON  ──┐
        └────────────────────────┘                    │
                                                      │
        ┌────────────────────────┐                    │
        │   api/  (decision API) │  ←──────  /v1/aml/decision
        │   - JWT (@finsavvy/auth)│
        │   - aggregator         │
        │   - audit emit         │
        └─┬────────────────────┬─┘
          │                    │
          │ engine adapter (Go interface)
          │                    │
        ┌─▼────────┐    ┌──────▼──────┐
        │ engines/ │    │  engines/   │
        │quantumbm │    │  ml-fraud   │
        └──────────┘    └─────────────┘
                  │           │
                  └─internal/shared/─┘
```

## Next steps

See `CONSOLIDATION_TODO.md` for the ordered ticket list (P0 → P5).
The P0 work — Go module-name collision — blocks every downstream build.
