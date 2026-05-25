# Open-Source Tool Mapping — AMLIQ

## Stack Match (Go + React + FinTech SaaS)

### 1. Perfetto — Performance Tracing + SQL Analysis
- **Match**: Stack (Go) + Gap (no APM dashboard)
- **Why**: AMLIQ has internal pipeline metrics and tdigest percentile tracking but no visual APM. Perfetto provides SQL-queryable performance traces for the 6-layer screening cascade.
- **Integration point**: Instrument `engine.go` cascade timing, export traces for slow screenings (>50ms).
- **Effort**: Medium (2-3 days)
- **Impact**: High — visibility into production screening latency per layer

### 2. flakestress — Flaky Test Detection Under Stress
- **Match**: Stack (Go) + Gap (343 test files, no flake detection)
- **Why**: With 343 test files and table-driven tests, flaky tests can silently rot CI confidence. flakestress runs tests N times to surface intermittent failures.
- **Integration point**: Add `make test-flaky` target, run on critical screening and storage packages.
- **Effort**: Low (1-2 hours)
- **Impact**: High — protects CI reliability at scale

### 3. RuVector — Self-Learning Vector DB + Graph RAG
- **Match**: Domain (FinTech) + Feature (existing pgvector embeddings)
- **Why**: AMLIQ already uses pgvector for embedding similarity. RuVector adds hybrid search (vector + keyword + graph) and self-learning reranking that could improve false-positive reduction.
- **Integration point**: Supplement or replace `embedding.go` matcher; enhance `graph.go` with graph RAG patterns.
- **Effort**: High (1-2 weeks)
- **Impact**: High — directly improves core screening accuracy

### 4. Victory — Composable React Charts
- **Match**: Stack (React) + Existing (Recharts already present)
- **Why**: AMLIQ already uses Recharts. Victory offers more composable, accessible chart components with better animation support. Not a priority swap, but worth evaluating if Recharts hits limits.
- **Integration point**: Replace or supplement `web/src/components/charts/`
- **Effort**: Medium (3-5 days for migration)
- **Impact**: Low — Recharts is adequate for current needs

### 5. llamafile — Run LLMs as Single Executables
- **Match**: Stack (Go) + Feature (existing Anthropic Claude integration)
- **Why**: AMLIQ has `engine_llm.go` and `llm_cascade.go` for Claude-powered matching. llamafile enables offline/local LLM screening for air-gapped deployments or cost reduction on low-confidence matches.
- **Integration point**: Add as fallback in `llm_cascade.go` when Anthropic API is unavailable or for batch processing.
- **Effort**: Medium (3-5 days)
- **Impact**: Medium — enables offline/air-gapped compliance deployments

### 6. Tailscale — Zero-Config WireGuard Mesh VPN
- **Match**: Domain (FinTech) + Security
- **Why**: Multi-tenant AML platform handling PII and sanctions data. Tailscale provides zero-trust networking between API nodes, database, Redis, and worker services without managing VPN infrastructure.
- **Integration point**: Secure service-to-service communication in Render deployment.
- **Effort**: Low (1-2 days)
- **Impact**: Medium — hardens network security posture

### 7. Voicebox — Free Local TTS + Voice Cloning
- **Match**: Gap (no voice) + Accessibility
- **Why**: Compliance officers reviewing hundreds of alerts could benefit from voice readback of entity details, match explanations, and alert summaries. Also enables voice-driven screening for accessibility.
- **Integration point**: Add voice output option to alert detail and screening result pages.
- **Effort**: Medium (3-5 days)
- **Impact**: Low-Medium — accessibility improvement, differentiation feature

### 8. LLaMA-Mesh — Text-to-3D Mesh Generation
- **Match**: Gap (no 3D) + Marketing
- **Why**: 3D visualizations of entity relationship networks could be a powerful sales demo and compliance officer tool. Entity graphs currently exist only as data.
- **Integration point**: Generate 3D mesh visualizations of entity relationship clusters from `graph.go` output.
- **Effort**: High (1-2 weeks)
- **Impact**: Low — primarily marketing/demo value

## Match Summary

| Tool | Stack | Domain | Gap | Priority |
|------|-------|--------|-----|----------|
| Perfetto | Go | - | APM | **P1** |
| flakestress | Go | - | Test stability | **P1** |
| RuVector | - | FinTech | Search/accuracy | **P1** |
| llamafile | Go | - | Offline AI | **P2** |
| Tailscale | - | FinTech | Security | **P2** |
| Victory | React | - | Charts | **P3** |
| Voicebox | - | - | Voice/a11y | **P3** |
| LLaMA-Mesh | - | - | 3D viz | **P3** |
