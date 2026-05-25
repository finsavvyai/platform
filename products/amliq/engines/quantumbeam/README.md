# QuantumBeam — fraud-scoring engine (AMLIQ sub-component)

**QuantumBeam is a quantum-enhanced fraud-detection engine. It is a sub-component of the AMLIQ product, not a standalone product.**

## Status

Migrated into the FinsavvyAI monorepo as `products/amliq/engines/quantumbeam/` per `finsavvyai_consolidation_plan_addendum.md` §1. The original standalone-product framing (marketing site, independent deploys, separate brand presence) is **retired**. QuantumBeam now exists only as one of AMLIQ's two fraud-scoring engines.

The previous top-level README, which positioned QuantumBeam as a standalone product, is preserved as `README.original.md` for archival reference only. Do not link to it from new docs.

> **Note on the upstream `CLAUDE.md`** — at `/portfolio/fintech-suite/quantumbeam/CLAUDE.md` the project was mislabeled as "algorithmic trading." The README and the Go code (see `internal/fraud/`, `services/quantum/`, `services/ml/`) make clear the actual purpose is **fraud detection**. The addendum sides with the code: AMLIQ treats this engine as fraud scoring.

## Role inside AMLIQ

| Responsibility | Where |
|---|---|
| Quantum pattern detection (VQC, QAOA, quantum kernels) | `services/quantum/` (Python) |
| Classical fallback when quantum backend unavailable | `services/ml/` (Python) |
| Go orchestration + HTTP surface | `cmd/`, `internal/`, `pkg/` |
| Engine adapter (called by AMLIQ decision API) | **TBD** — not yet implemented; tracked in `products/amliq/MIGRATION_NOTES.md` |

External callers MUST go through the AMLIQ decision API. Do not expose this engine directly.

## Tech stack (as migrated)

- Go 1.21 (orchestration, HTTP, infrastructure)
- Python (quantum + classical ML services under `services/quantum/`, `services/ml/`)
- Redis, InfluxDB, Postgres adapters in `pkg/`
- Cloudflare Workers + Wrangler artifacts in `src/`, `cloudflare/` (legacy edge layer — may be archived or absorbed by `packages/ai-gateway`)

## What was NOT migrated

- `node_modules/`, `vendor/`, `bin/`, `build/`, `dist/`, `coverage/`
- Python `venv/` and `test_venv/` directories (~4 GB combined)
- `.wrangler/`, `.luna/`, `.kiro/`, `.vscode/`, `.claude/` tooling caches
- `test_data/` fixtures (large blobs — rebuild from upstream when needed)

See `products/amliq/MIGRATION_NOTES.md` for the full skip list and known-broken items.

## Build status

**Not verified.** Per the migration brief, no build attempts were made during round-2 relocation. Expected breakage:

- `go.mod` module name is `quantumbeam` — collides with the sister engine `engines/ml-fraud/` (same module name).
- Some imports may reference the upstream parent path; not audited yet.
- Cloudflare Worker bindings in `wrangler.toml` reference legacy account/zone IDs.

Resolve before first build attempt.

## For the AMLIQ team

When implementing the AMLIQ decision-API adapter for this engine, conform to the audit-log shape defined in `products/amliq/CLAUDE.md` — every score call must emit one structured audit record.
