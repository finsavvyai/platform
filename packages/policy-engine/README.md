# @finsavvyai/policy-engine

## SPEC PACKAGE

This package is the canonical SPECIFICATION + reference implementation for
authorization policies and PR-check rules (PipeWarden lineage).
Products do NOT import from this package at runtime (round-2 isolation rule:
`products/*` must not import `@finsavvyai/*`).
Products MAY copy types or mirror logic from here; any drift is reviewed
against this source of truth.

See [SPEC.md](./SPEC.md) for the contract reference.

---

Policy engine. PipeWarden OSS rules, governance, PR checks.

Exports `RuleEngine`, `FileSizeRule`, `SecretScanRule`, types: `PolicyRule`, `PolicyContext`, `PolicyResult`.

## Decision matrix

| Severity | Decision |
|---|---|
| info, low | allow |
| medium | warn |
| high, critical | deny |

## Critical paths

- Policy decisions — 100% coverage required.
