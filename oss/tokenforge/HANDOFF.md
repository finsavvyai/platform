# TokenForge HANDOFF

## Why this document exists

Addendum §3 names tokenforge as the **public telemetry SDK** for the
FinsavvyAI ecosystem. Round 1 of the consolidation, in parallel, produced
a hardened internal package at `/packages/telemetry/` (i.e.
`@finsavvyai/telemetry`) with two load-bearing modules:

- `audit-log` — emits one structured line per auth event, admin
  action, or sensitive mutation, in the shape
  `{ ts, actor_id, event, resource, decision, reason }`.
- `redact` — secret + PII redaction with `[redacted]` placeholders.

The end-state intended by the consolidation plan is that these two
modules should be the **open foundation** of tokenforge, and the
hosted FinsavvyAI surface should either depend on tokenforge or be a
thin wrapper around it.

## What was NOT done in round 4

Per round-4 conventions ("copy-only for OSS this round"), nothing was
merged. tokenforge sits at `oss/tokenforge/` as it was, and
`@finsavvyai/telemetry` sits at `/packages/telemetry/` as it was.

## What needs to happen later

A separate planned task should:

1. **Inventory the surfaces.** Diff
   `@finsavvyai/telemetry/src/audit-log/` and
   `@finsavvyai/telemetry/src/redact/` against the equivalent paths
   inside tokenforge (`oss/tokenforge/packages/*`). Identify:
   - APIs in both that overlap (and may conflict).
   - APIs in only one that should migrate.
   - Tests that need to migrate with the code (round-1 coverage
     targets: lines >=90, branches >=85, 100% on critical paths).

2. **Pick the directionality.** Three options:
   - (a) `@finsavvyai/telemetry` depends on tokenforge — the public
     SDK is the source of truth, internal wraps it.
   - (b) tokenforge depends on `@finsavvyai/telemetry` — internal is
     the source of truth, public re-exports.
   - (c) Both depend on a shared `tokenforge-core` extracted package.
   Option (a) is the simplest fit for the addendum's intent.

3. **License compatibility.** tokenforge is now Apache-2.0 (LICENSE
   added this round). `@finsavvyai/telemetry` inherits portfolio
   licensing. Confirm no incompatible code paths before the merge.

4. **Move the hardening.** Round-1 hardening (stable error codes,
   audit log shape contract, redact placeholders) must arrive in
   tokenforge **without regressing coverage**. The round-1
   conventions require 100% on the audit log emit path — this stays
   binding after the merge.

5. **Cross-package boundary.** Per round-1 swarm conventions, other
   `@finsavvyai/*` packages should NOT import each other freely. The
   tokenforge dependency should be **injected**, not directly
   imported, by anything outside the telemetry package itself. The
   reconciliation must preserve this rule.

## Trigger conditions

This task can be picked up after BOTH:

- Round-4 archive sweep is complete (ARCHIVE-WEBSITE agent's work).
- The AMLIQ-TENANTIQ API consolidation has decided whether AMLIQ's
  audit emits go through `@finsavvyai/telemetry` or directly to a
  sink — that decision constrains the tokenforge surface.

## Owners

Open. Suggested: Telemetry package owner from round 1 + OSS lead.
