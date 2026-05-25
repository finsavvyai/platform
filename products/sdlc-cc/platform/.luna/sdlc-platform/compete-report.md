# Competitive Analysis — sdlc-platform vs. RAG/LLM-platform incumbents

Last updated: 2026-04-27

## Executive verdict

Pinecone, Zilliz, LangSmith and LlamaCloud are all already SOC 2 Type II + HIPAA-ready and ship enterprise primitives we still have only as committed-but-unwired Go packages (see `docs/INTEGRATION-DEBT.md`: 0 ✅ / 13 🟡 / 18 🔴 across Phase 2). The only durable wedge is the *combination* of zero-trust RAG (Postgres RLS per tenant), an LLM gateway with hard-cap spend control, OPA policy, DLP middleware, and 10 enterprise SaaS connectors in one product — none of the four ship more than two of those. Shortest path to a defensible win: pick the five integrations in `INTEGRATION-DEBT.md` (RBAC+audit middleware wiring, Anthropic adapter, spend 402 cap, DLP middleware, Google Workspace connector) and demo them end-to-end against a single tenant — that turns ~32% production-ready into a pitchable enterprise pilot the four incumbents can't match in one box.

## Per-competitor card

### LangChain Cloud / LangSmith

- **What they sell**: LLM observability, eval, prompt management, and (since "Fleet"/"agents") hosted agent deployments. Not a RAG platform; not a vector DB.
- **Pricing** (https://www.langchain.com/pricing):
  - Developer: $0/seat, 5k base traces/mo, 14-day retention, community support.
  - Plus: $39/seat/mo, unlimited seats, 10k base traces/mo, 1 dev-sized agent deployment, up to 3 workspaces, email support.
  - Enterprise: custom — adds hybrid/self-hosted ("data doesn't leave your VPC"), custom SSO/RBAC, SLA.
  - Gotchas: extended-retention traces are $5/1k vs $2.50/1k base; usage billed monthly in arrears.
- **Compliance posture** (https://changelog.langchain.com/announcements/langsmith-is-now-soc-2-type-ii-compliant + https://changelog.langchain.com/announcements/eu-data-residency-for-langsmith): SOC 2 Type II since July 2024, HIPAA, GDPR. EU data residency live July 2024 at `eu.smith.langchain.com` on all plan tiers, no surcharge. Self-hosted/hybrid only on Enterprise. Customer-managed keys: not advertised on public pages — couldn't verify; estimate Enterprise-only via SOC 2 report.
- **Multi-tenancy model** (https://docs.langchain.com/langsmith/administration-overview): Organization → Workspace hierarchy. Workspaces "isolate teams or business units." Built-in roles: Workspace Admin / Editor / Viewer. Custom RBAC roles are Enterprise-only.
- **Strengths**:
  1. Deep tracing/eval product with 400-day extended retention — best-in-class for offline LLM evals.
  2. Self-hosted/hybrid VPC deployment available for Enterprise (we don't ship this).
  3. SOC 2 Type II + HIPAA + GDPR + EU residency all live, all priced into base tiers.
- **Weaknesses / gaps**:
  1. No vector DB, no RAG retrieval — they trace what *you* run.
  2. No DLP middleware on inbound/outbound prompts.
  3. RBAC is Enterprise-only; small teams pay $39/seat for SSO/RBAC.
  4. No spend hard-cap with 402 enforcement on the LLM call path itself (it's an observability tool, not a gateway).
  5. No first-party SaaS connector library (Drive/M365/Slack/etc.) — that's not their product.
- **Where sdlc-platform already wins**:
  - LLM gateway with multi-provider routing — primitive committed (`Provider` interface + `FallbackChain`), **not yet runtime-integrated** (zero adapters; Day 49 in INTEGRATION-DEBT.md).
  - Spend hard cap returning 402 — primitive committed (`spend.Tracker`, `spend.Check`, migration 012), **not yet runtime-integrated** (no LLM call site emits spend events; no middleware enforces).
  - 10 SaaS connector framework — primitive committed (registry + 10 stubs), **not yet runtime-integrated** (all return `ErrNotImplemented`; registry not constructed in main).
  - Postgres RLS per tenant on every data-bearing table — wired in migrations and used by the gateway DB layer today (this one is real).

### LlamaIndex / LlamaCloud

- **What they sell**: LlamaParse (document parsing), LlamaCloud-hosted indexes, LlamaIndex OSS framework. RAG-shaped, no LLM gateway.
- **Pricing** (https://www.llamaindex.ai/pricing):
  - Free: $0, 10K credits, 1 user, 5 indexes, 50 files/index.
  - Starter: $50/mo, 40K credits + up to 400K PAYG, 5 users, 50 indexes.
  - Pro: $500/mo, 400K credits + up to 4M PAYG, 10 users, Slack support, 100 indexes.
  - Enterprise: custom; SSO, VPC deployment, 5× rate limits, dedicated AM.
  - Gotchas: 1,000 credits = $1.25; basic parsing ≥1 credit/page; layout/AI parsing far more.
- **Compliance posture** (https://www.llamaindex.ai/enterprise): SOC 2 Type II ("LlamaParse is certified for: SOC 2 Type II"), GDPR, HIPAA. Encryption in transit and at rest. Cache "persists for only 48 hours … with an option to disable caching entirely." VPC deploy on AWS + Azure marketplaces. EU residency, customer-managed keys, customer-accessible audit log: not documented on the public pages — couldn't verify; estimate available only under Enterprise NDA.
- **Multi-tenancy model**: Project/index per organization; per-index file caps; Enterprise SSO. RBAC granularity not published on public docs — couldn't verify.
- **Strengths**:
  1. Best-in-class document parsing (LlamaParse) — layout, tables, formulas. We don't compete here.
  2. Lowest entry price for a real RAG product ($0 → $50 → $500/mo published).
  3. 48-hour bounded retention with an opt-out — strong default for regulated industries.
- **Weaknesses / gaps**:
  1. No LLM gateway with multi-provider fallback or spend cap — they're a parser/index product.
  2. No first-party SaaS connector marketplace (Drive/Slack/M365 etc.).
  3. No published audit-log query API for customers.
  4. No published OPA-style policy engine for retrieval-time enforcement.
  5. RBAC granularity not advertised publicly — likely Enterprise-only.
- **Where sdlc-platform already wins**:
  - OPA policy engine for retrieval/data access — primitive committed (Rego validator, policies package), **not yet runtime-integrated** (no admin endpoint validates user input; not in middleware chain — Day 18).
  - Audit log with HMAC tamper-evident chain — primitive committed (`audit.Writer`, migration 009), **not yet runtime-integrated** (no call site, migration unrun — Day 12).
  - Spend tracking + 402 hard cap — primitive committed, **not yet runtime-integrated** (Days 28-29).
  - RLS-per-tenant on all data tables — actually wired in DB layer today.

### Pinecone

- **What they sell**: Managed vector DB. Not a RAG platform, not an LLM gateway.
- **Pricing** (https://www.pinecone.io/pricing/):
  - Starter: free, ≤2GB, ≤2M write units/mo, ≤1M read units/mo, 1 project, 2 users, `us-east-1` only.
  - Standard: $50/mo minimum, $0.33/GB storage, $4-4.50/M write units, $16-18/M read units, 20 projects, 100k namespaces/index.
  - Enterprise: $500/mo minimum, 24-27/M read units, 99.95% SLA, private networking, customer-managed keys, audit logs, Pro support.
  - Gotchas: Inference (embeddings) is $0.08-$0.16/M tokens depending on model; reranking $2/1k requests.
- **Compliance posture** (https://www.pinecone.io/security/): SOC 2 Type II, HIPAA with BAA on request, GDPR-ready, ISO 27001. AES-256 at rest, TLS 1.2 in transit. CMEK ("Encrypt data using your own cloud provider KMS"). API-key roles + User RBAC. SAML SSO available; **MFA listed "Coming Soon"** as of fetch. Audit logs for "system events." Private endpoints supported.
- **Multi-tenancy model** (https://docs.pinecone.io/guides/projects/understanding-projects + https://docs.pinecone.io/guides/index-data/indexing-overview): Organization → Project → Index → Namespace. Project membership is the security boundary ("Only a user who belongs to the project can access the indexes"). Namespaces are explicitly *not* a security boundary — "Namespaces … speed up queries"; for tenant isolation Pinecone recommends "one namespace per customer" but you have to layer your own auth on top.
- **Strengths**:
  1. Mature SOC 2/HIPAA/ISO posture, CMEK, audit logs, and SAML SSO all GA.
  2. 99.95% SLA on Enterprise, private networking GA.
  3. Massive scale envelope (200 indexes, 100k namespaces/index on Enterprise).
- **Weaknesses / gaps**:
  1. Vector DB only — no LLM gateway, no RAG orchestration, no DLP, no SaaS connectors, no OPA policy.
  2. Namespace ≠ security boundary — multi-tenant isolation is the *customer's* problem.
  3. MFA still "Coming Soon" per security page at fetch time.
  4. No first-party document ingestion / OCR pipeline.
  5. Pricing scales aggressively per million reads — long-tail RAG workloads get expensive.
- **Where sdlc-platform already wins**:
  - End-to-end RAG with document processor → embeddings → pgvector → LLM gateway in one product (Pinecone is one tier of that).
  - Postgres RLS as the *enforced* multi-tenant boundary — actually wired in DB layer today, not "your problem to layer on."
  - DLP middleware on inbound/outbound prompts — primitive committed (`dlp.Detector`), **not yet runtime-integrated** on either leg (Days 34-35).
  - 10-connector SaaS marketplace — primitive committed, **not yet runtime-integrated** (all stubs).

### Zilliz Cloud (Milvus)

- **What they sell**: Managed Milvus vector DB, plus BYOC (Bring Your Own Cloud) variant where the data plane runs in the customer's AWS/GCP/Azure account.
- **Pricing** (https://zilliz.com/pricing — page is dynamic; details from https://zilliz.com/blog/zilliz-cloud-oct-2025-update + Zilliz docs):
  - Free: $0/mo, capped serverless cluster.
  - Serverless: PAYG, charged per read/write operation.
  - Dedicated: from $99/GB/mo, PAYG or contracted compute.
  - BYOC: contact sales — same features as Dedicated, data plane in customer VPC.
  - Gotchas: from Jan 1 2026 storage standardised at $0.04/GB/mo across AWS/Azure/GCP; cross-cloud/cross-region egress passed through at provider cost; monthly free credits cover baseline.
- **Compliance posture** (https://zilliz.com/security per WebSearch summary; trust-center page itself was thin at fetch): SOC 2 Type II, ISO 27001, GDPR, HIPAA-ready, RBAC, audit logs, 99.95% SLA. BYOC explicitly markets "vectors, indexes, and metadata remain entirely within your Virtual Private Cloud" — strongest data-residency story of the four.
- **Multi-tenancy model**: Organization → Project → Cluster → Collection. Standard project-level RBAC; BYOC mode gives the customer total isolation by deploying the data plane in their cloud account.
- **Strengths**:
  1. BYOC GA across AWS, GCP, Azure — beats Pinecone on data-residency stories where the customer wants the bytes never to leave their account.
  2. SOC 2 Type II + ISO 27001 + HIPAA-ready + 99.95% SLA published.
  3. Open-source Milvus underneath — escape hatch for customers who fear lock-in.
- **Weaknesses / gaps**:
  1. Vector DB only — no LLM gateway, no DLP, no OPA policy, no RAG ingestion pipeline, no SaaS connectors.
  2. RBAC depth and per-customer audit-log API not advertised on the trust center.
  3. Public pricing page is light on details — `/pricing-details` and `/cloud/pricing` 404.
  4. HIPAA "ready" ≠ HIPAA BAA — public pages don't confirm BAA on every tier.
  5. No first-party DLP / PII redaction layer.
- **Where sdlc-platform already wins**:
  - End-to-end stack (gateway + RAG + LLM routing + DLP + connectors) vs. Zilliz's vector-DB-only scope.
  - DLP middleware primitive — committed, **not yet runtime-integrated**.
  - Multi-provider LLM routing — primitive committed, **not yet runtime-integrated**.
  - Postgres + pgvector instead of standalone vector DB — one fewer system to operate; RLS is enforced by Postgres, not by app code.

## Win matrix

Legend: ✅ shipped & runtime-wired · 🟡 primitive committed but not runtime-wired · 🔴 missing · 💤 N/A for this product class.

| Capability | LangChain/LangSmith | LlamaIndex/LlamaCloud | Pinecone | Zilliz | sdlc-platform |
|---|---|---|---|---|---|
| RLS-style multi-tenant isolation | 🔴 (workspace-level only) | 🔴 (project-level only) | 🔴 (project; "namespace ≠ security boundary" [docs.pinecone.io/.../indexing-overview]) | 🔴 (project; BYOC swaps the threat model) | ✅ (Postgres RLS in `database/migrations/000-006`, used by gateway DB layer) |
| Customer-managed keys (BYOK/CMEK) | 🔴 not on public trust pages | 🔴 not advertised | ✅ Enterprise [pinecone.io/security] | ✅ via BYOC [zilliz.com/security] | 🔴 |
| Audit-log query API for customers | ✅ Enterprise [docs.langchain.com/langsmith/administration-overview] | 🔴 not documented | ✅ Enterprise [pinecone.io/security] | ✅ [zilliz.com/security per WebSearch] | 🟡 (`audit.Writer` + migration 009; no chi route, migration unrun — INTEGRATION-DEBT Day 12-13) |
| DLP middleware (inbound + outbound) | 🟡 PII masking client-side [LangChain docs] | 🔴 | 🔴 | 🔴 | 🟡 (`dlp.Detector` committed; no middleware integration — Days 34-35) |
| Multi-provider LLM routing + fallback | 💤 (observability only) | 🔴 (RAG/parser only) | 💤 | 💤 | 🟡 (`Provider` interface + `FallbackChain`; zero adapters — Day 49) |
| Spend hard cap → 402 on the request path | 🔴 | 🔴 | 🔴 (usage billing only) | 🔴 (usage billing only) | 🟡 (`spend.Tracker` + `spend.Check` + migration 012; no call site — Days 28-29) |
| 10+ first-party SaaS connectors (Drive/M365/Slack/etc.) | 🔴 | 🔴 | 💤 | 💤 | 🟡 (10 stubs returning `ErrNotImplemented`; registry not in main — Days 40-48) |
| Apple-HIG admin UI | 🔴 (functional, not HIG-styled) | 🔴 | 🔴 | 🔴 | 🟡 (Next.js 14 admin-ui exists; HIG pass not done) |
| On-prem / private-link / BYOC option | ✅ Enterprise hybrid/self-hosted | ✅ VPC deploy on AWS/Azure marketplaces | ✅ Private endpoints, Enterprise | ✅ BYOC GA on AWS/GCP/Azure | 🔴 (private-link runbook only, Terraform modules not committed — Day 27) |
| OPA / Rego policy engine for retrieval-time enforcement | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 (`opa/` rules + `SyntaxValidator`; no admin endpoint, not in chain — Day 18) |

## Where we lose today

1. **CMEK / BYOK**: Pinecone Enterprise and Zilliz BYOC ship customer-managed keys; we have nothing here, not even a primitive.
2. **On-prem / VPC deploy**: All four offer some flavour (LangSmith hybrid, LlamaCloud VPC, Pinecone private endpoints, Zilliz BYOC). We have a runbook only — Terraform modules promised but not committed (INTEGRATION-DEBT Day 27).
3. **RBAC enforcement on every handler**: We have `RequirePermission` middleware committed but "zero handlers wrap with it" (Day 22). LangSmith Enterprise, Pinecone, Zilliz all enforce RBAC out of the box.
4. **Customer-accessible audit log API**: LangSmith, Pinecone, Zilliz expose this. Our `audit.Writer` has no call site and no chi route (Days 12-13).
5. **SOC 2 Type II + HIPAA BAA**: All four have it. We don't (target Q2 2026 per CLAUDE.md). Until then, regulated buyers can't sign.
6. **MFA / SAML SSO actually working**: LangSmith and Pinecone ship SAML; Pinecone shows MFA "Coming Soon." Our `SAMLConfig.VerifyAssertion` literally returns `errors.New("not yet implemented")` (Day 24).
7. **Real document parsing quality**: LlamaParse is years ahead of our document-processor for layout/tables/formulas.
8. **Vector-DB scale envelope**: Pinecone Enterprise advertises 200 indexes × 100k namespaces. Our pgvector path has not been load-tested at that scale (Day 19 k6 scripts never executed).

## Path to beat — ordered by shipping cost

Each item is sized for what `INTEGRATION-DEBT.md` already says is left to do; ordering optimises for "cheapest item that closes the most competitor advantages."

1. **Wire the existing middleware chain (RBAC + RateLimit + Audit) into `cmd/server/router.go`**
   - Neutralises: LangSmith Enterprise RBAC, Pinecone audit logs, Zilliz audit logs.
   - Effort: M (~1 week)
   - Touch: `services/gateway/cmd/server/router.go`, `services/gateway/internal/middleware/chain.go`, apply migrations 007/009/010, add 1 testcontainers integration test per primitive.
   - Done-when: a real HTTP request to a protected handler is denied without the right permission, returns 429 over rate limit, and produces an HMAC-chained row in `audit_logs` you can query via `/v1/audit/events`.

2. **Ship one real LLM provider adapter (Anthropic) + spend tracking + 402 hard cap**
   - Neutralises: every competitor (none have spend-hard-cap on request path).
   - Effort: M (~1 week, combined because spend integration only matters with a real call site).
   - Touch: `services/gateway/internal/infrastructure/llm/anthropic/`, `services/gateway/cmd/server/main.go`, `services/gateway/internal/middleware/spend.go`, apply migration 012, seed `model_pricing`.
   - Done-when: `POST /v1/chat` calls Anthropic, records a row in `spend_events`, and returns `402 Payment Required` once the tenant cap is hit (proven by an integration test).

3. **Wire DLP middleware on the inbound prompt path**
   - Neutralises: nobody else has this — pure greenfield wedge.
   - Effort: S (~3 days)
   - Touch: `services/gateway/internal/middleware/dlp.go`, mount after Auth/Tenant before the RAG handler; add `tenant_dlp_policy` table; emit audit on every detection.
   - Done-when: a request containing a known PII pattern is masked/redacted/blocked according to tenant policy and produces an audit row.

4. **Ship the Google Workspace connector for real (OAuth + Drive list/fetch)**
   - Neutralises: no competitor offers a connector marketplace; this is the "only us" wedge.
   - Effort: M (~1 week, OAuth app setup is half of it).
   - Touch: `services/gateway/internal/infrastructure/connectors/google_workspace/`, `services/admin-ui` marketplace page, `/admin/connectors` API.
   - Done-when: a tenant can OAuth into Google Workspace from the admin UI and pull a Drive folder into a corpus that becomes searchable in RAG.

5. **Wire OPA policy enforcement into the retrieval handler**
   - Neutralises: nobody else has retrieval-time policy enforcement.
   - Effort: S (~3 days, the validator already exists).
   - Touch: `services/opa/`, `services/gateway/internal/middleware/policy.go`, admin endpoint that runs `SyntaxValidator` on save.
   - Done-when: a tenant can save a Rego policy in the admin UI, an attempted retrieval that violates it returns 403 with the failing rule name in the response, and the decision is in the audit log.

6. **Customer-accessible audit-log query API + admin-UI page**
   - Neutralises: LangSmith Enterprise, Pinecone Enterprise, Zilliz.
   - Effort: S (~3 days; writer already exists, only reader is missing).
   - Touch: `services/gateway/internal/handlers/audit.go`, `services/gateway/api/openapi-extensions.yaml`, admin-ui audit-events page.
   - Done-when: `GET /v1/audit/events?since=...&action=...` returns paginated, signature-verified rows; admin UI has a filterable view.

7. **CMEK (envelope encryption with customer-supplied AWS KMS key) for stored documents and embeddings**
   - Neutralises: Pinecone Enterprise CMEK, Zilliz BYOC.
   - Effort: L (>1 week)
   - Touch: `services/gateway/internal/infrastructure/crypto/`, doc CDK at `compliance/encryption-at-rest.md`, migration to add `tenant_kms_key_arn` column, document-processor uses it for envelope-encrypting blobs before pgvector insert.
   - Done-when: a tenant can register an AWS KMS ARN, new documents are envelope-encrypted with it, deleting the customer's key makes the documents undecryptable on next read (proven by a destructive test in staging).

8. **Real SAML SSO + MFA challenge flow**
   - Neutralises: LangSmith Enterprise, Pinecone (which still shows MFA "Coming Soon").
   - Effort: L (>1 week, needs an IdP test tenant).
   - Touch: `services/gateway/internal/infrastructure/auth/saml/`, replace the literal `errors.New("not yet implemented")` in `VerifyAssertion`, MFA challenge state machine.
   - Done-when: a tenant admin can register Okta as an IdP, log in via SAML, complete a TOTP MFA challenge, and the session token reflects both factors.

9. **Terraform module for AWS PrivateLink + private-network deploy**
   - Neutralises: LangSmith Enterprise hybrid, LlamaCloud VPC, Pinecone private endpoints, Zilliz BYOC.
   - Effort: L (>1 week)
   - Touch: `deployments/terraform/private-link/`, runbook at `docs/operations/private-link.md`.
   - Done-when: a customer can `terraform apply` to stand up a VPC endpoint pointing at our gateway, and traffic to the public endpoint from outside their VPC is denied.

10. **SOC 2 Type II readiness drive (controls, evidence, auditor)**
    - Neutralises: all four — until we have it, regulated buyers can't even start procurement.
    - Effort: L (months, mostly paperwork — start in parallel with the above).
    - Touch: `compliance/`, every CI workflow needs evidence collection, RBAC + audit + DLP need to be ✅ before this matters.
    - Done-when: SOC 2 Type II report dated within the last 12 months is downloadable from a customer-facing trust center.

## Positioning one-liner

The only RAG/LLM platform that combines tenant-isolated retrieval (Postgres RLS), a multi-provider LLM gateway with hard-cap spend control, and an OPA-enforced DLP layer in one product — every competitor ships at most one of those three.

## Sources

All fetched on 2026-04-27.

- https://www.langchain.com/pricing
- https://changelog.langchain.com/announcements/langsmith-is-now-soc-2-type-ii-compliant (via WebSearch)
- https://changelog.langchain.com/announcements/eu-data-residency-for-langsmith
- https://docs.langchain.com/langsmith/administration-overview
- https://www.llamaindex.ai/pricing
- https://www.llamaindex.ai/enterprise
- https://www.pinecone.io/pricing/
- https://www.pinecone.io/security/
- https://docs.pinecone.io/guides/projects/understanding-projects
- https://docs.pinecone.io/guides/index-data/indexing-overview
- https://zilliz.com/pricing (returned thin content; backed by WebSearch summary of zilliz.com/blog/zilliz-cloud-oct-2025-update and docs.zilliz.com/docs/select-zilliz-cloud-service-plans)
- https://zilliz.com/security (redirects to /trust-center; trust-center page itself was thin — verified via WebSearch)
- https://zilliz.com/blog/zilliz-cloud-byoc-now-available-across-aws-gcp-and-azure (via WebSearch)
- Internal: `/Users/shaharsolomon/dev/projects/portfolio/sdlc-platform/docs/INTEGRATION-DEBT.md`
- Internal: `/Users/shaharsolomon/dev/projects/portfolio/sdlc-platform/CLAUDE.md`
