# AMLIQ Migration Notes (Round 2)

Migration agent: **AMLIQ** (round 2 of 5).
Authority: `finsavvyai_consolidation_plan_addendum.md` §1, `/tmp/finsavvyai-migration-conventions.md`.

## Source → target map

| Source (read-only) | Target (new) |
|---|---|
| `/portfolio/fintech-suite/quantumbeam/` | `products/amliq/engines/quantumbeam/` |
| `/portfolio/fintech-suite/fintech-enterprise-platform/services/fraud-detection/` | `products/amliq/engines/ml-fraud/` |
| `/portfolio/fintech-suite/fintech-enterprise-platform/services/shared/` | `products/amliq/internal/shared/` (Go-relevant content) |
| *(nothing lifted verbatim)* | `packages/shared-types/` (new TS package, fresh contracts) |

## What was copied

- All `.go`, `go.mod`, `go.sum`, `Dockerfile*`, `Makefile`, `*.yaml`, `*.yml`, `*.toml`, `*.md`, `*.py`, `*.proto`, `*.sh`, `*.json` files from the source trees.
- Directory structure preserved verbatim (subject to skip list below).

| Target | Files | Size |
|---|---|---|
| `engines/quantumbeam/` | 754 | 24 MB |
| `engines/ml-fraud/` | 480 | 45 MB |
| `internal/shared/` | 306 | 4.2 MB |

## What was skipped (and why)

Per migration-conventions §"Hard rules" and the brief's constraint #4, the following directories were excluded from the rsync:

| Excluded | Reason |
|---|---|
| `node_modules/` | Rebuild from lockfile. |
| `vendor/` | Re-vendor with `go mod vendor` if needed. |
| `.git/` | Source repo metadata, not part of migration. |
| `dist/`, `build/`, `bin/` | Build artefacts. |
| `coverage/`, `coverage.out` | Test artefacts. |
| `venv/`, `test_venv/` | Python virtualenvs (~4 GB combined inside `engines/quantumbeam/services/{quantum,ml}`). Rebuild with `setup_venv.sh`. |
| `.wrangler/`, `.luna/`, `.kiro/`, `.vscode/`, `.claude/` | Tooling caches. |
| `test_data/` (top-level in QB) | Large fixtures; rebuild from upstream when needed. |
| `*.log` | Local logs. |

## Known-broken / needs follow-up

### Module-name collision (HIGH priority)

Both `engines/quantumbeam/go.mod` and `engines/ml-fraud/go.mod` declare:

```go
module quantumbeam
```

They cannot coexist in a single Go workspace. Two ways out:

1. Rename one (preferred): `module github.com/finsavvyai/amliq/engines/quantumbeam` and `.../ml-fraud`, then fix every internal import (every `"quantumbeam/internal/..."` string in the corresponding tree).
2. Treat each as a separate Go module loaded only when its own engine is built; never compile both into the same binary. Cheaper short-term, but blocks the AMLIQ decision-API process if it needs to call both engines in-proc.

Recommendation: option 1. Track as the first AMLIQ post-migration ticket.

### Suspect import paths

`grep` against migrated Go files surfaced these external-style imports that probably never resolved in the upstream either (they look like aspirational module paths):

```
"github.com/quantumbeam/internal/backup/integration"
"github.com/quantumbeam/monitoring/internal/logging"
"github.com/quantumbeam/monitoring/internal/metrics"
"github.com/quantumbeam/security/testing"
```

Files that import them:

- `engines/quantumbeam/security/scripts/run-security-tests.go`
- `engines/quantumbeam/internal/backup/providers/fraud_detector.go`
- `engines/quantumbeam/internal/backup/providers/api_service.go`
- `engines/quantumbeam/internal/backup/api/backup_server.go`
- `engines/quantumbeam/services/monitoring/cmd/monitoring-service/main.go`

These need to either resolve to `quantumbeam/internal/...` paths or be deleted as dead code.

### Engines are divergent forks of the same codebase

Evidence:

- Both `go.mod` files declare `module quantumbeam`.
- `engines/ml-fraud/README.upstream.md` says "Migrated from: QuantumBeam.io."
- `internal/`, `cmd/`, `pkg/` skeletons are near-identical.

`ml-fraud` has extra modules QuantumBeam lacks:

- `internal/audit/`
- `internal/auth/sso_oidc_service.go`, `sso_oidc_handlers.go`, `sso_oidc_flow_test.go`
- `internal/auth/audit_helpers*.go`
- `internal/auth/sso_role_mapping.go`
- `internal/auth/rate_limit_security_test.go`, `security_test.go`

`quantumbeam` has the full Python `services/quantum/` (VQC/QAOA) and a separate `services/ml/` Python tree that ml-fraud also has (in `ml-services/`). Net: not interchangeable.

**Decision deferred:** keep as two engines (decision API blends scores) **or** unify into one engine with a quantum extension. Tracked for AMLIQ team.

### No AMLIQ decision API yet

Neither engine exposes an AML-flavoured endpoint. The original products were "fraud-scoring services." The AMLIQ-shaped decision API (`POST /v1/aml/score`, `POST /v1/aml/investigate`, audit-emit on every call) is **net new** and must be built. It will sit at `products/amliq/cmd/amliq-api/` (or similar) once the module-name collision is resolved.

### Legacy infrastructure references

Multiple `wrangler.toml`, `docker-compose*.yml`, and `k8s/` manifests in `engines/quantumbeam/` reference legacy Cloudflare account IDs, GitHub orgs, and Kubernetes namespaces from the old standalone deployment. These need to be retargeted or removed before any `engines/quantumbeam/` deploy is attempted from this repo.

### Upstream `CLAUDE.md` mislabel

`/portfolio/fintech-suite/quantumbeam/CLAUDE.md` (still in upstream — not copied) describes the project as "algorithmic trading." The actual code is fraud detection. The addendum explicitly notes this; this migration sides with the addendum.

## `internal/shared/` (Go-side cross-engine code)

Copied wholesale from `services/shared/`. Contents are mixed:

- `auth/` — overlaps with `@finsavvyai/auth` (round-1 hardened package). **Do not** route any AMLIQ traffic through this; use the platform auth package. Kept here only because the engines still import from it under their current state.
- `utils/*.ts` — empty stubs (`export {};`). No real content.
- `ui/`, `workers/`, `sdk/` — TS/JS web layer artefacts. Will likely move to `oss/design-system/` and `websites/finsavvyai.com/` in later rounds.
- `infrastructure/` — Cloudflare templates.

Recommendation: shrink `internal/shared/` to only what the Go engines actually import. Treat the rest as candidate-for-archive.

## `packages/shared-types/` (TS package, net-new)

Created per the migration brief's instruction to "use judgment" when the source had no real shared TS content. The source `services/shared/utils/*.ts` files were placeholders; `auth/` overlaps with `@finsavvyai/auth`; `ui/` overlaps with the future design system.

Instead, a fresh package was authored with the cross-product type contracts the AMLIQ decision API will need:

- `aml.ts` — `ScoreRequest`, `ScoreResponse`, `Decision`, `EngineScore`
- `audit.ts` — `AuditEvent` matching the swarm-convention shape + AMLIQ extensions
- `ids.ts` — branded `SubjectId`, `CaseId`, `ActorId`, `AuditId`, `EngineVersion`

All files are <100 lines (200-line cap respected). Vitest test files colocated.

The `pnpm-workspace.yaml` already includes `packages/*`, so no workspace change was required.

## Files NOT touched

Per migration-conventions ownership rules:

- `/packages/auth/`, `/packages/billing/`, `/packages/telemetry/`, `/packages/policy-engine/`, `/packages/ai-gateway/` — owned by other round-1/round-2 agents.
- `/products/` skeleton creation — owned by SKELETON agent. AMLIQ only wrote to `/products/amliq/`.
- `/portfolio/fintech-suite/` — read-only.

## Test status

- `engines/quantumbeam/`, `engines/ml-fraud/`, `internal/shared/`: **not built, not tested** (brief constraint #3).
- `packages/shared-types/`: tests authored but not executed inside the agent process. Expect green on first `pnpm test` against the package.

## Coverage delta

N/A for `engines/*` and `internal/shared/` (Go, untouched).
`packages/shared-types/`: 0 % → covered (small surface, tests authored for both type guards and id constructors).

## Residual risks summary

1. Two engines with the same Go module name — cannot build both into one binary today.
2. AMLIQ decision API is unimplemented; engines have no AML-shaped surface.
3. `internal/shared/` is over-broad and overlaps with round-1 packages.
4. Legacy infra configs (wrangler/docker/k8s) point to old accounts.
5. Suspect `github.com/quantumbeam/...` imports likely already broken upstream.
