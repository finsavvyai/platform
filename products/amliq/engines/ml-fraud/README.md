# ML Fraud — classical ML fraud-scoring engine (AMLIQ sub-component)

**Sub-component of the AMLIQ product. Not a standalone product.**

## Status

Migrated into the FinsavvyAI monorepo as `products/amliq/engines/ml-fraud/` per `finsavvyai_consolidation_plan_addendum.md` §1, from `portfolio/fintech-suite/fintech-enterprise-platform/services/fraud-detection/`.

The upstream README is preserved as `README.upstream.md`.

## Relationship to QuantumBeam (the other AMLIQ engine)

`engines/ml-fraud/` and `engines/quantumbeam/` are **divergent copies of the same fraud-scoring codebase**. Evidence:

- Both `go.mod` files declare `module quantumbeam`.
- The upstream README explicitly says "Migrated from: QuantumBeam.io."
- `internal/`, `cmd/`, and `pkg/` directories share the same skeleton.

`ml-fraud` is the **newer fork** — it has additional modules not present in the original QuantumBeam tree:

- `internal/audit/` (audit-helper helpers)
- `internal/auth/sso_oidc_*` (full OIDC SSO flow)
- `internal/auth/audit_helpers_*`
- `internal/auth/rate_limit_security_test.go`, `security_test.go`
- `internal/auth/sso_role_mapping.go`

QuantumBeam still has features (notably the full Python `services/quantum/` package) that ml-fraud does not.

Decision deferred: do the engines stay separate (each producing an independent score that the AMLIQ decision API blends), or do we collapse them into one engine plus a quantum extension? Tracked in `products/amliq/MIGRATION_NOTES.md` as known follow-up.

## Tech stack (as migrated)

- Go 1.25 orchestration + HTTP
- Python ML services in `ml-services/` (anomaly-detection, correlation, resource-optimization)
- Same Postgres / Redis / InfluxDB adapter pattern as QuantumBeam

## What was NOT migrated

- `node_modules/`, `vendor/`, `bin/`, `build/`, `dist/`, `coverage/`
- Python `venv/`, `test_venv/`
- Tooling caches (`.git/`, `.vscode/`, etc.)

## Build status

**Not verified.** Same caveats as QuantumBeam: module-name collision with the sister engine, untested imports, legacy Cloudflare bindings. See `products/amliq/MIGRATION_NOTES.md`.

## For the AMLIQ team

When wiring this engine into the AMLIQ decision API, route scoring calls so that they emit the audit-log record defined in `products/amliq/CLAUDE.md`. Engine version (git SHA) must appear in `engine_versions.ml_fraud`.
