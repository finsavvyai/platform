# AMLIQ — Product-level CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules). This file may **add** stricter rules. It may **not** weaken any portfolio rule.

## Product mission & target user

- **Mission:** displace World-Check on cost (1/10×), latency, and explainability.
- **Target user:** AML analysts in regulated FIs, fintechs, crypto exchanges, and gaming operators.
- **Definition of value:** every analyst-minute eliminated, every false positive avoided, and every regulator-defensible audit trail produced.

## Product-specific architecture constraints

- AMLIQ is **two engines + one decision API + one analyst console**. Do not introduce a third engine without an ADR.
- Engine boundary: both engines live under `engines/<name>/`. They expose Go interfaces; the AMLIQ decision layer is the *only* caller. No engine-to-engine coupling.
- All scoring decisions flow through the AMLIQ decision API. No engine is allowed to be called directly by an external client.
- Shared, cross-engine Go code lives in `internal/shared/` (Go internal package — not importable outside this product tree).
- Cross-product types (consumed by other FinsavvyAI packages) live in `/packages/shared-types/`, not here.

## Product-specific test matrix

Portfolio baseline: lines ≥ 90 %, branches ≥ 85 %, functions ≥ 90 %.

AMLIQ raises the bar on the critical path:

| Surface | Coverage requirement |
|---|---|
| AML scoring decision functions (the function that returns the final blended score) | **100 %** line + branch |
| Audit-log emit path (every scoring decision writes one record) | **100 %** line + branch |
| Sanctions-list ingestion + match logic | ≥ 95 % line, ≥ 90 % branch |
| Engine adapters (`engines/*` Go interfaces) | ≥ 90 % line |
| Internal utilities (`internal/shared`) | portfolio baseline |

Every bug found in scoring or audit logic must ship a failing test first, then the fix. No exceptions.

## Product-specific security controls

Security is **release-blocking** (portfolio rule, restated for emphasis).

- All scoring inputs validated at the decision-API boundary. Engines receive only sanitised structs.
- Sanctions-list providers (OFAC, EU, UN, UK) accessed via signed, version-pinned URLs. No mid-flight list mutation.
- PII handling: subject identifiers stored hashed at rest. Audit log carries the hash, never the plaintext name.
- Engine outputs (scores, feature attributions) are surfaced to the analyst; raw model internals are never returned to API clients.
- Secrets pulled from the platform secret store; never in Git, never in container images, never in logs.
- Dependency vulnerability scan: any **Critical** or **High** finding in `engines/quantumbeam/`, `engines/ml-fraud/`, or `internal/shared/` blocks release.

## Audit log requirements (AMLIQ-specific)

Every scoring decision MUST emit exactly **one** audit record with this shape:

```
{
  ts:              ISO-8601 timestamp,
  actor_id:        caller principal (api-key id or oauth subject),
  event:           "aml.score" | "aml.investigate.open" | "aml.case.update" | ...,
  resource:        case_id or subject_hash,
  decision:        "clear" | "review" | "block",
  reason:          short stable code (e.g. "sanctions_match", "model_confidence_low"),
  engine_versions: { quantumbeam: <sha>, ml_fraud: <sha> },
  scores:          { quantumbeam: 0..1, ml_fraud: 0..1, blended: 0..1 }
}
```

No PII in `reason`. No raw names, no full account numbers — hash if needed.

## Product-specific release checklist

Before tagging an AMLIQ release:

- [ ] CI green: unit + integration + smoke.
- [ ] Coverage thresholds (table above) met; report archived.
- [ ] Security scans clean (SAST, deps, secrets, licence).
- [ ] Audit-log shape change? → schema migration documented and consumers notified.
- [ ] Sanctions-list snapshot pinned; rollback list version recorded.
- [ ] Engine adapters version-pinned in the decision API.
- [ ] Analyst console smoke test (login → run score → view audit → close case).
- [ ] Apple HIG accessibility checks on the analyst console (contrast, keyboard nav, screen-reader labels).
- [ ] Rollback plan validated (last-known-good engine versions documented).

## File size

- Portfolio 200-line cap applies to all **new** code added under `products/amliq/`.
- Migrated code (`engines/quantumbeam/`, `engines/ml-fraud/`) that exceeds 200 lines was inherited from upstream and is exempt **only** until the first non-trivial edit. First edit ⇒ split.

## Allowed overrides summary

- Stricter coverage on scoring + audit paths (above). ✅
- Stricter audit-log shape (above). ✅
- Stricter dependency-vuln gating (Critical/High = block, no waiver). ✅

## Disallowed overrides

None applied. Nothing in this file lowers a portfolio rule.
