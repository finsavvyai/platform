# SDLC Platform — Production Readiness

> **REPO STATUS (2026-05-14, re-audit):** Active. The 2026-05-13
> "consolidated into aegis" banner was aspirational — `aegis/` has
> no `cmd/sdlc-api` binary and its `internal/` tree is AML-only.
> Production-readiness work continues against `services/gateway/`
> + the other services in this repo. See [SUNSET.md](../SUNSET.md)
> and [PIVOT-DECISION.md](PIVOT-DECISION.md) for the corrected
> picture, and [INTEGRATION-DEBT.md](INTEGRATION-DEBT.md) for the
> latest primitive-vs-integrated tallies.

Last updated: 2026-04-25

This is the **summary** punch list. The full daily-prompt plan to GA lives in
[docs/roadmap/](roadmap/README.md) — 90 working days (18 weeks) across 5
phases. Each day in the roadmap is a copy-pasteable prompt.

Numbers below are derived from the most recent CI sweep + security audit,
not from CLAUDE.md (which had stale counts before this update).

## Phase progress (HONEST)

> Walked back from a false-completion call on 2026-04-26. Tags
> `phase-1-complete` and `phase-2-complete` were pushed to origin and
> then deleted because the criteria the prompts wrote were not met.
> See `docs/INTEGRATION-DEBT.md` for the full primitive-vs-integrated
> audit.

| Phase | Days | Status |
| --- | --- | --- |
| 0 — Stabilize | 1-5 | mostly done (CI/coverage/observability gates live; tag stays) |
| 1 — Release blockers | 6-20 | **primitives committed, NOT integrated** — see audit |
| 2 — Enterprise + Business parity | 21-55 | **mostly scaffolds** — see audit |
| 3 — HIPAA + EKM + Residency | 56-75 | not started |
| 4 — SOC2 + GA launch | 76-90 | not started |

Legend used in the audit:
- ✅ **done** — feature works end-to-end at runtime, verified
- 🟡 **primitive only** — package + tests committed but no caller in production code path
- 🔴 **scaffold/blocked** — placeholder, ErrNotImplemented, or needs external creds I don't have

The PRODUCTION-READINESS table prior to this rewrite claimed every Day
6-55 as ✅. That was wrong. Detailed breakdown lives in
`docs/INTEGRATION-DEBT.md`.

## Current state snapshot

| Service | Lint | Build | Unit tests | Notes |
| --- | --- | --- | --- | --- |
| gateway (Go) | new-finding gate active | PASS | PASS | gosec HIGH/MED/LOW = 0 |
| rag (Python) | ruff baseline | py compile PASS | smoke + testcontainers | 3.11 pinned |
| vector-core (Rust) | n/a | `cargo check` PASS | not run | 52 warnings tracked |
| admin-ui (Next.js) | ESLint OK | webpack OK | 113/113 PASS | rate-limit page added |
| document-processor | TS lint OK | PASS | PASS + queue tests | DLQ wired |
| realtime | TS OK | OK | progress-broadcaster 7 tests | pub/sub plumbed |
| landing-page | OK | OK | OK | already deployed |

OpenAPI: spec is internally consistent (47 integration subtests pass).
SDK contract gate wired (`make sdk-contract` + `.github/workflows/sdk-contract.yml`).

## Release-blocking gaps (must close before GA)

1. **RAG test environment** — pytest fails on Python 3.9 (Xcode default); CI
   must pin Python 3.11+ and install `pgvector.sqlalchemy` (not base
   sqlalchemy).
2. **Coverage enforcement** — portfolio CLAUDE.md mandates ≥90% line / ≥85%
   branch overall and 100% on critical paths (auth, payments, data writes,
   permissions). Gateway and admin-ui have suites but coverage isn't enforced
   in CI. Add `-coverpkg` thresholds to `make test-coverage` and a Jest
   `coverageThreshold` block, then fail CI on regression.
3. **Integration tests E2E** — Gateway ↔ RAG round trip not exercised. Add a
   docker-compose-driven test that uploads a doc, runs a query, asserts
   response shape.
4. **Rate limiting per tenant in Redis** — currently in-memory, won't survive
   a restart or scale horizontally.
5. **API key rotation + device fingerprint validation** — endpoints exist but
   no rotation lifecycle or fingerprint enforcement test.
6. **WebSocket real-time updates** — broker scaffolded, no end-to-end test for
   document-processing progress events.
7. **golangci-lint findings** — 157 findings remain after the v1→v2 config
   migration. Triage: fix blockers, suppress low-value style noise with
   justification.
8. **Disaster recovery playbook** — not written. Need: backup/restore drill
   for Postgres + pgvector, secrets rotation runbook, gateway failover.

## Non-blocking but expected before customer onboarding

- SOC2 Type II prep work (Q2 2026 target per CLAUDE.md).
- Load testing target: 1M documents, 10K concurrent users.
- Vector-core Rust: address 52 warnings; run a perf bench to validate the
  pgvector binding still beats the Go fallback.
- LAM Agents service: implementation is partial.
- OPA policy syntax validator on policy create/update endpoints.
- Cloudflare Pages v2 compatibility for the landing page.
- 200-LOC cap fitness function: today `services/gateway/api/openapi.yaml`
  (2635 LOC) and `openapi-extensions.yaml` (1938 LOC) violate the rule. Split
  by domain (auth, tenants, documents, vector, ...) when convenient.

## Rolling plan (summary — full plan in roadmap/)

| Phase | Weeks | Days | Theme | Outcome |
| --- | --- | --- | --- | --- |
| 0 | 1 | 1-5 | Stabilize | Coverage gated, security baseline, observability online |
| 1 | 3 | 6-20 | Release blockers | Redis rate limiter, RAG E2E, audit logs, DR playbook |
| 2 | 7 | 21-55 | Enterprise + Business parity | RBAC, SCIM, SAML, spend, 9 connectors, multi-provider |
| 3 | 4 | 56-75 | HIPAA + EKM + 10-region residency | BAA-ready, BYOK, pen test clean |
| 4 | 3 | 76-90 | SOC2 + GA launch | SOC2 Type II observation, load test passed, v1.0.0 |

Once Phase 1 closes, the platform clears the **alpha gate** (10–20 users).
Phase 2 closes the **enterprise feature gap**. Phase 3 makes us
**fintech/healthtech-eligible**. Phase 4 is **GA**.

## Competitive feature parity at GA

By end of Phase 2 we match or exceed:

- **Claude Team Premium** (SSO, admin controls, M365/Slack connectors, central billing)
- **Claude Enterprise** (SCIM, fine-grained RBAC, spend limits, audit logs, custom retention, IP allowlist, network ACL, HIPAA-ready)
- **ChatGPT Business** (60+ connectors, SAML SSO + MFA, encryption + no-training default, Codex-style code actions, shared projects, record mode, volume billing)
- **ChatGPT Enterprise** (expanded context, EKM, user analytics, domain verification, custom retention, data residency in 10 regions, 24/7 SLAs, volume discounts)

Plus what only sdlc.cc does:

- **Self-hosted** option for fintech/healthtech that can't use any SaaS AI
- **Multi-provider routing** with cost-tier policy (no vendor lock-in)
- **DLP on inbound and outbound prompts** (PII never leaves the perimeter)
- **OPA-based custom policy** beyond what hyperscalers expose

## How to verify locally

```bash
# Gateway
cd services/gateway && make production-check && make sdk-contract
gosec -severity low -confidence low ./cmd/... ./internal/...   # expect 0

# Admin UI
cd services/admin-ui && npm test -- --silent

# Vector core
cd services/vector-core && cargo check --all-targets

# Spec / SDK contract gate
cd services/gateway && make sdk-validate && make sdk-contract
```

If any of those fail, the branch is not ready to merge.
