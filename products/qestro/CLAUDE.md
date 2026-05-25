# Qestro — Product CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules).
Cannot weaken any rule there. The pre-migration source CLAUDE.md is
preserved as `CLAUDE.source.md` for historical reference.

## Product mission

Autonomous runtime QA — a runtime agent that explores the surface area an
AI just changed. Where PushCI guards the merge gate statically, Qestro
guards the post-merge runtime: it drives the running application, probes
the diff's blast radius, and surfaces regressions that static analysis
cannot see.

## Target user

Engineering teams shipping AI-generated code into production who need
confidence that runtime behaviour matches intent, not just that the code
type-checks. Primary persona: tech lead at a 20-200 dev org with active
LLM-assisted commits hitting `main` daily.

## Product-specific architecture constraints

- Backend (Node/TS) is the orchestrator; the browser-extension and
  playwright-service are runtime probes. They MUST NOT call each other
  directly — the backend mediates.
- The MCP server (`mcp/`, `mcp-server/`) is a thin protocol adapter. No
  business logic in MCP handlers; route into backend services.
- `packages/self-healing/` is an internal helper, not an external API.
  Do not export it from the product surface.
- Until reconciled, the bundled `packages/finsavvyai-*` directories are
  the source of truth for Qestro runtime, NOT
  `/packages/{auth,telemetry,...}` at the monorepo root. Cross-product
  consolidation is a separate, scheduled task — see
  `MIGRATION_NOTES.md` HANDOFF.

## Product-specific test matrix

Beyond portfolio defaults (>=90% lines, >=85% branches, 100% critical
paths), Qestro CI must include:

- Unit tests for every test-orchestration primitive in `backend/src/`.
- Integration tests that exercise the full chain
  `MCP request -> backend -> playwright-service -> audit log emit`.
- Integration with `@finsavvyai/telemetry` audit-log: every Qestro test
  run that mutates external systems MUST emit a structured audit event
  through the round-1 audit-log shape
  (`{ ts, actor_id, event, resource, decision, reason }`). Tests for
  this wiring are critical-path (100% coverage).
- Integration with `@finsavvyai/policy-engine`: a Qestro run against a
  customer environment is policy-gated. The orchestrator MUST call the
  policy engine before starting any probe that touches production data
  and MUST refuse the run on `PolicyDeniedError`. Tests for the
  refusal path are critical-path (100% coverage).
- Browser-extension and playwright-service get smoke tests in CI; full
  E2E runs nightly, not per-PR.

## Product-specific security controls

- Probes never persist customer data outside the audit log. PII fields
  are hashed before logging; secrets are redacted using
  `@finsavvyai/telemetry`'s redact module.
- The MCP server enforces tenant isolation: a request scoped to tenant
  A MUST NOT read or trigger probes against tenant B. Enforced via
  `@finsavvyai/auth` claim checks at every handler boundary.
- Playwright workers run in disposable, network-isolated sandboxes.
  Outbound network is allowlisted per probe definition.
- Critical alert: `qestro.policy.denied` and
  `qestro.audit.emit_failed` are release-blocking if their rate
  exceeds threshold (see `infrastructure/alerts/`).

## Product-specific release checklist

In addition to portfolio Definition of Done:

- [ ] All bundled `@finsavvyai/*` versions inside Qestro recorded in
      release notes (drift from root packages is intentional but must
      be visible).
- [ ] Audit-log integration smoke test green in staging.
- [ ] Policy-engine denial path green in staging (force-denied probe
      must refuse to start).
- [ ] Browser-extension store builds tagged with the same version as
      backend release.
- [ ] MCP protocol version compatibility note included in release notes.

## Open consolidations (handoff)

- Reconcile bundled `packages/finsavvyai-{auth,monitor,llm,ui,pay,
  cf-stack,test-config}` with the canonical
  `/packages/{auth,telemetry,...}`. Out of scope for round 4.
- Surface the round-1 hardened audit-log + redact modules to Qestro
  via the canonical telemetry package rather than the bundled monitor
  copy. Out of scope for round 4.
