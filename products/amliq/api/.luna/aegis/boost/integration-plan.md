# Integration Plan — AMLIQ Open-Source Boost

## Phase 1: Reliability & Observability (Week 1)

### 1.1 flakestress — Flaky Test Detection
**Goal**: Surface intermittent test failures in 343-file test suite

**Steps**:
1. `go install github.com/bradfitz/flakestress@latest`
2. Add Makefile target:
   ```makefile
   test-flaky:
       flakestress -n 50 ./internal/screening/...
       flakestress -n 50 ./internal/storage/pgx/...
       flakestress -n 30 ./api/...
   ```
3. Run against critical packages: screening, storage, api
4. Fix any flaky tests found (common: race conditions, time-dependent)
5. Add to CI as weekly scheduled job

**Files to modify**: `Makefile`, `.github/workflows/ci.yml`
**Risk**: None — read-only analysis tool

### 1.2 Perfetto — Performance Tracing
**Goal**: SQL-queryable traces for screening cascade latency

**Steps**:
1. Add Go tracing instrumentation to screening engine
2. Create `internal/tracing/perfetto.go` — trace span helpers
3. Instrument key paths:
   - `engine.go:Screen()` — full cascade timing
   - Each matcher layer (exact, fuzzy, phonetic, token, embedding, graph)
   - `engine_fast.go:ScreenFast()` — payment path timing
   - Database query latency in `storage/pgx/`
4. Export traces in Perfetto protobuf format
5. Add `/debug/trace` admin endpoint (auth-protected)
6. Create trace analysis SQL queries for common patterns:
   - P99 screening latency by matcher layer
   - Slow query identification
   - Cache hit rate correlation

**Files to create**: `internal/tracing/perfetto.go`, `internal/tracing/spans.go`
**Files to modify**: `internal/screening/engine.go`, `api/router.go`
**Risk**: Low — opt-in tracing, no impact when disabled

## Phase 2: Screening Accuracy (Week 2-3)

### 2.1 RuVector Patterns — Hybrid Search Enhancement
**Goal**: Improve false-positive reduction with hybrid search patterns

**Steps**:
1. Study RuVector's hybrid search architecture (vector + keyword + graph)
2. Adapt self-learning reranking pattern for screening results:
   - Track analyst dispositions (true positive / false positive)
   - Feed disposition data back into scoring weights
   - Auto-tune matcher weights per tenant based on historical accuracy
3. Implement in `internal/screening/`:
   - `adaptive_scorer.go` — learns from analyst feedback
   - `hybrid_search.go` — combines multiple search signals
4. Add A/B testing capability to compare old vs new scoring
5. Track precision/recall metrics per tenant

**Files to create**: `internal/screening/adaptive_scorer.go`, `internal/screening/hybrid_search.go`
**Files to modify**: `internal/screening/scorer.go`, `internal/screening/engine.go`
**Risk**: Medium — affects core screening accuracy, requires careful A/B testing

## Phase 3: Security & Resilience (Week 3-4)

### 3.1 Tailscale — Zero-Trust Networking
**Goal**: Secure service-to-service communication

**Steps**:
1. Set up Tailscale network for AMLIQ services
2. Configure API -> PostgreSQL connection over Tailscale
3. Configure API -> Redis connection over Tailscale
4. Configure API -> Worker communication over Tailscale
5. Update `render.yaml` with Tailscale sidecar containers
6. Remove public database endpoints
7. Add Tailscale ACLs for service-level access control

**Files to modify**: `render.yaml`, `deploy/docker/docker-compose.yml`
**Risk**: Medium — networking change requires careful rollout

### 3.2 llamafile — Offline LLM Screening
**Goal**: Enable air-gapped/offline LLM-powered screening

**Steps**:
1. Select small model (e.g., Mistral 7B) suitable for name matching
2. Create `internal/ai/llamafile.go` — OpenAI-compatible client pointing to local llamafile
3. Add configuration toggle: `LLM_PROVIDER=anthropic|llamafile|auto`
4. In `auto` mode: use llamafile for batch processing, Anthropic for real-time
5. Add llamafile as Docker service in compose for development
6. Benchmark accuracy: llamafile vs Anthropic on test corpus

**Files to create**: `internal/ai/llamafile.go`, `internal/ai/llamafile_test.go`
**Files to modify**: `internal/ai/provider.go`, `internal/config/config.go`
**Risk**: Medium — LLM quality variance, needs accuracy benchmarks

## Phase 4: Differentiation (Week 4+)

### 4.1 Voicebox — Voice Accessibility
**Goal**: Voice readback for compliance officers

**Steps**:
1. Add Voicebox as optional frontend dependency
2. Create `web/src/hooks/useVoice.ts` — TTS wrapper
3. Add "Read aloud" button to:
   - Alert detail page (entity name, match explanation, confidence)
   - Screening result summary
   - Case detail page
4. Support multiple languages (align with i18n)
5. Accessibility: keyboard shortcut (Alt+V) to toggle voice

**Files to create**: `web/src/hooks/useVoice.ts`, `web/src/components/VoiceButton.tsx`
**Risk**: None — additive feature, no existing functionality affected

## Priority Matrix

| Integration | Effort | Impact | Priority | Dependency |
|-------------|--------|--------|----------|------------|
| flakestress | 1-2h | High | **P1** | None |
| Perfetto tracing | 2-3d | High | **P1** | None |
| RuVector patterns | 1-2w | High | **P1** | Perfetto (for measurement) |
| Tailscale | 1-2d | Medium | **P2** | None |
| llamafile | 3-5d | Medium | **P2** | None |
| Voicebox | 3-5d | Low-Med | **P3** | None |
| Victory | 3-5d | Low | **P3** | None |
| LLaMA-Mesh | 1-2w | Low | **P3** | None |
