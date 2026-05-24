# @finsavvyai/policy-engine

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
