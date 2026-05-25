# AMLIQ — Product-level CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules).
This file may **add** stricter rules. It may **not** weaken any portfolio
rule. Revised in round 4 to cover the merged scope: `api/` + `web/` +
`engines/*` + `internal/`.

## Product mission & target user

- **Mission:** displace World-Check on cost (1/10×), latency, and
  explainability.
- **Target user:** AML analysts in regulated FIs, fintechs, crypto
  exchanges, and gaming operators.
- **Definition of value:** every analyst-minute eliminated, every false
  positive avoided, every regulator-defensible audit trail produced.

## Product-specific architecture constraints

- AMLIQ is **two engines + one decision API + one analyst console**. Do
  not introduce a third engine or a parallel API without an ADR.
- Engine boundary: both engines live under `engines/<name>/`. They expose
  Go interfaces; the AMLIQ decision API (`api/`) is the *only* caller. No
  engine-to-engine coupling.
- All scoring decisions flow through `api/` (`/v1/aml/decision`). No
  engine is allowed to be called directly by an external client.
- Shared, cross-engine Go code lives in `internal/shared/` (Go internal
  package — not importable outside this product tree).
- Cross-product types (consumed by other FinsavvyAI packages) live in
  `/packages/shared-types/`, not here.
- The web console (`web/`) is React + Vite + TypeScript and talks **only**
  to `api/` over JSON/HTTP. No engine-direct access. No Supabase direct
  access (legacy — migration ticket).

## Product-specific test matrix

Portfolio baseline: lines ≥ 90 %, branches ≥ 85 %, functions ≥ 90 %.

AMLIQ raises the bar on the critical path:

| Surface | Coverage requirement |
|---|---|
| `api/` decision logic (aggregator + routing + blend) | **100 %** line + branch |
| `api/` audit-log emit path (every decision writes one record) | **100 %** line + branch |
| `api/` auth middleware (`@finsavvyai/auth` integration, role checks) | **100 %** line + branch |
| Sanctions-list ingestion + match logic | ≥ 95 % line, ≥ 90 % branch |
| Engine adapters (Go interfaces between `api/` and `engines/*`) | ≥ 95 % line |
| Web console: decision-detail view, audit-id deep-link | ≥ 90 % line |
| Internal utilities (`internal/shared`) | portfolio baseline |

Every bug found in scoring, audit, or auth logic must ship a failing test
first, then the fix. No exceptions.

## Product-specific security controls (release-blocking)

- All scoring inputs validated at the `api/` boundary. Engines receive only
  sanitised structs.
- Sanctions-list providers (OFAC, EU, UN, UK) accessed via signed,
  version-pinned URLs. No mid-flight list mutation.
- **PII handling:** subject identifiers stored hashed at rest. Audit log
  carries the hash, never the plaintext name. The decision-detail
  endpoint **never** returns plaintext PII to the analyst console.
- **PII-free reasons:** every `reason` field in `EvidenceItem`,
  `AmlDecision`, and audit records is a stable code (e.g.
  `sanctions_match`, `model_confidence_low`). Never a free-form string
  containing names, addresses, or transaction descriptions.
- Engine outputs (scores, feature attributions) are surfaced to the
  analyst; raw model internals are never returned to API clients.
- Secrets pulled from the platform secret store; never in Git, never in
  container images, never in logs.
- Constant-time HMAC / token comparison wherever pre-shared keys appear.
- Dependency vulnerability scan: any **Critical** or **High** finding in
  `api/`, `web/`, `engines/quantumbeam/`, `engines/ml-fraud/`, or
  `internal/shared/` blocks release. No waiver.

## Audit log requirements (AMLIQ-specific, mandatory)

Every scoring decision MUST emit exactly **one** audit record using the
round-1 audit shape with AMLIQ extensions in `meta`:

```
{
  ts:        ISO-8601 timestamp,
  actor_id:  caller principal (api-key id or oauth subject),
  event:     "aml.decision" | "aml.investigate.open" | "aml.case.update" | ...,
  resource:  "<subjectHash>:<transactionId>" | case_id,
  decision:  "clear" | "review" | "block",
  reason:    short stable code (e.g. "sanctions_match"),  // NO PII
  meta: {
    engines:       { quantumbeam: {score, version}, ml_fraud: {score, version} },
    blendedScore:  0..1,
    partial:       boolean,
    policyVersion: string,
    latencyMs:     number
  }
}
```

- **Audit emit failure blocks the response.** A decision that cannot be
  audited MUST NOT be served. This is release-blocking.
- Sink uses round-3 env-var convention: `FINSAVVY_AUDIT_SINK`,
  `FINSAVVY_AUDIT_R2_BUCKET`, `FINSAVVY_AUDIT_DD_API_KEY`.

## Authentication

- All `/v1/aml/*` calls require a JWT verified by `@finsavvyai/auth`
  (round-1 hardened module).
- Role required: `aml:decision:write` for `/v1/aml/decision`.
- Default deny. Unknown role → 403, audit-logged.

## SOC 2 mapping (evidence retention)

| SOC 2 control | AMLIQ artefact |
|---|---|
| CC6.1 Logical access | `@finsavvyai/auth` JWT + role gates; audit on every grant/deny |
| CC6.3 Authorisation changes | role-grant events in audit sink |
| CC7.2 Anomaly detection | engine scores ≥ `reviewCutoff` trigger alerts |
| CC7.3 Incident response | every blocked decision auto-opens an evidence record |
| C1.2 Confidentiality | PII hashed at boundary; audit `reason` PII-free |
| C1.4 Data retention | decisions + evidence retained per tenant policy (default 7y); purges audited |

Evidence retention is a **release gate**: the storage schema and
purge-cron behaviour must be documented and tested before any production
deploy.

## Product-specific release checklist

Before tagging an AMLIQ release:

- [ ] CI green: unit + integration + smoke.
- [ ] Coverage thresholds (table above) met; report archived.
- [ ] Security scans clean (SAST, deps, secrets, licence).
- [ ] Audit-log shape change? → schema migration documented and consumers
      notified.
- [ ] Sanctions-list snapshot pinned; rollback list version recorded.
- [ ] Engine adapters version-pinned in the decision API.
- [ ] `web/` console smoke test (login → run decision → view audit →
      close case).
- [ ] Apple HIG accessibility checks on `web/` (contrast, keyboard nav,
      screen-reader labels).
- [ ] Rollback plan validated (last-known-good engine versions documented).
- [ ] SOC 2 evidence-retention behaviour exercised on staging.

## File size

- Portfolio 200-line cap applies to all **new** code added under
  `products/amliq/`.
- Migrated code (`api/`, `web/`, `engines/quantumbeam/`,
  `engines/ml-fraud/`) that exceeds 200 lines is inherited from upstream
  and is exempt **only** until the first non-trivial edit. First edit ⇒
  split.

## Allowed overrides summary

- Stricter coverage on decision + audit + auth paths (above). ✅
- Stricter audit-log shape — emit failure blocks response. ✅
- Stricter dep-vuln gating (Critical/High = block, no waiver). ✅
- PII-free reason codes mandated. ✅

## Disallowed overrides

None applied. Nothing in this file lowers a portfolio rule.
