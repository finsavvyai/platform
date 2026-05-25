# SDLC Platform — Requirements Validation

**Date:** 2026-04-21
**Scope:** Project-level, requirements.md (70 FR items + 30+ NFR items)
**Reviewer:** Claude (main-context)
**Verdict:** ⚠️ **Alpha-ready. Not Beta-ready, not GA.**

---

## Executive Summary

The codebase implements the architecture described in `requirements.md` at the service-decomposition level: gateway (Go), RAG (Python), LLM gateway (Go), DLP (Python), embedding (Python), admin UI (Next.js), landing page (Next.js + Clerk), proxy worker, realtime broker, LAM agents, and a full PostgreSQL schema with RLS. What is missing is the *runtime wiring*: the gateway router exposes only health/metrics/service-discovery/Langfuse surfaces, with core API handlers explicitly "pending refactoring" (`main.go:321-322`). Most FRs can therefore be validated as **coded but not served**.

For the purpose of this review the statuses are:

- ✅ Implemented and wired.
- 🟡 Implemented but not wired / not reachable via the deployed gateway.
- ⚠️ Partially implemented.
- ❌ Missing.
- ❓ Unverifiable without deeper inspection.

---

## FR Coverage Matrix

### FR1 — Authentication & Authorization

| Req | Status | Evidence |
|-----|--------|----------|
| FR1.1.1 email/password auth | ⚠️ | `services/gateway/internal/domain/services/authentication_service.go` (1613 LOC) implements password flows. Tests exist (`authentication_service_test.go`). Not wired at the router (no auth handlers on `/api/v1/*` in `main.go`). |
| FR1.1.2 OAuth 2.0 / SSO (Google, Microsoft, Okta) | ❌ | No OAuth provider integration found in gateway. Clerk handles auth on the landing-page side (`landing-page/lib/clerk-env.ts`, `middleware.ts`) but that is for the marketing/admin surface, not the API. |
| FR1.1.3 SAML 2.0 | ❌ | No SAML IdP code found (`grep -i saml` returns only docs/tests). |
| FR1.1.4 MFA | ❌ | No TOTP / WebAuthn / MFA code found. |
| FR1.1.5 API-key auth | 🟡 | `api_keys` table exists (migration 005) with RLS; lifecycle code unverified. Langfuse endpoint accepts any non-empty key (security report S1). |
| FR1.1.6 JWT 15-min expiry | 🟡 | JWT code present in `authentication_service.go` and RAG's `app/auth/jwt_manager.py`; TTL configuration not verified against 15-min spec. |
| FR1.1.7 Refresh-token rotation | 🟡 | `user_sessions` table + RLS; rotation logic in `authentication_service.go` (1613 LOC). Needs targeted review. |
| FR1.2.1 RBAC | ⚠️ | `policies` table exists; Go role constants present; enforcement middleware not attached to router. |
| FR1.2.2 Roles Owner/Admin/Editor/Viewer | ❓ | Role strings not confirmed in this review. |
| FR1.2.3 OPA | ⚠️ | `services/gateway/internal/policy/*` has `opa_client.go`, `policy_engine.go`, `bundle_manager.go`, `conflict_detector.go`, `version_manager.go`. Engine constructed in `Application` wiring but not attached as router middleware. |
| FR1.2.4 Policy eval every request | ❌ | OPA middleware not on chain. |
| FR1.2.5 Team-based access | ❓ | |
| FR1.2.6 Row-level security | ✅ | `database/migrations/005_implement_row_level_security.sql` enables RLS on 17 tenant-scoped tables with `current_setting('app.current_tenant_id', true)::UUID` predicates. |

**Summary:** RLS is the strongest part. SSO/SAML/MFA are missing. OPA is coded but not enforced at request time.

### FR2 — Data Loss Prevention (DLP)

| Req | Status | Evidence |
|-----|--------|----------|
| FR2.1.1 Standard PII detection | 🟡 | `services/dlp/app/services/content_classifier.py` (1155 LOC) — classifier is extensive. Coverage targets (>95% precision, >90% recall) not validated here. |
| FR2.1.2 PHI detection | 🟡 | Included in classifier service. |
| FR2.1.3 Custom PII patterns | 🟡 | Multi-tenant manager `services/dlp/app/services/multi_tenant_manager.py` (991 LOC) suggests per-tenant config. |
| FR2.1.4 Accuracy targets | ❓ | Needs eval suite. RAG has `evals/` dir; DLP eval dir not observed. |
| FR2.2.* Redaction / tokenization / encryption / audit / role-based detokenization | 🟡 | Scanner + redactor code present (`real_time_scanner.py` 1080 LOC, `test_content_redactor.py` 989 LOC). KMS integration unverified. `dlp_scans` and `audit_logs` tables exist with RLS. |

**Summary:** DLP is the most code-complete subsystem. Critical gap is the 100%-coverage requirement on security controls — impossible to verify against oversize files.

### FR3 — RAG

| Req | Status | Evidence |
|-----|--------|----------|
| FR3.1.1 Formats PDF/DOCX/TXT/MD/HTML | 🟡 | `services/document-processor/app/processors/{pdf,html,office}-processor/` implement all formats. Also `services/rag/app/services/extractors/office_extractors.py` (1017 LOC). |
| FR3.1.2 Batch up to 1000 docs | ❓ | Queue manager exists (`queue-manager.ts`); throughput not validated. |
| FR3.1.3 Text with structure | 🟡 | HTML and PDF processors have `structure-extractor.ts`, `quality-assessor.ts`. |
| FR3.1.4 DLP on ingestion | ❓ | DLP service exists; ingestion-time hook not confirmed wired. |
| FR3.1.5 Metadata | 🟡 | metadata-extractors present per format. |
| FR3.2.* Chunking 500-1000 tokens, 20% overlap, custom strategies | 🟡 | `services/rag/app/services/chunking.py` (982 LOC). Exact parameters not validated here. |
| FR3.3.* Embeddings (OpenAI, Cohere, pgvector 1536, batch 100, cache) | 🟡 | `services/embedding/app/` has a full module tree with cache and config. `services/rag/app/services/embedding_metadata_service.py` (1208 LOC). pgvector extension enabled in migration 001. |
| FR3.4 Semantic search / hybrid / reranking / filters | 🟡 | `services/rag/app/services/rag_orchestrator.py` (1112 LOC), `search_monitoring_service.py` (976 LOC). |
| FR3.5 Generation with citations | 🟡 | Orchestrator implies generation path; citation accuracy bar (>90%) unverified. |

**Summary:** RAG pipeline is code-complete. Needs eval-driven verification.

### FR4 — LLM Gateway

| Req | Status | Evidence |
|-----|--------|----------|
| Multi-provider (OpenAI, Anthropic, Llama) | 🟡 | `services/llm-gateway/internal/providers/` exists. |
| Per-tenant / per-model rate limiting | ⚠️ | `services/gateway/internal/infrastructure/ratelimit/tier_rate_limiter.go` (+ tests) present; attached only to `/api/v1/openclaw` and `/api/v1/claw` subrouters (`main.go:318`) conditionally. Not applied to the public Langfuse surface. |
| Cost tracking | 🟡 | `services/rag/app/services/cost/cost_optimizer.py` (1147 LOC), `cost_optimization_service.py` (1129 LOC), `token/token_manager.py` (1072 LOC), `budget/budget_manager.py` (1030 LOC), `billing/billing_integration.py` (1236 LOC). Concentrated in RAG, not llm-gateway. |
| Fallback between providers | ❓ | llm/ dir suggests strategy; not verified. |

### FR5 — Learning Engine (LAM)

| Req | Status | Evidence |
|-----|--------|----------|
| LAM agents | ⚠️ | `services/agents/` has 6 JS files: `base-agent.js`, `audit-analyzer.js`, `policy-learner.js`, `provider-router.js`, `risk-assessor.js`, `tool-registry.js`. Minimal, skeleton-level. CLAUDE.md "Left" list confirms "LAM Agents full implementation" is pending. |
| Learning engine service | 🟡 | `packages/sdk-go/pkg/sdln/learning_engine_service.go` (1006 LOC) exists — but in the SDK package, not a deployed service. Likely generated or sample code. |

**Summary:** ⚠️ clearly partial.

### FR6 — Admin Console

| Req | Status | Evidence |
|-----|--------|----------|
| Next.js 14 admin UI | 🟡 | `services/admin-ui/` with pages, components, src, styles. |
| Integration with gateway | ❓ | Depends on wired gateway handlers — which are disabled. |

### FR7 — Landing & Web App

| Req | Status | Evidence |
|-----|--------|----------|
| Marketing site | ✅ | `landing-page/` Next.js 15, deployed (per CLAUDE.md + `wrangler.toml`). |
| Clerk auth | ✅ | `landing-page/lib/clerk-env.ts`, `middleware.ts`, `pages/dashboard.tsx`, `pages/api/keys/*`. |
| API-key management UI | 🟡 | Endpoints exist (`pages/api/keys/generate.ts`, `[keyId].ts`); depends on gateway for persistence. |

### FR8 — SDKs (Go, Python, TypeScript)

| Req | Status | Evidence |
|-----|--------|----------|
| Generator script | ✅ | `services/gateway/scripts/generate-sdk.sh` (235 LOC). |
| Go SDK | 🟡 | `packages/sdk-go/pkg/sdln/*` has ~50+ files, many 1000+ LOC — suspected hand-written rather than purely generated. Needs `// Code generated` markers or refactor. |
| Python SDK | ✅ (structurally) | `packages/sdk-py/sdlc_sdk/{auth,documents,llm,monitoring,policies,rag,tenants,users,utils,vector}` — looks generated. |
| TypeScript SDK | 🟡 | `packages/sdk-ts/src/` with dual `tsconfig.cjs/esm/types` — published dual-format. Unverified against current spec. |
| Signed / published to registries | ❓ | Not validated here. |

**Summary:** SDK infrastructure exists. The generator has not been re-run against the latest `openapi-extensions.yaml` so contract drift is likely.

### FR9 — Proxy Worker

| Req | Status | Evidence |
|-----|--------|----------|
| Cloudflare worker | 🟡 | `services/proxy-worker/` directory exists. CLAUDE.md claims "100% coverage". |

---

## NFR Coverage

| NFR | Target | Status |
|-----|--------|--------|
| NFR1 Performance (latency targets) | p95 < 200ms | ❓ No benchmarks observed in the repo root for the full request path. |
| NFR2 Scalability (10K concurrent, 1M docs) | Load-tested | ❌ CLAUDE.md "Left" list marks load testing pending. |
| NFR3 Availability (99.9%) | Multi-region / HA | ❓ Terraform in `deployments/`; DR playbook marked pending. |
| NFR4 Security | Zero-trust + scans | ❌ See security report — Critical findings open. |
| NFR5 Compliance (SOC2/HIPAA/GDPR) | SOC2 Type II Q2 2026 | ❌ Not feasible until auth bypass + audit middleware + continuous-evidence period close. |
| NFR6 Usability (Apple HIG) | HIG compliance | ❓ UI not reviewed here. |
| NFR7 Maintainability | ≤200 LOC / file, 90% coverage | ❌ 497 production files >200 LOC. Coverage not measured in this review. |
| NFR8 Observability | Structured logs, metrics, tracing | ⚠️ Infra present (`tracing.go`, `prometheus`, `audit_metrics.go`) but request-level metrics middleware not wired. |

---

## Critical-Path Delta (CLAUDE.md vs. Reality)

| CLAUDE.md "Left (Critical Path)" | Reality |
|----------------------------------|---------|
| Gateway OpenAPI3 migration — marked [x] | ✅ specs present |
| OpenAPI SDK generation — run + verify | 🟡 generator exists; SDKs present but likely drifted; needs re-run and contract tests |
| Gateway + RAG E2E integration tests | ❌ not observed; separate integration files exist per service |
| API-key rotation + device fingerprint | ❌ hooks-only; no rotation/fingerprint logic confirmed |
| WebSocket real-time updates | 🟡 `services/realtime/` has `connection-manager.ts`, `message-handler.ts`, `src/index.ts` — infra in place, not wired into gateway |
| Per-tenant rate limiting (in-memory → Redis) | ⚠️ Redis-backed `ratelimit/tier_rate_limiter.go` exists and is only conditionally used on two subrouters |
| SOC2 Type II prep | ❌ blocked by auth + audit findings |

---

## Missing Functionality (priority-ordered)

1. **Global auth + tenant + audit + OPA middleware** (NFR4 + FR1.2.3/1.2.4/1.2.6 + SOC2 CC7.2). Release blocker.
2. **OAuth / SAML / MFA** (FR1.1.2 / 1.1.3 / 1.1.4). Enterprise sales blocker.
3. **API-key rotation + device fingerprint** (CLAUDE.md critical path).
4. **Wiring the 40+ OpenAPI-extension routes** to handlers (FR3/4/6 downstream depend).
5. **LAM agents full implementation** (FR5).
6. **Load testing + DR playbook** (NFR2, NFR3).
7. **OpenAPI-validate middleware + contract tests** (NFR4, FR8).
8. **Coverage measurement at 90% line / 85% branch / 100% critical** (NFR7 + portfolio CLAUDE.md).

---

## Recommendation

**Alpha-only release.** The platform is internally consistent and has real zero-trust foundations (RLS across 17 tables, OPA policy engine built, DLP service extensive), but the runtime contract the gateway exposes does not match the intended product surface. Alpha users can be onboarded behind feature flags and synthetic data only.

**Beta gate:** Close all Critical security findings (S1/S2/S3/S6/S9), wire OPA + audit + tenant middleware globally, restore the 40+ handlers, add E2E contract tests, and hit 90% coverage on at least `services/gateway`, `services/dlp`, and `packages/shared-auth`.

**GA gate:** Above + OAuth/SAML/MFA, load tests passing, SOC2 Type II in progress with 3+ months of continuous evidence, file-size fitness function green.
