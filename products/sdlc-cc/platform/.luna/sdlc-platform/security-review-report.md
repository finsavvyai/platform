# SDLC Platform — Security Review

**Date:** 2026-04-21
**Scope:** Project-level (zero-trust RAG / LLM gateway / compliance platform)
**Reviewer:** Claude (main-context review)
**Verdict:** ❌ **Release-blocking findings present.** NO-GO for any tenant-facing environment.

---

## Executive Summary

Security is release-blocking per `CLAUDE.md`. One confirmed Critical finding (authentication bypass in the Langfuse-compatible handler, shipping today), one confirmed Critical finding (the security middleware chain is largely unwired), and a set of High findings around disabled handlers, missing request-level telemetry, and TODOs in shipping auth code. Strengths: PostgreSQL Row-Level Security is correctly enabled on all 17 tenant-scoped tables with `current_setting('app.current_tenant_id', ...)::UUID` predicates — a real zero-trust foundation. The foundation is good; the wiring is not.

**Ship decision:** Do not expose the gateway to untrusted networks until Criticals are closed.

---

## Critical Findings (release blockers)

### S1. Authentication bypass — Langfuse compatibility handler accepts any non-empty credential

**File:** `services/gateway/cmd/server/main.go:345-360`

```go
lf := &langfuse.Handler{
    Prompts: langfuse.NewMemoryPromptStore(),
    BasicAuth: func(pk, sk string) (string, error) {
        // TODO(M4): wire to api_keys table; today accept any non-empty pair.
        if pk != "" && sk != "" {
            return pk, nil
        }
        return "", langfuse.ErrUnauthorized
    },
    BearerAuth: func(tok string) (string, error) {
        if tok == "" {
            return "", langfuse.ErrUnauthorized
        }
        return tok, nil
    },
}
lf.Mount(r)
```

The `/api/public/*` surface is mounted on the main router with authentication callbacks that consider *any* non-empty public/secret key pair (or bearer token) valid. The tenant ID returned to the handler is whatever the caller put in the public key header. An attacker can:

- Submit telemetry under any `pk` (tenant spoofing into the audit/DLP pipeline).
- Query trace/prompt endpoints with any string.
- Drive cost (LLM calls, storage) against any logical tenant.

**CVSS proxy:** Critical. CWE-287 (Improper Authentication), CWE-306 (Missing Authentication for Critical Function).

**Remediation:**
- Short-term: mount the Langfuse handler behind a feature flag disabled by default; do not expose `/api/public/*` in any deployed environment until the api_keys lookup is wired.
- Proper fix: validate the `pk` as an `api_key` row (hash + salt compare), load the associated `tenant_id`, set it into `app.current_tenant_id` for the request, and reject on mismatch or expired key.

### S2. Global security middleware chain not wired

**File:** `services/gateway/cmd/server/main.go:285-294`

The router attaches only RequestID, RealIP, Recoverer, Timeout, and a proxy middleware. `CLAUDE.md`'s 14-step golden order mandates (in addition): structured Log, CORS, Security headers (CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy), Auth, Tenant (set `app.current_tenant_id` for RLS), RateLimit, Validate (OpenAPI), Audit, Policy (OPA), Version, Compress, Metrics.

**Direct consequences:**

- **CORS:** no `cors.Handler` is configured globally; browser clients either break or get permissive responses depending on downstream defaults. CWE-942 / CWE-346.
- **Security headers:** missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options. CWE-693. Makes the admin UI vulnerable to clickjacking and MIME-type confusion.
- **Tenant context:** RLS is enabled (good) but the middleware that sets `app.current_tenant_id` from the authenticated principal is not on the chain in `setupRouter`. If requests reach the DB without this setting, RLS defaults deny-all on `USING` clauses that depend on the setting — but any code path that uses a superuser connection or the `app_user` role without a `SET LOCAL app.current_tenant_id = ...` will bypass isolation. Requires verification in the repo layer.
- **Rate limiting:** applied *conditionally* only inside `/api/v1/openclaw` and `/api/v1/claw` subrouters, and only if `app.RateLimiter != nil`. CLAUDE.md requires per-tenant rate limiting.
- **OPA:** `policyEngine` is built in the app wiring but not attached to the router as middleware. Policy enforcement at request time is absent.
- **Audit logging:** no audit middleware in the chain; sensitive mutations are not guaranteed to be logged.
- **OpenAPI validation:** no schema validation middleware — `api/openapi.yaml` and `openapi-extensions.yaml` are decorative at runtime.

**CVSS proxy:** Critical (chained). CWE-284 (Improper Access Control), CWE-778 (Insufficient Logging), CWE-20 (Improper Input Validation).

**Remediation:** Restore the golden chain. At minimum for release: Log, CORS (deny-by-default origins), Security headers, Auth (required globally, allowlist for `/health`, `/metrics`), Tenant, RateLimit (global + per-tenant), OpenAPI-validate, OPA, Audit.

---

## High Findings

### S3. Explicit "tenant-scoped API routes disabled" in shipping code

**File:** `services/gateway/cmd/server/main.go:321-322`

```go
// API routes (handlers/routes pending refactoring)
// TODO: Re-enable when handlers and routes packages are restored
```

`api/openapi-extensions.yaml` documents tenants, users, files, policies, DLP, vector endpoints. None of them appear to be registered on the router. A gateway that publishes an OpenAPI surface it does not serve is a trust problem (SDK clients generated from the spec will fail at runtime) and a surface-area hazard if the routes are later re-enabled with the same weak chain (S2).

**Remediation:** Gate all routes behind a feature flag until their handlers + middleware are restored. Do not distribute SDKs generated from the current spec.

### S4. Landing-page / Langfuse-handler JWTs in API examples

**File:** `services/gateway/api/examples.yaml:22-23`

```
access_token: "eyJhbG...SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
refresh_token: "eyJhbG...SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
```

These are the classic `jwt.io` sample tokens. Harmless as documentation but they will be copy-pasted into integration tests. Replace with `<redacted>` style placeholders to ensure no future developer treats a sample token as real.

### S5. JWT example token also in Python RAG test

**File:** `services/rag/tests/auth/test_jwt_manager.py:397`

Same `jwt.io` sample token used as a test fixture. Acceptable in tests, but combined with S1 the risk is that a test harness drives the real gateway with a known-weak credential and appears to succeed.

### S6. `/health` and `/metrics` exposed without auth on the public surface

**File:** `services/gateway/cmd/server/main.go:297-305`

`/metrics` is the Prometheus scrape endpoint; `/health/dependencies` may leak downstream URLs, error strings, and version info. On a public listener these should be bound to an internal port, require mTLS, or at minimum require a scrape token.

**Remediation:** Split the admin/metrics listener onto a separate port (`pprof_listener` pattern), or put these behind the security header / auth middleware with an allowlist for the Prometheus service account.

### S7. TODOs in authentication / auth-adjacent code

53 TODO/FIXME in `services/gateway/**`, including:

- `cmd/server/main.go:348` — the S1 auth bypass.
- `cmd/server/main.go:498` — "Implement metrics" in a request-handling path.
- `internal/interfaces/http/handlers/auth.go:1` — auth handler TODO.
- `internal/interfaces/http/handlers/auth_handlers_test.go` — test-side TODO (OK but flag).

`CLAUDE.md`: "No TODO/FIXME in release branches without a linked tracked issue." `TODO(M4)` is not a tracked issue reference (it looks like a milestone tag, not `TODO(#1234)`).

---

## Medium Findings

### S8. API-key hygiene

`database/migrations/005_implement_row_level_security.sql` creates an `api_keys` table with RLS but the Langfuse handler does not query it. Without seeing the `api_keys` lifecycle code, verify:

- Keys stored hashed (bcrypt/argon2), not plaintext.
- `key_prefix` indexed for lookup; `key_hash` for verify.
- Rotation path: generate new, revoke old, overlap window ≤ 24h.
- Device fingerprint validation (called out in CLAUDE.md's "Left" list).

### S9. Audit log table exists but audit middleware not wired

`audit_logs` has RLS on it and the gateway builds audit infrastructure in `internal/infrastructure/monitoring/tracing.go` (per TODO grep). Middleware that writes to it on every mutation is not on the chain (S2).

**Remediation:** require an `audit.Middleware()` in the chain, writing `{ request_id, tenant_id, user_id, action, resource, result, ip, ua }` on every non-GET.

### S10. DLP critical paths concentrated in oversized files

`services/dlp/app/services/content_classifier.py` (1155), `real_time_scanner.py` (1080), `multi_tenant_manager.py` (991). DLP is zero-trust compliance. Files this size struggle to reach the 100% critical-path coverage that `CLAUDE.md` demands for permissions / data-writes / security controls.

### S11. LLM Gateway: no per-tenant prompt-injection defense documented

Prompt-injection is an OWASP LLM Top-10 item (LLM01). The LLM gateway at `services/llm-gateway/` should apply input classification and refusal before the outbound call, and scrub output. Worth a dedicated review pass.

### S12. SSRF surface on document ingestion

RAG document upload and URL-based fetchers (`services/document-processor/`, `services/rag/app/services/extractors/*`) should enforce an allowlist / denylist on internal IPs and metadata services (`169.254.169.254`, `127.0.0.1`, RFC1918). Not verified.

### S13. Secrets scanning

No hardcoded production credentials found in a config sweep of `services/**/config*.yaml`. The JWTs in S4/S5 are public `jwt.io` samples. Keep a formal secret scanner (gitleaks, trufflehog) in CI — CLAUDE.md requires it per-PR.

---

## Low Findings

### S14. `coverage.out` committed in `services/gateway/` and `services/llm-gateway/`

Not secret, but coverage files can leak path-names, test selectors, and give attackers implicit code-map hints if the artifact is shipped. Remove and gitignore.

### S15. Build binaries in tree

`services/gateway/bin/`, `services/gateway/server` (binary, untracked) — risk of accidentally committing a stripped binary with embedded paths/constants. Add to `.gitignore`.

---

## Positives

- **RLS is real.** `database/migrations/005_implement_row_level_security.sql:1-50` enables RLS on every tenant-scoped table (`tenants`, `users`, `api_keys`, `user_sessions`, `documents`, `document_chunks`, `policies`, `policy_evaluations`, `dlp_scans`, `audit_logs`, `token_usage`, `document_processing_jobs`, `vector_search_logs`, `embedding_jobs`, `document_access_log`, `tenant_quotas`, `compliance_reports`). Policies use `current_setting('app.current_tenant_id', true)::UUID` with a `system` override path. This is the correct pattern.
- **Dedicated `app_user` role** with NOLOGIN and scoped grants — good least-privilege baseline.
- **Separate DLP / policy / audit tables** — the schema contemplates compliance from day one.
- **OpenAPI-first** architecture, even if handlers are not wired.

---

## OWASP Top-10 Mapping

| # | Category | Status | Evidence |
|---|----------|--------|----------|
| A01 | Broken Access Control | ❌ | S1 Langfuse bypass; S2 missing auth middleware; S9 audit gaps |
| A02 | Cryptographic Failures | ⚠️ | Unverified: api_key hash algorithm, session token storage |
| A03 | Injection | ⚠️ | Unverified: raw-SQL scan not performed, OpenAPI-validate not wired (S2) |
| A04 | Insecure Design | ❌ | S3 spec without handlers; S6 metrics on public port |
| A05 | Security Misconfiguration | ❌ | S2 missing CSP/HSTS/XFO/CORS |
| A06 | Vulnerable & Outdated Components | ⚠️ | Dep scan required in CI per CLAUDE.md |
| A07 | Identification & Authentication Failures | ❌ | S1; S7 TODOs in auth surface |
| A08 | Software & Data Integrity Failures | ⚠️ | SDK generation + handler disable (S3) = unsigned spec drift |
| A09 | Security Logging & Monitoring Failures | ❌ | S9 audit middleware not wired |
| A10 | Server-Side Request Forgery | ⚠️ | S12 unverified |

---

## OWASP LLM Top-10 (subset)

| # | Category | Status |
|---|----------|--------|
| LLM01 | Prompt Injection | ⚠️ S11 |
| LLM02 | Insecure Output Handling | ⚠️ |
| LLM06 | Sensitive Information Disclosure | ⚠️ DLP solid on paper, coverage gate needed |
| LLM10 | Model DoS / Cost | ⚠️ Rate-limit gaps (S2) |

---

## SOC2 / HIPAA / GDPR Readiness Gaps

- **SOC2 CC6.1 (Logical Access):** S1, S2, S3 block.
- **SOC2 CC7.2 (Monitoring):** S9 blocks — audit middleware not wired.
- **HIPAA §164.312(a)(2)(i) (Unique User ID) / (c)(1) (Integrity Controls):** S1 allows any pk to assume any tenant identity.
- **GDPR Art. 32 (Security of Processing):** S1/S2 combine to weaken technical measures.

SOC2 Type II cert (targeted Q2 2026 per CLAUDE.md) is not feasible until S1–S9 are closed and have ≥3 months of continuous evidence.

---

## Go / No-Go

**No-Go for any tenant-facing environment.** Staging with synthetic traffic only.

Blockers (in order): **S1, S2, S3, S6, S9.** S4/S5/S7 are low-effort cleanup. The RLS foundation is strong; the application-layer enforcement must catch up before a tenant is onboarded.
