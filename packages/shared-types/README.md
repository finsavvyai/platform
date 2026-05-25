# @finsavvyai/shared-types

## SPEC PACKAGE

This package is the canonical SPECIFICATION + reference implementation for
cross-product wire types (AML scoring, audit events, branded identifiers).
Products do NOT import from this package at runtime (round-2 isolation rule:
`products/*` must not import `@finsavvyai/*`).
Products MAY copy types or mirror logic from here; any drift is reviewed
against this source of truth.

See [SPEC.md](./SPEC.md) for the contract reference.

---

Cross-product TypeScript type contracts for the FinsavvyAI platform.

## Scope

This package holds **type definitions only** — no runtime code, no I/O, no business logic. It is the place where two or more products/packages agree on a wire shape.

Current contracts:

- **AML scoring** (`aml.ts`) — `ScoreRequest`, `ScoreResponse`, `Decision`, `EngineScore`
- **Audit events** (`audit.ts`) — `AuditEvent` matching the shape mandated by `swarm-conventions.md`
- **Common identifiers** (`ids.ts`) — branded `SubjectId`, `CaseId`, `ActorId`, `AuditId`

## Why a separate package?

- AMLIQ's decision API and any future analyst console must agree on the wire format.
- `packages/telemetry` consumes the audit-event shape but cannot import from `products/amliq` (cross-product import rule).
- Other products (TenantIQ, OpenSyber) will eventually emit AML-style decisions; they need the same contracts.

## What this is **not**

- Not a place for product-specific types (those stay inside the product directory).
- Not a place for auth primitives (use `@finsavvyai/auth`).
- Not a place for UI components (those will live in `oss/design-system/`).
- Not a place for utility functions (types only).

## Source origin

The Round-2 migration brief pointed at `portfolio/fintech-suite/fintech-enterprise-platform/services/shared/` as a candidate source. Inspection found that directory contained mostly:

- `utils/*.ts` files that were empty stubs (`export {};`)
- `auth/*.ts` that overlaps with `@finsavvyai/auth` (round-1 hardened — do not duplicate)
- `ui/*.ts` that belongs in the future design system
- `workers/src/*.ts` that are integration handlers, not shared types

So nothing was lifted verbatim. The contracts in `src/` were written fresh against the AMLIQ engine surfaces (`engines/quantumbeam/`, `engines/ml-fraud/`) to give the AMLIQ decision API a defined target.

See `products/amliq/internal/shared/` for the Go-side cross-engine code (separate concern — Go has its own internal package convention).
