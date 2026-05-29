# SDLC — World‑Scale Implementation Playbook (v1.0)
**Product:** SDLP v3 — Autonomous Secure Data Intelligence Fabric  
**Company:** SDLC Technologies Ltd.  
**Owner:** **Shachar Solomon (Founder & CTO)**  
**Goal:** Enable a full, production‑grade implementation using AI-assisted code generation, with precise prompts, specs, and runbooks.

---

## 0) North Star
> Build a **secure, autonomous, high‑throughput data‑to‑AI fabric** that any enterprise can deploy across clouds and on‑prem: policy‑first, RAG‑powered, self‑optimizing.

**Design mandates**
- Zero trust: *deny by default*, purpose‑bound access, redaction before embedding.  
- Autonomy: learning loop (policy, retrieval, DLP, cost).  
- Scale: > 1B chunks / > 100K RPS gateway / multi‑region HA.  
- Verifiability: immutable audit, reproducible runs, versioned policies & models.

---

## 1) Macro Architecture (Component Map)
```
+----------------------+        +--------------------+       +-------------------+
|  Data Sources        |  -->   | Privacy & Crypto   |  -->  |  SDLC Gateway     |
| (DBs/APIs/Lakes)     | mTLS   | (DLP, Tokenize)    | OPA   | (AuthZ, OPA, QoS) |
+----------------------+        +--------------------+       +-------------------+
                                                                  |      \
                                                                  |       \--> LLM Gateway -> LLM (inference)
                                                                  v
                                                        +--------------------+
                                                        | RAG Service        |
                                                        | (chunk/emb/ret)    |
                                                        +--------------------+
                                                                  |
                                                                  v
                                                        +--------------------+
                                                        | Vector Store       |
                                                        | (pgvector / HNSW)  |
                                                        +--------------------+
                                                                  |
                                                                  v
                                                        +--------------------+
                                                        | Audit & Telemetry  |
                                                        | (Kafka, OTEL)      |
                                                        +--------------------+
                                                                  |
                                                                  v
                                                        +--------------------+
                                                        | Learning Engine    |
                                                        | (agents: policy,   |
                                                        |  retriever, dlp,   |
                                                        |  threat, cost)     |
                                                        +--------------------+
```

**Languages by layer**
- **Go:** Gateway, policy adapter, telemetry, service clients.  
- **Rust:** Retrieval core (ANN/cosine), crypto hot paths.  
- **Python:** Embedding models, LLM orchestration, admin tooling.  
- **TS/Next.js:** Console and compliance dashboard.  

---

## 2) Repos & Directory Standard
```
sdlc/
 ├─ apps/
 │   ├─ gateway-go/           # Go, REST+gRPC, OPA, Prometheus
 │   ├─ llm-gateway-go/       # Go adapters (OpenAI/Anthropic/Llama), guards
 │   ├─ rag-py/               # Python, chunking/embeddings API
 │   └─ admin-ui/             # Next.js dashboard
 ├─ core/
 │   └─ retrieval-rs/         # Rust vector engine, FFI to Go
 ├─ packages/
 │   ├─ policy/               # OPA bundles (.rego)
 │   ├─ dlp/                  # Presidio configs, NER models
 │   ├─ sdk-ts/               # Client TS SDK
 │   └─ sdk-py/               # Client Python SDK
 ├─ platform/
 │   ├─ helm/                 # charts: gateway, rag, vector, opa, vault, kafka
 │   ├─ terraform/            # multi-cloud: VPC, KMS, GKE/EKS/AKS
 │   └─ compose/              # local dev
 ├─ ops/
 │   ├─ runbooks/             # paging, outages, DR
 │   └─ slo/                  # SLI/SLO/SLA definitions
 └─ docs/
     ├─ api.md
     ├─ security.md
     ├─ architecture.md
     └─ rag-playbook.md
```

---

## 3) Component Specs (with Acceptance Criteria)

### 3.1 Gateway (Go)
**Responsibilities**
- AuthN (OIDC/mTLS), AuthZ (OPA), quotas & rate limits (Redis), request signing, tracing, audit fan‑out (Kafka), **/v1/query/secure**.  
- Latency budget (no‑RAG): p95 < 120ms; with cached RAG: p95 < 450ms.  
- Throughput: 25K RPS per instance (baseline), scale‑out N replicas.

**API: `POST /v1/query/secure`**
```json
{
  "tenant":"org:acme",
  "actor":"user:42",
  "purpose":"risk_analysis",
  "query":"transactions over 10000 last 30 days",
  "modes":["rag"],
  "fields":["amount","country","merchant"],
  "policy_check":true,
  "sensitivity":"auto"
}
```
**Response (must include)**
```json
{
  "correlation_id":"c-91b2",
  "status":"ok",
  "answer":"...",
  "citations":[{"namespace":"finance/txn","rows":128}],
  "risk":{"pii_leak":false,"policy":"allow"},
  "cost":{"tokens":682,"usd":0.0024}
}
```

**Policy check (OPA input)**
```json
{"tenant":"org:acme","actor":"user:42","purpose":"risk_analysis",
 "action":"rag.retrieve","fields":["transactions.amount","transactions.country"]}
```

**Prometheus**
- `gateway_requests_total{route,tenant}`  
- `gateway_latency_ms_bucket{route}`  
- `policy_denies_total{tenant,purpose}`  

**Runbook acceptance**
- Start/stop via systemd/k8s; hot‑reload config; feature flags (env‑driven).  
- SIGHUP triggers config reload, SIGTERM graceful shutdown (<5s).

---

### 3.2 LLM Gateway (Go)
**Responsibilities**
- Provider abstraction; enforce **no‑training/no‑retention**; prompt firewall; output scrubber; token & cost ceilings; retries with jitter.  
- Budget policy: per‑tenant `$` ceiling + RPS limiter.  
- Observability: tokens_in, tokens_out, cost_usd, timeouts, provider_errors.

**Contracts**
```yaml
provider: openai|anthropic|llama
no_training: true
no_retention: true
timeouts_ms: {connect: 800, total: 6000}
token_limits: {prompt_max: 4500, completion_max: 700}
cost_ceiling_usd_per_req: 0.05
rate_limit_rps_per_tenant: 5
```

---

### 3.3 RAG Service (Python)
**Responsibilities**
- Chunking (text/table), embedding, hybrid retrieval (BM25+vector), rerank, metadata filters, multilingual normalization.  
- Embedding models: `bge-m3` (self‑host) or `text-embedding-3-large`.  
- Sanitization before embedding: run DLP/tokenization.  
- Latency: p95 retrieval < 250ms @ 1M chunks (with tuned indexes).  

**Endpoints**
- `POST /v1/index` — upsert docs/rows.  
- `POST /v1/retrieve` — returns {chunks, scores, citations}.  
- `GET  /v1/health` — model ready, store ready.

---

### 3.4 Retrieval Core (Rust)
**Responsibilities**
- ANN/HNSW and cosine fallback; SIMD where possible; memory‑mapped vectors; **FFI** to Go.  
- Top‑k search with metadata masks (`tenant`, `namespace`, `sensitivity<=MEDIUM`).  
- QPS target: > 100K per node; memory limit & shard support.

**FFI surface**
```rust
#[repr(C)]
pub struct SearchResult { /* ptr, len, score */ }

#[no_mangle]
pub extern "C"
fn sdlc_search(query_ptr: *const f32, len: usize, k: usize,
               ns_ptr: *const u8, ns_len: usize) -> SearchResult;
```

---

### 3.5 Privacy & Crypto
- **DLP pipeline**: Regex → NER → LLM‑classifier; actions: mask / tokenize / block.  
- **Vault/KMS**: per‑tenant envelope keys; quarterly rotation; FPE for joins.  
- **Prove** redaction happened: attach `redaction_report` to audit event.

---

### 3.6 Policy (OPA)
- Purpose‑bound field allowlists, deny by default, row/column contexts.  
- Signed policy bundles, versioned by SHA; drift alarms if mismatch.

**Rego skeleton**
```rego
package sdlc.policy
default allow = false

allowed = {
  "risk_analysis": {"transactions.amount","transactions.country","customers.segment"}
}[input.purpose]

allow { input.action == "rag.retrieve"; every f in input.fields { f in allowed } }
```

---

### 3.7 Audit & Telemetry
- Kafka topics: `audit.events`, `gateway.metrics`, `retrieval.metrics`.  
- Immutable store: Postgres + signature (HMAC or Merkle).  
- OTEL traces: correlation_id spans across gateway→retriever→LLM.

---

### 3.8 Learning Engine (Autonomous Agents)
- **Policy Tuner** (Bandit/RL): propose allowlist changes based on safe stats.  
- **Retriever Optimizer** (Bayes): tune `chunk`, `k`, HNSW params.  
- **DLP Trainer** (Active Learning): refine detectors via false‑pos/neg feedback.  
- **Threat Simulator** (LLM): generate attack prompts, update rules.  
- **Cost Balancer**: route small queries to small models, big to big.

**Guardrail**: all changes go **shadow‑mode → A/B → promoted**; never override compliance baselines.

---

## 4) Prompts for AI‑Generated Components
Use these **exact prompts** in your code assistant (Cursor/Copilot/Claude/ChatGPT). Replace `<…>` values.

### 4.1 Generate Go Gateway
```
You are a senior Go backend engineer. Create a production-ready HTTP server in Go (Go 1.22):
- Framework: net/http + chi
- Endpoints: POST /v1/query/secure, GET /healthz
- Middleware: request id, tracing (otel), rate limiting (redis), auth (bearer or mTLS)
- Policy check: call OPA (URL in env OPA_URL) with JSON input {tenant, actor, purpose, action, fields}
- Kafka audit (topic audit.events), JSON payload includes correlation_id, decision, policy_sha, redaction_report
- Expose Prometheus metrics at /metrics
- Config via env + YAML (viper)
- Graceful shutdown (SIGTERM), timeouts, pprof in debug mode
- Return schema-compliant JSON response with answer/citations/risk/cost fields (stubs)
- Unit tests for policy allow/deny and rate limiter
```

### 4.2 Generate Rust Retrieval Core
```
You are a Rust systems engineer. Build a high-performance vector retrieval crate:
- Features: cosine similarity, optional HNSW (use hnsw_rs), memory-mapped store for embeddings
- API: top_k(&[f32], k: usize, filters: {tenant, namespace, sensitivity}) -> Vec<(DocId, score)>
- Provide C-compatible FFI (#[no_mangle]) to call from Go; include cbindgen config
- Benchmarks: 1M vectors synthetic, report p95 latency; SIMD via packed_simd or std::simd
- Unit tests verifying cosine properties and filtered retrieval
```

### 4.3 Generate Python RAG Service
```
You are a Python ML engineer. Implement a FastAPI service:
- /v1/index: accepts docs or rows; sanitize via Presidio; tokenize PII via Vault Transit client (stub)
- /v1/retrieve: hybrid search (BM25 + pgvector), merge + reciprocal rank fusion; return top-k chunks with citations
- Model: sentence-transformers bge-m3; lazy load; /health returns model and DB readiness
- Config: DATABASE_URL, VAULT_ADDR, EMBEDDING_DEVICE
- Tests: pytest for indexing and retrieval determinism, latency budget checks
```

### 4.4 Generate OPA Policies
```
You are an OPA policy author. Write rego to enforce purpose-based access:
- deny by default; map allowed fields per purpose; validate actor role from JWT claims
- add rule to block sensitivity level HIGH unless purpose == 'legal_hold'
- produce decision log with reason codes
```

### 4.5 Generate LLM Gateway (Go)
```
Create a Go service that wraps LLM providers:
- Supports OpenAI and Anthropic; chooses model by cost/latency; enforces no_training/no_retention headers
- Input firewall: strip attempt to bypass policies (regex for 'ignore', 'system override', 'sudo')
- Output scrubber: redact email, credit card, JWT
- Metrics: tokens_in/out, cost_usd, provider_error_total
- Configurable token ceilings and timeouts
```

### 4.6 Generate Next.js Admin UI
```
You are a Next.js engineer. Build a dashboard:
- Pages: /dash (RED/USE metrics), /audit/[id], /policies, /playground
- Fetch from gateway APIs; show correlation_id traces; dark theme with Tailwind + shadcn
- Add policy editor with PR flow (read-only commit suggestion JSON)
```

---

## 5) Data, Indices, Performance Tuning

### 5.1 pgvector (Postgres)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE vectors (
  id BIGSERIAL PRIMARY KEY,
  tenant TEXT NOT NULL,
  namespace TEXT NOT NULL,
  chunk TEXT NOT NULL,
  embedding VECTOR(1536),
  sensitivity TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists=1024);
CREATE INDEX ON vectors (tenant, namespace);
```

**Rules of thumb**
- `lists ≈ sqrt(N)`; tune `probes` by p95 latency.  
- Chunk size 512–800 tokens; overlap 10–15%.  
- Metadata‑first filters shrink search space.

### 5.2 Hybrid Retrieval
- BM25 via `pg_trgm` or external search (Meilisearch/ES) → RRF fusion.  
- Rerank top‑k using smaller local model if cost matters.

---

## 6) Security, Keys, and Compliance
- mTLS between all services; rotate certs (step‑ca or ACM/PCA).  
- Vault Transit for tokenization; FPE for joinable IDs.  
- LLM gateway: hard **no‑training/no‑retention** and budget ceilings.  
- Namespace isolation per tenant in vector store and caches.  
- Immutable audit w/ signature; SIEM export; GDPR DSAR endpoints.  
- **Redis**: use `PERSIST <key>` for permanent keys (TTL `-1`).

---

## 7) SLI/SLO/Alerting
- **Gateway p95** < 450ms (with RAG cached), error < 0.5%.  
- **Retriever p95** < 250ms @ 1M vectors.  
- **LLM timeout rate** < 1%.  
- Alerts on: policy drift, PII spikes, cost spikes, provider errors, index lag.

---

## 8) Deployment Blueprints

### 8.1 Docker Compose (local)
- Services: postgres+pgvector, redis, kafka, vault, opa, gateway, rag, llm-gateway, admin-ui.  
- `.env` with dev secrets; seed scripts for demo data.

### 8.2 Kubernetes (prod)
- Helm charts per service; HPA on CPU/QPS; PodDisruptionBudgets; NetworkPolicies.  
- Multi‑region: active‑active gateway; read‑replica vector DB; async audit replication.
- Backups: pgBackRest; Vault unseal; DR runbook.

### 8.3 Terraform
- VPC, subnets, NAT, SG/NSG, KMS keys, managed Postgres (RDS/CloudSQL), EKS/GKE/AKS.  
- DNS + certs; private ingress for internal tenants.

---

## 9) CI/CD & Supply Chain
- GitHub Actions: lint, test, sbom (Syft), image scan (Trivy), sign (cosign).  
- Provenance attestations (SLSA L3 target).  
- Canary deploy with feature flags; rollback on SLO breach.

---

## 10) Test Plans
- **Security**: prompt‑injection suite; PII detection FNR/FPR; policy bypass tests.  
- **Load**: k6 for gateway; criterion benches for Rust core; JMeter for retrieval.  
- **Chaos**: kill vector node; LLM provider outage; KMS latency; policy bundle mismatch.  
- **Compliance**: decision logs sampled; audit verifiable chain.

---

## 11) Runbooks
- **High latency**: check index probes, cache hit ratio, provider slowness → route to smaller model.  
- **Policy deny spike**: roll back last bundle; compare SHA; shadow‑mode diff.  
- **Cost spike**: enable stricter token ceilings; switch to distilled model.  
- **Data leak alert**: block namespace; rotate tenant keys; export audit forensics.

---

## 12) World‑Scale Roadmap
1. **MVP (8 weeks):** Go gateway, Python RAG, basic pgvector, OPA, Vault, LLM gateway, dashboard skeleton.  
2. **Scale (12–16 weeks):** Rust retrieval core, hybrid search, HPA, canary, A/B learning loop v1.  
3. **Enterprise (20–28 weeks):** Multi‑region active‑active, OEM SDK, compliance reports, SOC2/ISO.  
4. **Autonomy (30+ weeks):** Full agents with shadow→promote; policy explainability; self‑healing.

---

## 13) Copy‑Paste Snippets

**Go OPA check**
```go
func Allow(input PolicyInput) bool {
  body, _ := json.Marshal(map[string]any{"input": input})
  resp, err := http.Post(os.Getenv("OPA_URL"), "application/json", bytes.NewReader(body))
  if err != nil { return false }
  var out struct{ Result struct{ Allow bool `json:"allow"` } `json:"result"` }
  _ = json.NewDecoder(resp.Body).Decode(&out)
  return out.Result.Allow
}
```

**Rust cosine**
```rust
pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x,y)| x*y).sum();
    let na = a.iter().map(|x| x*x).sum::<f32>().sqrt();
    let nb = b.iter().map(|x| x*x).sum::<f32>().sqrt();
    dot / (na * nb + 1e-9)
}
```

**Python retrieve (fusion)**
```python
def rrf(bm25, vec, k=10, k_rrf=60):
    scores = defaultdict(float)
    for rank, doc in enumerate(bm25[:k]): scores[doc.id] += 1/(k_rrf+rank)
    for rank, doc in enumerate(vec[:k]):  scores[doc.id] += 1/(k_rrf+rank)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)
```

---

## 14) Founder Notes (Shachar’s Guidance to Teams)
- **Security beats features**: never skip redaction/tokenization gates.  
- **Measure everything**: make tradeoffs visible (latency/cost/accuracy).  
- **Automate learning**: shadow before promote; keep auditors in the loop.  
- **Portable by default**: no cloud lock‑in; pgvector baseline; switchable LLMs.  
- **Docs or it didn’t happen**: every decision logged; every SLO charted.

---

**EOF**