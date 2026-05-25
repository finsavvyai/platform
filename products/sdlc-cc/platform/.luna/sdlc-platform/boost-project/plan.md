# SDLC Boost Plan — One-Pager

**Date:** 2026-04-08
**Goal:** Raise SDLC readiness from 51% to ~70% by adopting 6 tier-1 OSS projects over ~14 weeks.
**Success criteria:** SOC2 Type II evidence in place, llm-gateway refactored, ingestion 40% faster, enterprise auth story credible.

---

## Prioritized Integration Order

### Wave 1 — Observability Quick Wins (Weeks 1-2)  •  Risk: Low
1. **Langfuse**  — self-host on existing Postgres; SDKs in `llm-gateway` + `rag`.
2. **OpenLLMetry** — OTel instrumentation for all LLM-touching services.
3. **Scalar** — replace Swagger UI in `admin-ui` docs route.

**Why first:** zero data migration, no prod risk, unblocks every later decision (you can *measure* impact of everything that follows). Also produces SOC2 evidence immediately.

**Definition of done:**
- Every LLM call traced with tenant_id, user_id, cost.
- Admin UI has a "Traces" tab.
- CI emits cost/latency delta comments on PRs touching `rag/` or `llm-gateway/`.

---

### Wave 2 — Gateway De-risk + RAG Evals (Weeks 3-4)  •  Risk: Medium
4. **LiteLLM** — deploy as sidecar; migrate provider-specific code out of Go gateway.
5. **RAGAS** — nightly CI eval against golden set; scores dashboarded in Langfuse.
6. **Instructor** — structured output in `rag/` and `dlp/` Python services.

**Why second:** unblocks the 25-file OpenAPI3 gateway refactor by shrinking scope. RAGAS gives the "how accurate is the AI" number needed for enterprise sales.

**Definition of done:**
- Go gateway contains zero provider SDK code.
- Nightly RAGAS score >0.85 on golden set of 200 Q&A pairs.
- Zero pydantic parse errors in DLP policy path for 7 days.

---

### Wave 3 — Enterprise Document Pipeline (Weeks 5-6)  •  Risk: Medium
7. **Unstructured.io** — primary enterprise ingestion path.
8. **Docling** — high-fidelity PDF/table extraction.
9. **MarkItDown** — fast path for simple files.

**Why third:** enterprise customers will reject the current Tesseract-only pipeline on first complex PDF. This closes the "can I upload our 200-page compliance manual" objection.

**Definition of done:**
- Document-processor supports PDF, DOCX, PPTX, XLSX, HTML, EML with tables preserved.
- Per-format strategy routing (fast/hi_res) configurable per tenant.
- Benchmark: 40% latency reduction on mixed-format corpus vs Tesseract baseline.

---

### Wave 4 — Durability + Scale (Weeks 7-9)  •  Risk: Medium-High
10. **Temporal** — durable workflows for ingestion pipeline.
11. **Qdrant** — tier-2 vector store for hot retrieval.

**Why fourth:** the biggest architectural change; do it after you can measure regressions with Wave 1's tracing.

**Definition of done:**
- Ingestion survives worker restarts mid-job (chaos test passes).
- Retrieval p99 <150ms at 1M vectors (vs current ~500ms on pgvector).
- Dual-write feature flag proven safe in staging.

---

### Wave 5 — Enterprise Auth + Guardrails (Weeks 10-12)  •  Risk: Medium-High
12. **OpenFGA** — relationship-based access control.
13. **NeMo Guardrails** — per-tenant topical + safety rails.

**Why fifth:** enterprise deal-breakers. Must land before GA (Q3 2026).

**Definition of done:**
- Folder-level sharing with delegated admin works in admin UI.
- Tenant can define a "never discuss X" rule and it's enforced in <300ms.
- OpenFGA schema reviewed and documented.

---

### Wave 6 — Polish + Audit (Weeks 13-14)  •  Risk: Low
14. **Fern** — SDK generation from OpenAPI.
15. **DSPy** — prompt optimization on the top-3 RAG flows.
16. **Loki + Vector.dev** — append-only audit log pipeline.

**Why last:** depends on gateway OpenAPI3 migration (Fern), on Wave 2 metrics (DSPy), and on Wave 1 telemetry (Loki pipeline).

**Definition of done:**
- `packages/sdk-*` regenerated nightly from OpenAPI.
- DSPy-optimized prompts show ≥10% faithfulness improvement on RAGAS.
- Audit logs retained 7 years in R2, access-controlled, queryable from admin UI.

---

## Resource & Risk Summary

| Wave | Effort (eng-weeks) | Infra added | Rollback path |
|---|---|---|---|
| 1 | 1.5 | Langfuse Postgres | Disable SDK |
| 2 | 2 | LiteLLM sidecar | Route back to Go gateway |
| 3 | 2 | Python workers | Feature flag to Tesseract |
| 4 | 4 | Temporal cluster, Qdrant | Dual-write flag |
| 5 | 3 | OpenFGA Postgres | Fall back to RLS-only |
| 6 | 1.5 | Loki + Vector agents | Dual-ship logs |
| **Total** | **~14 eng-weeks** | | |

---

## Decision Gates

- **After Wave 1:** Is Langfuse data volume manageable? If no, partition or add Clickhouse.
- **After Wave 2:** Is LiteLLM latency acceptable? If no, evaluate Portkey (Cloudflare Worker edge alt).
- **After Wave 3:** Is Docling GPU usage affordable? If no, restrict to Enterprise tier.
- **After Wave 4:** Is Temporal operational burden justified? If no, downgrade to Inngest.
- **After Wave 5:** Does OpenFGA schema cover real customer scenarios? If no, extend before GA.

---

## Out-of-Scope (explicitly deferred)

- LangChain / LlamaIndex (conflicts with existing composition)
- Milvus / Weaviate (Qdrant chosen)
- Guardrails.ai (NeMo + Outlines covers it)
- Ory Keto / Permify (OpenFGA chosen)
- Prefect / Dagster (Temporal chosen)

---

## Next Action

Open tracking issues for Wave 1 (Langfuse, OpenLLMetry, Scalar) and schedule a 60-minute design review focused on Langfuse deployment topology (shared Postgres vs dedicated).
