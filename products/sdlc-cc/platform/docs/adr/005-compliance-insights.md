# ADR 005 — Compliance Insights Architecture

- **Status**: Accepted
- **Date**: 2026-04-19
- **Supersedes**: —
- **Related**: ADR 001 (microservices), ADR 002 (zero-trust), ADR 003 (RAG), ADR 004 (edge)

## Context

The platform already emits high-signal telemetry through four mature surfaces: `services/llm-gateway` (request/response traffic), `services/dlp` (PII hits), `services/opa` (policy denials), and `services/rag` (document events). Enterprise buyers have asked for an AI-governance product that turns these signals into ranked, actionable insights with auto-remediation into Jira/Notion/Slack/OPA repositories — effectively a "Cepien for AI-governance" tier.

We need to decide where the new capability lives without destabilising the existing services, while keeping the scoring and execution primitives reusable by sister portfolio products (`qestro`, `push-ci.dev`, `aegis`).

## Options considered

1. **Extend `services/gateway` with insight endpoints only; collect and detect inline.**
   - Pro: one service to ship.
   - Con: puts ML (HDBSCAN, embeddings) into the hot auth path; violates gateway latency budget; blast radius on any regression is the whole API.

2. **One new monolithic "insights" service handling collection, detection, scoring, routing, and API.**
   - Pro: simpler than two services.
   - Con: Go and Python in the same process is awkward; can't scale CPU-heavy detector independently from cheap collector; breaks the platform's one-service-one-concern pattern (ADR 001).

3. **Two new services plus a shared library, and extend only the gateway + admin-ui + realtime for user surfaces. (CHOSEN)**
   - Pro: small, composable services; independent scaling; existing mature surfaces (auth, tenancy, WS) stay authoritative for anything user-facing; scoring + exec-router live in a lib that other portfolio products import.
   - Con: two new deployables; one extra queue; contract between collector/detector must be versioned.

## Decision

Adopt option 3:

- `services/insights-collector` (Go) — subscribes to NATS JetStream streams from existing producers, redacts through `services/dlp`, persists to `signals` with RLS.
- `services/insights-detector` (Python, FastAPI) — shares the ML toolchain already vendored in `services/rag`, runs hybrid rule + HDBSCAN detection, writes scored insights.
- `packages/insights-core` — Go + TypeScript dual implementation of the scorer and the adapter contract. Portable to `qestro`, `push-ci.dev`, and `aegis` without copy/paste.
- `packages/integrations/insights-adapters/<name>` — one adapter per external system (Jira, Linear, Notion, Slack, email, OPA-PR, SIEM). Each ≤200 lines.
- `services/gateway` gets a Chi subrouter for `/v1/insights*`; `services/realtime` hosts the WS stream; `services/admin-ui` gets an `/insights` route.
- Migration `007_compliance_insights.sql` is additive, RLS-enforced, and mirrors the pattern in migration 005.

## Consequences

Positive:
- Clear ownership boundary per service; each ≤200-line constraint is tractable.
- Detector can scale vertically (ML CPU) while collector scales horizontally (I/O).
- Scoring and routing become a portfolio-wide primitive; cross-product reuse is a library import, not a service call.
- Adapter failures are contained in the router; gateway stays on its latency SLO.

Negative / trade-offs:
- Two new services increase operational surface: Dockerfile, CI, dashboards, on-call runbook, alerts — tracked as cross-cutting tasks in the implementation plan.
- Cross-language shared lib requires golden JSON parity tests (Go ↔ TS) in CI to prevent drift.
- NATS JetStream becomes a hard dependency for collection; a failure mode analysis is required before GA (captured in P3 chaos drill T-307).

## Security posture

- All writes flow through gateway auth; `SET LOCAL app.tenant_id` drives RLS.
- DLP redaction happens **before** persistence; redaction keys held in per-tenant KMS.
- Adapter credentials stored in the existing `packages/shared-config` vault; never written to signal payloads.
- Audit rows are HMAC-signed with a tenant-scoped key; the admin UI verifies signatures on render.
- Dry-run mode is the default for every `POST /v1/insights/{id}/act`; opting in to `dry_run=false` requires the `insights:act` scope.

## Reference

Full technical design: `docs/compliance-insights-design.md`.
Implementation plan: `.luna/sdlc-platform/compliance-insights/implementation-plan.md`.
