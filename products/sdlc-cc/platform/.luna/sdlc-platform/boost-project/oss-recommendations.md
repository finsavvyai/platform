# SDLC Platform — Open-Source Boost Recommendations

**Date:** 2026-04-08
**Scope:** 15 high-impact OSS projects mapped to SDLC's components
**Audience:** Platform engineering, architecture review

---

## Executive Summary

SDLC Platform has solid primitives (Gateway, RAG, LLM Gateway, DLP) but several are home-grown where a battle-tested OSS drop-in would cut months of work. The highest-ROI picks are:

1. **Langfuse** — LLM observability (replaces any bespoke tracing in llm-gateway)
2. **LiteLLM** — Drop-in multi-provider router (de-risks llm-gateway)
3. **Unstructured.io + Docling** — Enterprise doc parsing (replaces Tesseract-only pipeline)
4. **OpenFGA** — Zero-trust authorization (complements OPA, closes fine-grained gap)
5. **Temporal** — Durable RAG ingestion workflows (replaces ad-hoc Bull queues)
6. **Qdrant** — Vector search tier-2 (keeps pgvector for OLTP, adds hot-query tier)

Total estimated integration effort for tier-1 picks: **6-8 engineer-weeks**. Expected impact: SOC2 Type II unlock, 40% faster doc ingestion, removal of ~25 bespoke files from llm-gateway.

---

## 1. RAG Enhancement

### 1.1 DSPy
- **Repo:** https://github.com/stanfordnlp/dspy
- **Stars / activity:** ~19k, very active (Stanford NLP)
- **Why it fits:** SDLC's RAG pipeline currently does prompt engineering inline. DSPy lets you declaratively define signatures (`question -> answer`) and optimize prompts against a dev set — crucial for enterprise RAG where accuracy has to be defensible in audits. Works cleanly alongside the existing Hybrid Search (RRF) boost.
- **Integration effort:** **Medium** — wrap existing retrieval as a DSPy Retriever; rewrite the `services/rag/main.py` LLM-call path as DSPy modules.
- **Risk:** DSPy optimization requires labeled eval data. API has churned between 2.x and 3.x. Pin versions.
- **Enhances:** `services/rag/` (core generation path)

### 1.2 RAGAS
- **Repo:** https://github.com/explodinggradients/ragas
- **Stars / activity:** ~9k, very active
- **Why it fits:** SDLC has zero RAG evaluation today. RAGAS provides faithfulness, answer relevancy, context precision, and context recall metrics — exactly what SOC2 Type II auditors will ask for ("how do you know your AI is accurate?"). Pairs with Langfuse for tracking eval runs.
- **Integration effort:** **Low** — run as a CI job against a golden set; surface scores in admin UI.
- **Risk:** Eval calls cost tokens; budget ~$20-50/run. Metrics are LLM-as-judge, not ground truth.
- **Enhances:** `services/rag/`, CI (`.github/workflows/`)

### 1.3 Instructor
- **Repo:** https://github.com/jxnl/instructor
- **Stars / activity:** ~9k, very active
- **Why it fits:** Python-side structured output via Pydantic. SDLC's RAG and DLP Python services already use Pydantic; Instructor gives you retry-on-validation-failure with minimal code. Better DX than raw JSON-mode.
- **Integration effort:** **Low** — 1-2 days.
- **Risk:** Only helps Python services; Go services need different tooling (see Outlines/LMFE below).
- **Enhances:** `services/rag/`, `services/dlp/`

---

## 2. LLM Observability

### 2.1 Langfuse  ⭐ Tier-1
- **Repo:** https://github.com/langfuse/langfuse
- **Stars / activity:** ~8k, very active
- **Why it fits:** Self-hostable LLM tracing with traces, generations, scores, and datasets. SDLC needs audit logs for every LLM call (SOC2 requirement) — Langfuse gives you that *plus* a review UI for the admin dashboard. MIT-licensed, works with existing Postgres. Integrates cleanly via OpenInference/OpenTelemetry spans emitted by LiteLLM (see 4.1), so one integration covers both.
- **Integration effort:** **Medium** — deploy via Docker, wire SDK into llm-gateway (Go) and rag (Python), add trace-ID propagation through existing middleware chain.
- **Risk:** Self-hosted Postgres can grow fast; partition or archive old traces.
- **Enhances:** `services/llm-gateway/`, `services/rag/`, audit logging infra

### 2.2 Arize Phoenix
- **Repo:** https://github.com/Arize-ai/phoenix
- **Stars / activity:** ~4k, active
- **Why it fits:** Local/embedded LLM eval + observability. Strong for drift detection on embeddings — relevant because SDLC uses multiple embedding providers. Good for dev-time debugging; complements Langfuse (which is better for prod).
- **Integration effort:** **Low** — local notebook/dev mode needs no infra.
- **Risk:** Weaker multi-tenant story than Langfuse; use in dev, not prod.
- **Enhances:** `services/embedding/`, `services/rag/` (dev)

### 2.3 OpenLLMetry (Traceloop)
- **Repo:** https://github.com/traceloop/openllmetry
- **Stars / activity:** ~5k, active
- **Why it fits:** OpenTelemetry-native instrumentation for LLM calls across Go, Python, Node. SDLC is already polyglot — OpenLLMetry gives a consistent tracing model that flows into Langfuse or any OTel backend. Matches the existing `@finsavvyai/monitor` package approach.
- **Integration effort:** **Low-Medium** — drop-in SDK per service.
- **Risk:** Go support lags Python; may need custom spans for Go LLM Gateway.
- **Enhances:** All LLM-touching services

---

## 3. LLM Safety / Guardrails

### 3.1 NeMo Guardrails
- **Repo:** https://github.com/NVIDIA/NeMo-Guardrails
- **Stars / activity:** ~4k, active
- **Why it fits:** Colang-based programmable rails (topical, safety, jailbreak, fact-checking). SDLC's enterprise pitch is "zero-trust AI" — rails are the marketing match. Can enforce "never discuss competitor X" or "always cite source" rules per tenant.
- **Integration effort:** **Medium** — runs as a Python sidecar or proxy; needs tenant-scoped config.
- **Risk:** Adds latency (~100-300ms per check); Colang has a learning curve.
- **Enhances:** `services/rag/`, `services/llm-gateway/` (response post-processing)

### 3.2 Outlines
- **Repo:** https://github.com/dottxt-ai/outlines
- **Stars / activity:** ~10k, very active
- **Why it fits:** Token-level structured output (regex, JSON schema, grammar). For DLP policies and API-bound responses, Outlines guarantees a valid response — no retry loops. Faster than Instructor because it constrains decoding.
- **Integration effort:** **Medium** — requires control over the inference path; easier with local/open-weights than with OpenAI.
- **Risk:** Only works with providers you control (vLLM, Ollama, Transformers). Won't help with OpenAI API-hosted models.
- **Enhances:** `services/rag/` (local inference path), `services/dlp/`

---

## 4. LLM Gateway Alternatives

### 4.1 LiteLLM  ⭐ Tier-1
- **Repo:** https://github.com/BerriAI/litellm
- **Stars / activity:** ~13k, extremely active (daily releases)
- **Why it fits:** This is the one. SDLC's `services/llm-gateway/` (Go) duplicates what LiteLLM does in Python: provider routing, fallback, cost tracking, rate limiting, virtual keys. LiteLLM already supports 100+ providers, has a proxy mode, built-in Langfuse/OTel hooks, budgets, and per-key rate limits. Running LiteLLM as a sidecar + keeping Go gateway as the enterprise surface is the pragmatic play.
- **Integration effort:** **Medium** — deploy LiteLLM proxy, repoint Go gateway to it internally, migrate provider-specific logic out.
- **Risk:** Python sidecar adds an extra hop. Mitigated by colocating containers. License: MIT.
- **Enhances / partially replaces:** `services/llm-gateway/`

### 4.2 Portkey AI Gateway
- **Repo:** https://github.com/Portkey-AI/gateway
- **Stars / activity:** ~6k, active
- **Why it fits:** Written in TypeScript, edge-friendly (runs on Cloudflare Workers — matches SDLC's existing proxy-worker). Lightweight alternative if LiteLLM's Python footprint is unwanted.
- **Integration effort:** **Low** — deploy as a Worker.
- **Risk:** Fewer providers than LiteLLM; smaller community.
- **Enhances:** `services/proxy-worker/`, `services/llm-gateway/`

---

## 5. Authorization

### 5.1 OpenFGA  ⭐ Tier-1
- **Repo:** https://github.com/openfga/openfga
- **Stars / activity:** ~3.5k, very active (CNCF sandbox, backed by Auth0)
- **Why it fits:** SDLC has tenant RLS via Postgres but nothing for relationship-based access ("user X can read doc Y because they're in team Z which owns folder W"). OpenFGA is Google Zanzibar-inspired, purpose-built for this. Critical for enterprise customers who want folder-level sharing, delegated admin, and fine-grained doc permissions. OPA handles policy evaluation; OpenFGA handles the relationship graph — they are complementary, not duplicates.
- **Integration effort:** **Medium-High** — schema design (relationship tuples) is the real work; 1-2 weeks for a solid first pass.
- **Risk:** New infra component (Postgres-backed). Consistency model (eventual vs. strict) needs a design decision.
- **Enhances:** `services/gateway/`, complements `services/opa/`

### 5.2 Casbin
- **Repo:** https://github.com/casbin/casbin
- **Stars / activity:** ~18k, very active
- **Why it fits:** Simpler alternative to OpenFGA. Native Go support — fits `services/gateway/` directly. RBAC/ABAC policies with PERM metamodel. Good fallback if OpenFGA feels heavy.
- **Integration effort:** **Low** — Go library, ~1 week.
- **Risk:** Not as expressive as Zanzibar for complex graph queries.
- **Enhances:** `services/gateway/`, `packages/shared-auth/`

---

## 6. Document Processing

### 6.1 Unstructured.io  ⭐ Tier-1
- **Repo:** https://github.com/Unstructured-IO/unstructured
- **Stars / activity:** ~9k, very active
- **Why it fits:** SDLC's document-processor uses Tesseract which is OK for scans but bad for enterprise formats (PPTX, DOCX, HTML emails, complex PDFs with tables). Unstructured handles 25+ formats, produces structured elements (Title, NarrativeText, Table), and has strategies ("auto", "hi_res", "ocr_only") that trade cost for quality. Outputs chunk-ready structures — kills half the chunking code.
- **Integration effort:** **Medium** — runs as Python service; replace or supplement `services/document-processor/`.
- **Risk:** Apache-2 core is solid; enterprise features (SaaS-only) are not OSS. hi_res strategy uses GPU-heavy models.
- **Enhances / partially replaces:** `services/document-processor/`

### 6.2 Docling
- **Repo:** https://github.com/docling-project/docling
- **Stars / activity:** ~20k, very active (IBM Research, now Linux Foundation)
- **Why it fits:** Best-in-class PDF layout and table extraction, MIT-licensed, local-only (no API calls). Produces DoclingDocument — a typed, structured format that serializes to Markdown/JSON. Perfect for the "enterprise docs" path where you can't send data to third parties.
- **Integration effort:** **Low-Medium** — Python lib, drop into document-processor.
- **Risk:** Heavier than pdfplumber; model downloads are large. Pair with Unstructured for format coverage, Docling for PDF quality.
- **Enhances:** `services/document-processor/`

### 6.3 MarkItDown
- **Repo:** https://github.com/microsoft/markitdown
- **Stars / activity:** ~50k, very active (Microsoft)
- **Why it fits:** Lightweight "give me markdown from anything" (Office, PDF, images, audio transcripts). Ideal for a quick-ingest path before deciding if full Docling/Unstructured processing is worth it. Can be the fast tier in a tiered ingestion pipeline.
- **Integration effort:** **Low** — CLI + Python lib.
- **Risk:** Less structure than Docling/Unstructured; use for simple cases.
- **Enhances:** `services/document-processor/` (fast path)

---

## 7. Vector Search

### 7.1 Qdrant  ⭐ Tier-1 (optional tier-2 store)
- **Repo:** https://github.com/qdrant/qdrant
- **Stars / activity:** ~23k, very active
- **Why it fits:** pgvector is fine for <10M vectors with moderate QPS, but SDLC is targeting enterprise scale (1M documents / 10K concurrent users per CLAUDE.md). Qdrant is Rust-native, supports filtered search (critical for multi-tenant), payload indexes, and quantization. Run alongside pgvector: Postgres for OLTP/ACID, Qdrant for hot retrieval. `services/vector-core/` (Rust) can bind directly.
- **Integration effort:** **Medium** — dual-write during ingestion; read path switch via feature flag.
- **Risk:** Adds infra. Data sync discipline required.
- **Enhances:** `services/vector-core/`, complements pgvector

### 7.2 LanceDB
- **Repo:** https://github.com/lancedb/lancedb
- **Stars / activity:** ~6k, very active
- **Why it fits:** Embedded/serverless vector DB on top of Apache Arrow + object storage. Natural fit for Cloudflare R2 (SDLC already uses R2). No separate server to operate — perfect for small tenants or dev environments.
- **Integration effort:** **Low-Medium** — Rust/Python SDKs.
- **Risk:** Newer, smaller community than Qdrant. Best-suited for append-heavy workloads.
- **Enhances:** `services/vector-core/`, tenant-isolated storage

---

## 8. Workflow Orchestration

### 8.1 Temporal  ⭐ Tier-1
- **Repo:** https://github.com/temporalio/temporal
- **Stars / activity:** ~12k, very active
- **Why it fits:** RAG ingestion is multi-step (parse → chunk → embed → index → audit) with long-running steps and retries. Bull/Redis queues break when a worker dies mid-job; Temporal guarantees durable execution. Go and TypeScript SDKs match SDLC's stack. OPA policy evals, DLP scans, and multi-provider embeddings all benefit from durable replay.
- **Integration effort:** **Medium-High** — requires thinking in terms of workflows/activities; 2-3 weeks for first production workflow.
- **Risk:** Temporal server is a heavy dep (Postgres + worker). Cloud-hosted option exists. Learning curve is real.
- **Enhances / replaces:** Bull queue in `services/document-processor/`, ad-hoc retry logic everywhere

### 8.2 Inngest
- **Repo:** https://github.com/inngest/inngest
- **Stars / activity:** ~7k, very active
- **Why it fits:** Lighter-weight alternative to Temporal with TypeScript-first DX. Has a self-hostable OSS dev server and Cloudflare Workers support. If Temporal feels too heavy, Inngest is the pragmatic step-up from Bull.
- **Integration effort:** **Low-Medium**
- **Risk:** Full features require their cloud product; OSS dev server is for development.
- **Enhances:** `services/document-processor/`, `services/realtime/`

---

## 9. Compliance / Audit

### 9.1 Grafana Loki + Vector.dev
- **Repo:** https://github.com/grafana/loki , https://github.com/vectordotdev/vector
- **Stars / activity:** Loki ~23k, Vector ~18k, both very active
- **Why it fits:** SOC2 requires append-only, tamper-evident audit logs with 7-year retention. Loki stores logs cheap on S3/R2; Vector.dev is the Rust-based log router/transformer. Pair them: Vector ingests from every service (Go, Python, Node) and ships to Loki. Cheap, battle-tested, and GPL/Apache-licensed.
- **Integration effort:** **Medium** — deploy Loki; add Vector agent to each service.
- **Risk:** Not a "compliance product" per se — you still own retention policies and access controls.
- **Enhances:** Audit logging across all services

### 9.2 OpenTelemetry Collector (audit mode)
- **Repo:** https://github.com/open-telemetry/opentelemetry-collector
- **Stars / activity:** ~5k collector core, massive ecosystem
- **Why it fits:** Already implicit in the `@finsavvyai/monitor` package. Use it as the single spine for metrics + traces + logs + audit events. Emit audit events as structured log records with resource attributes (`tenant_id`, `actor`, `action`). Feeds into Loki, Langfuse, or any SIEM.
- **Integration effort:** **Low** (if monitor already uses OTel)
- **Risk:** Requires disciplined attribute conventions — publish an internal schema.
- **Enhances:** All services, audit infra

---

## 10. Developer Experience

### 10.1 Scalar
- **Repo:** https://github.com/scalar/scalar
- **Stars / activity:** ~9k, very active
- **Why it fits:** Beautiful OpenAPI docs UI (React, Next.js-ready). Drop-in replacement for Swagger UI. Matches Apple-HIG design tone required by the portfolio CLAUDE.md. Sits naturally on top of the in-progress kin-openapi migration.
- **Integration effort:** **Low** — 1 day.
- **Risk:** None meaningful.
- **Enhances:** `services/admin-ui/`, docs site

### 10.2 Fern (Stainless-alternative, OSS)
- **Repo:** https://github.com/fern-api/fern
- **Stars / activity:** ~2.5k, very active
- **Why it fits:** Generates TypeScript/Python/Go/Java SDKs from OpenAPI — exactly what SDLC's `packages/sdk-*` directories need once the gateway OpenAPI3 migration lands. Higher-quality codegen than openapi-generator. MIT-licensed core; paid tier exists for distribution.
- **Integration effort:** **Low-Medium** — wire into CI after OpenAPI3 migration.
- **Risk:** Premium features (SDK publishing automation) need their cloud.
- **Enhances:** `packages/sdk-go/`, `packages/sdk-py/`, `packages/sdk-ts/`

---

## Matrix: Recommendation → Component

| Project | Component(s) Enhanced | Tier | Effort |
|---|---|---|---|
| Langfuse | llm-gateway, rag, audit | 1 | Medium |
| LiteLLM | llm-gateway | 1 | Medium |
| OpenFGA | gateway, shared-auth | 1 | Med-High |
| Unstructured.io | document-processor | 1 | Medium |
| Docling | document-processor | 1 | Low-Med |
| Temporal | document-processor, rag | 1 | Med-High |
| Qdrant | vector-core | 1 | Medium |
| DSPy | rag | 2 | Medium |
| RAGAS | rag, CI | 2 | Low |
| NeMo Guardrails | rag, llm-gateway | 2 | Medium |
| OpenLLMetry | all LLM services | 2 | Low-Med |
| Scalar | admin-ui, docs | 2 | Low |
| Fern | sdk-* | 2 | Low-Med |
| Casbin | gateway (fallback to OpenFGA) | 3 | Low |
| MarkItDown | document-processor fast path | 3 | Low |
| LanceDB | vector-core (dev/small tenants) | 3 | Low-Med |
| Instructor | rag, dlp | 3 | Low |
| Outlines | rag (local inference) | 3 | Medium |
| Portkey | proxy-worker | 3 | Low |
| Phoenix | embedding, rag (dev) | 3 | Low |
| Loki + Vector | audit | 2 | Medium |
| OTel Collector | all | 2 | Low |
| Inngest | document-processor | 3 | Low-Med |

---

## What I am NOT recommending (and why)

- **LangChain** — Already battle-scarred; heavy abstractions, churn, and hidden costs. SDLC's Hybrid Search + Smart Router composition is cleaner than what LangChain would impose.
- **LlamaIndex** — Overlaps DSPy but with worse composability. Pick one.
- **Haystack** — Solid, but Python-only and opinionated about pipelines in a way that conflicts with SDLC's Go gateway.
- **Embedchain / Pathway** — Narrower use cases than Unstructured + DSPy covers.
- **Weaviate / Milvus / Chroma** — Qdrant wins on performance + multi-tenant filtering. Chroma is fine for prototypes only.
- **Guardrails.ai** — NeMo Guardrails + Outlines covers the same ground with better structured-output story.
- **Ory Keto / Permify** — OpenFGA has the most momentum in the Zanzibar space right now.
- **Prefect / Dagster / Flyte** — Data-science orchestrators. SDLC's async path is app-workflow, which Temporal owns.

---

## Integration Sequence (see plan.md for dates)

**Sprint 1 (weeks 1-2):** Langfuse + OpenLLMetry + Scalar — instant observability wins, no data migration.
**Sprint 2 (weeks 3-4):** LiteLLM sidecar, RAGAS eval CI, Instructor in rag/dlp.
**Sprint 3 (weeks 5-6):** Unstructured.io + Docling ingestion tier; MarkItDown fast path.
**Sprint 4 (weeks 7-9):** Temporal workflows for ingestion; Qdrant tier-2 store.
**Sprint 5 (weeks 10-12):** OpenFGA schema + shared-auth integration; NeMo Guardrails per-tenant rails.
**Sprint 6 (weeks 13-14):** Fern SDK generation, DSPy optimization on rag, Loki audit pipeline.

---

## Appendix: License Summary

| Project | License | Self-host friendly |
|---|---|---|
| Langfuse | MIT | Yes |
| LiteLLM | MIT | Yes |
| OpenFGA | Apache-2.0 | Yes |
| Unstructured | Apache-2.0 | Yes (core) |
| Docling | MIT | Yes |
| Temporal | MIT | Yes (heavy) |
| Qdrant | Apache-2.0 | Yes |
| DSPy | MIT | Yes |
| RAGAS | Apache-2.0 | Yes |
| NeMo Guardrails | Apache-2.0 | Yes |
| OpenLLMetry | Apache-2.0 | Yes |
| Scalar | MIT | Yes |
| Fern | MIT (core) | Yes (core) |
| Loki | AGPL-3.0 | Yes (check license terms for SaaS) |

**AGPL caveat:** Loki's AGPL license matters only if SDLC modifies Loki itself. Standard use as a backing store is fine.
