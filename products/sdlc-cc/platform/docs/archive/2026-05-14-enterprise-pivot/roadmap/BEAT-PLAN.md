# Beat-Plan — sdlc-platform vs LangSmith / LlamaCloud / Pinecone / Zilliz

Created: 2026-04-27. Source for evidence: `.luna/sdlc-platform/compete-report.md`.

## Win condition

By **2026-06-08** (6 weeks), a buyer evaluating zero-trust RAG + LLM gateway can demo against sdlc-platform and find no capability the four incumbents ship that we can't show running in our admin UI — except CMEK and SOC2 Type II, which are tracked separately.

The wedge: **tenant-isolated retrieval (Postgres RLS) + multi-provider LLM gateway with hard-cap spend + OPA-enforced DLP**, all in one box. No competitor has more than one of those three live in their product.

## Definition of "beat" per competitor

| Competitor | "Beat" criteria (objective, demoable) |
|---|---|
| LangSmith | 1) RBAC enforced on every protected handler. 2) Customer-queryable audit log API. 3) Multi-provider LLM gateway (something LangSmith never ships). |
| LlamaCloud | 1) OPA retrieval-time enforcement. 2) ≥3 SaaS connectors live (Drive + Slack + GitHub). 3) Hard-cap spend 402 on the request path. |
| Pinecone | 1) DLP middleware live on inbound + outbound. 2) Multi-provider LLM routing. 3) RLS-enforced multi-tenant boundary (Pinecone explicitly says namespace ≠ security boundary). 4) CMEK (Sprint 3 stretch). |
| Zilliz | 1) End-to-end RAG (parser + embed + retrieve + generate) in one product. 2) DLP. 3) PrivateLink Terraform module (Sprint 3 stretch). |

We're done when every row above is checkable on a live staging deploy.

## Sprint structure

Three 2-week sprints. Each sprint has one demo on the last Friday at 10:00 GMT+3 against a single tenant `acme-corp` — that's the proof gate. No demo, no sprint close.

Tracking: every item below has a corresponding row to add to `docs/roadmap/STATUS.md` once it flips from 🟡 to ✅. The integration-debt file (`docs/INTEGRATION-DEBT.md`) is the canonical source of truth for what counts as ✅.

---

## Sprint 1 — Wire what we already built (Days 1-14: 2026-04-28 → 2026-05-11)

Theme: every primitive in INTEGRATION-DEBT.md that's 🟡 because of "no caller in main" gets a caller. Cheapest tickets, biggest competitor surface closed.

### S1.1 — Middleware chain wired into router (RBAC + RateLimit + Audit)
- Closes: LangSmith Enterprise RBAC, Pinecone audit logs, Zilliz audit logs.
- Files: `services/gateway/cmd/server/router.go`, `services/gateway/internal/interfaces/http/middleware/chain.go`, apply `database/migrations/007_compliance_insights.sql` + `008_rate_limits.sql` + `009_audit_log_immutable.sql` + `010_rbac.sql`.
- Tests: testcontainers integration test per primitive — real Postgres + real Redis. Asserts: missing permission → 403; over-rate → 429; mutating call writes an HMAC-chained `audit_logs` row.
- Done-when: `curl -H 'Authorization: Bearer <admin-no-perm>' /admin/tenants` returns 403; the same call by an admin with permission returns 200 and produces a verified audit row queryable via `/v1/audit/events`.
- Effort: M (5 person-days)

### S1.2 — Anthropic LLM adapter + spend tracking + 402 hard cap
- Closes: every competitor on hard-cap (none have it).
- Files: `services/gateway/internal/infrastructure/llm/anthropic/{client,client_test}.go`, `services/gateway/internal/interfaces/http/middleware/spend.go`, `services/gateway/cmd/server/main.go`, apply `database/migrations/012_spend_events.sql`, seed `model_pricing` for `claude-opus-4-7` + `claude-sonnet-4-6` + `claude-haiku-4-5`.
- Tests: recorded HTTP fixture (no live API), integration test for 402 path: set `tenants.spend_hard_cap_usd=0.01`, send a chat, expect 402 with `Retry-After`.
- Done-when: `POST /v1/chat` returns text from Anthropic, writes one row to `spend_events`, and after the cap is exceeded returns 402.
- Effort: M (5 person-days)

### S1.3 — Customer audit-log query API + admin UI page
- Closes: LangSmith Enterprise audit, Pinecone audit logs, Zilliz audit logs.
- Files: `services/gateway/internal/app/handlers/audit/{query,query_test}.go`, `services/gateway/api/openapi-extensions.yaml`, `services/admin-ui/src/app/dashboard/audit-logs/page.tsx`, `services/admin-ui/src/app/dashboard/audit-logs/filter-bar.tsx`.
- Tests: handler test against real `audit_logs` rows (HMAC chain verified end-to-end); admin-ui jest test for filter bar.
- Done-when: `GET /v1/audit/events?since=2026-04-28&action=tenant.update&page_size=50` returns signature-verified rows; admin UI shows a filterable, paginated view.
- Effort: S (2 person-days; writer already exists, only reader is missing).

### Sprint 1 demo (Day 14)
- Live: revoke admin perm → 403; spend cap hit → 402; tenant queries their own audit log via API and admin UI.
- Outcome: LangSmith RBAC parity, audit-log parity with Pinecone/Zilliz, hard-cap differentiation.

---

## Sprint 2 — Plant the wedges (Days 15-28: 2026-05-12 → 2026-05-25)

Theme: ship the three things competitors don't have — DLP, OPA enforcement, real connectors. These are the moat, not the parity.

### S2.1 — DLP middleware live on inbound + outbound
- Closes: nobody else has this.
- Files: `services/gateway/internal/interfaces/http/middleware/dlp.go` (mount it; today it's primitive only), `services/gateway/internal/domain/dlp/policy.go`, new migration `database/migrations/019_tenant_dlp_policy.sql` (per-tenant `mask | redact | block`), audit on detection.
- Tests: integration test sends `SSN 999-99-9999` inbound, expects masked body downstream + audit row; outbound test buffers ≤5MB then truncates with `X-DLP-Truncated`.
- Done-when: a tenant policy of `block` makes `POST /v1/chat` with PII return 422; `mask` rewrites it; both produce audit rows.
- Effort: S (3 person-days; detector already done — Day 34/35 in INTEGRATION-DEBT).

### S2.2 — OPA Rego enforcement on retrieval handler + admin save
- Closes: nobody else has retrieval-time policy enforcement.
- Files: `services/gateway/internal/interfaces/http/middleware/policy.go` (already exists, needs wiring), `services/gateway/internal/app/handlers/policies/save.go` (run `SyntaxValidator` on input), `services/admin-ui/src/app/dashboard/policies/page.tsx`.
- Tests: a denied retrieval returns 403 with the failing rule name; a syntactically broken Rego is rejected at save time with line/col.
- Done-when: tenant saves Rego in admin UI, attempts `POST /v1/rag/query` that violates it, gets 403 with rule name, decision is in audit log.
- Effort: S (3 person-days; validator exists from Day 18).

### S2.3 — Google Workspace connector live (real OAuth + Drive list/fetch)
- Closes: nobody else ships SaaS connectors.
- Files: `services/gateway/internal/infrastructure/connectors/google_workspace/connector.go` (replace the stub from Days 40-48), `services/admin-ui/src/app/dashboard/connectors/page.tsx` (wire install button to `/admin/connectors/google_workspace/install`), `services/gateway/internal/app/handlers/connectors/oauth.go`.
- Tests: httptest fixtures for token exchange + Drive `files.list` + `files.get` with `alt=media`. Admin-ui jest test for install button → redirect.
- Done-when: a tenant clicks Install on the marketplace page, completes Google OAuth, picks a Drive folder, the doc-processor pulls the files and they show up in `documents` searchable via `POST /v1/rag/query`.
- Effort: M (5 person-days; OAuth app provisioning is half).

### S2.4 — Slack + GitHub connector (parallel — no extra cost)
- Closes: same as S2.3, multiplies the connector wedge.
- Files: `services/gateway/internal/infrastructure/connectors/{slack,github}/connector.go` (replace stubs).
- Tests: httptest fixtures per vendor.
- Done-when: same as S2.3 for Slack channels and GitHub repos.
- Effort: M (5 person-days, parallel to S2.3 if a second contributor is on the team; otherwise stretch goal).

### Sprint 2 demo (Day 28)
- Live: PII in a prompt → DLP masks; Rego policy denies a retrieval → 403; OAuth into Google Workspace → Drive folder ingested → semantic search returns it.
- Outcome: three things no competitor demos in one product.

---

## Sprint 3 — Close the procurement moat (Days 29-42: 2026-05-26 → 2026-06-08)

Theme: the items that make regulated buyers say yes. Heavier engineering, longer feedback loops.

### S3.1 — CMEK (envelope encryption with customer AWS KMS ARN)
- Closes: Pinecone Enterprise CMEK, Zilliz BYOC encryption.
- Files: `services/gateway/internal/infrastructure/crypto/envelope.go`, `services/document-processor/src/encryption.ts`, migration to add `tenants.kms_key_arn`, doc at `compliance/encryption-at-rest.md`.
- Tests: encrypt a doc with a fake KMS, "delete" the key, expect decryption to fail on next read; production test runs against a real KMS in staging.
- Done-when: a tenant supplies a KMS ARN in admin UI; new documents and embeddings are envelope-encrypted with it; revoking the IAM grant on the key makes the docs undecryptable on next read (proven by destructive test).
- Effort: L (8 person-days)

### S3.2 — Real SAML SSO + MFA challenge flow
- Closes: LangSmith Enterprise SSO, Pinecone (still shows MFA "Coming Soon" — beat them to GA).
- Files: `services/gateway/internal/infrastructure/sso/saml.go` (replace `errors.New("not yet implemented")` in `VerifyAssertion` with a real `crewjam/saml` integration), `services/gateway/internal/infrastructure/sso/mfa_challenge.go`, admin-ui IdP setup wizard.
- Tests: SAML round-trip against a `crewjam/saml/samlsp` fake IdP; TOTP MFA challenge against RFC 6238 test vectors.
- Done-when: tenant admin registers Okta tenant in admin UI, completes SAML login, gets prompted for MFA, session reflects both factors. Pinecone has only one of these.
- Effort: L (8 person-days; needs an Okta test tenant).

### S3.3 — Terraform module for AWS PrivateLink + private-network deploy
- Closes: LangSmith hybrid, LlamaCloud VPC, Pinecone private endpoints, Zilliz BYOC.
- Files: `deployments/terraform/private-link/{main,variables,outputs}.tf`, `docs/operations/private-link.md`.
- Tests: `terraform validate` in CI; manual end-to-end against staging VPC documented in the runbook.
- Done-when: a customer can `terraform apply` to stand up a VPC endpoint pointing at our gateway; traffic from outside their VPC to the public endpoint is denied.
- Effort: L (8 person-days; the runbook from Day 27 is mostly there).

### S3.4 — SOC 2 Type II readiness drive (kicked off Day 1, lands later)
- Closes: every competitor — until we have it, regulated buyers can't even start procurement.
- Files: `compliance/soc2/`, every CI workflow grows evidence collection (run logs, scan results, change tickets).
- Tests: SOC2 auditor's evidence checklist (control-by-control); internal dry-run by Day 42.
- Done-when: a SOC 2 Type II report dated within the last 12 months is downloadable from a customer-facing trust center. Realistic GA: Q3 2026 (auditor lead time alone is 8-12 weeks).
- Effort: months. Start the auditor RFP **on Day 1** so the calendar starts running while engineering ships S1-S3.

### Sprint 3 demo (Day 42 — also the public "we beat them" demo)
- Live: tenant brings their own KMS, real SAML/MFA login, TLS terminating at a PrivateLink endpoint inside the customer's VPC.
- Outcome: every "Where we lose today" row in `compete-report.md` is closed except SOC 2 Type II (in flight) and document-parsing quality (acknowledged trade-off — we ship a "use LlamaParse for ingestion if you want layout-perfect tables" doc).

---

## Risk register & contingency

| Risk | Mitigation |
|---|---|
| Anthropic API rate limit blows S1.2 demo | Use `claude-haiku-4-5` for the demo path; record an HTTP fixture for CI. |
| Google OAuth verification takes >2 weeks | Start the OAuth app verification application on Day 1 of Sprint 1, even though we don't ship the connector until Sprint 2. |
| Okta test tenant not available for S3.2 | Stand up a self-hosted Keycloak as IdP; both speak SAML. |
| KMS destructive test deletes prod data | Run only against staging; require a manual `--really-delete` flag plus 2-eye approval. |
| INTEGRATION-DEBT items balloon (we discover the primitive isn't actually correct when we wire it) | Each S-item budgets 1 day for "fix the primitive" before "wire the primitive." If a primitive needs >1 day of rework, escalate and reorder. |
| Single-engineer bottleneck | S2.4 (Slack + GitHub connectors) is a stretch — drop without affecting "beat" criteria for any single competitor. |

## What we explicitly will NOT do in 6 weeks

- Compete with LlamaParse on document parsing quality. It's years ahead. We document a "BYOP — bring your own parser" integration story instead.
- Match Pinecone's 200-index × 100k-namespace scale envelope. pgvector at our tier is ≤10M vectors per tenant — we publish that as a hard limit, not a hidden one.
- Build a hosted-eval/observability product to compete with LangSmith on its core. Different product class. We integrate with LangSmith via OTLP traces if customers want it.

## How we know we won

After Day 42, run a fresh `/luna-agents:ll-compete` against the same four URLs. The bi-weekly automated refresh (scheduled separately) will diff this report against the new one. If every "Where sdlc-platform already wins" bullet is now ✅ (runtime-wired) instead of 🟡 (primitive-only), and at least one row in the win matrix has flipped from 🔴 to ✅ for us in a slot where every competitor stays 🔴, we won.

The positioning one-liner becomes provable, not aspirational:

> The only RAG/LLM platform that combines tenant-isolated retrieval (Postgres RLS), a multi-provider LLM gateway with hard-cap spend control, and an OPA-enforced DLP layer in one product — every competitor ships at most one of those three.

## Single source of truth

- Status flips: `docs/roadmap/STATUS.md` (REAL/PARTIAL legend already aligned).
- Runtime integration audit: `docs/INTEGRATION-DEBT.md` — every S-item above corresponds to a 🟡 or 🔴 row that should flip to ✅ when we close it.
- Competitive context: `.luna/sdlc-platform/compete-report.md` (current snapshot) + bi-weekly refresh diff.

If a Sprint demo reveals a bullet here is wrong, edit this file in the same PR as the demo. Don't let the plan rot.
