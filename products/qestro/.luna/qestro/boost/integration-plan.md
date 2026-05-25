# Qestro — Open-Source Integration Plan

**Date**: 2026-04-10

---

## Phase 1: Testing Infrastructure (flakestress + Perfetto)

### 1.1 Integrate flakestress Methodology
**Tool**: https://github.com/bradfitz/flakestress
**Effort**: 4 hours

Qestro already has `FlakyDetector.ts` with heuristic analysis. Enhance it with flakestress's stress-test methodology:

**Steps**:
1. Add stress-run mode to test execution: run each test N times (configurable, default 10)
2. Capture per-run timing, pass/fail, and error message
3. Calculate flakiness score: `failures / total_runs * 100`
4. Classify: deterministic-fail vs timing-dependent vs environment-dependent
5. Feed results into the Analytics dashboard's "Flaky Tests" card (currently mock data)
6. Add "Stress Test" button to individual test cards

**Files to modify**:
- `backend/src/services/test-intelligence/FlakyDetector.ts` — add stress methodology
- `backend/src/routes/test-runs.ts` — add `/api/runs/:id/stress` endpoint
- `frontend/src/pages/AnalyticsDashboard.tsx` — wire flaky card to real data

---

### 1.2 Add Perfetto Performance Tracing
**Tool**: https://github.com/google/perfetto
**Effort**: 6 hours

Instrument the test execution pipeline with trace points:

**Steps**:
1. Create `backend/src/lib/tracing.ts` — Perfetto trace writer (JSON format)
2. Instrument: `PlaywrightRunnerService` (browser launch, navigation, action, screenshot)
3. Instrument: `SelfHealingEngine` (failure analysis, suggestion generation)
4. Instrument: `AIProviderClient` (LLM call latency, token usage)
5. Export trace files to `/api/runs/:id/trace` endpoint
6. Frontend: Link to Perfetto UI viewer (`ui.perfetto.dev` opens trace files)

**Files to create**:
- `backend/src/lib/tracing.ts` — trace writer
- `backend/src/routes/trace.routes.ts` — trace file endpoints

---

## Phase 2: AI Enhancement (llamafile + Agent of Empires)

### 2.1 Add llamafile as Local AI Fallback
**Tool**: https://github.com/mozilla-ai/llamafile
**Effort**: 4 hours

Enable offline AI test generation without API keys:

**Steps**:
1. Download a small model llamafile (e.g., TinyLlama 1.1B, ~700MB)
2. llamafile exposes OpenAI-compatible API at `http://localhost:8080/v1`
3. Add `LOCAL_LLM_URL` env var to `AIProviderClient`
4. Add to failover chain: Cloud providers → Claw Gateway → llamafile (local)
5. Document: "Run `./tinyllama.llamafile` for offline test generation"

**Files to modify**:
- `backend/src/services/AIProviderClient.ts` — add local LLM fallback
- `.env.example` — add `LOCAL_LLM_URL=http://localhost:8080/v1`

---

### 2.2 Parallel Test Generation (Agent of Empires Pattern)
**Tool**: https://github.com/njbrake/agent-of-empires
**Effort**: 8 hours

Apply parallel agent pattern to batch test generation:

**Steps**:
1. When user requests tests for multiple pages, spawn N parallel generation workers
2. Each worker generates tests independently (no shared state)
3. Collect results, deduplicate, merge into test suite
4. Uses existing Bull queue — one job per page/component
5. Frontend shows parallel progress bars

**Files to modify**:
- `backend/src/services/QestroAIBridgeService.ts` — add batch generation mode
- `backend/src/workers/aiProcessor.ts` — handle parallel jobs
- `frontend/src/components/ai/AITestGenerator.tsx` — show parallel progress

---

## Phase 3: Intelligence (RuVector)

### 3.1 Failure Similarity Search
**Tool**: https://github.com/ruvnet/RuVector
**Effort**: 6 hours

Index historical test failures as vectors for similarity search:

**Steps**:
1. Embed failure messages + stack traces using a small model
2. Store embeddings in RuVector (can run in-process, no external DB)
3. When a test fails, query for similar past failures
4. Show "Similar failures and how they were resolved" in the self-healing UI
5. Feed similarity data back into the self-learning outcome tracker

**Files to create**:
- `backend/src/lib/failure-index.ts` — vector index for failures
- Wire into `SelfHealingEngine.ts` for similarity queries

---

## Phase 4: Polish (Victory + Voicebox)

### 4.1 Interactive Test Timeline Charts
**Tool**: https://github.com/FormidableLabs/victory
**Effort**: 3 hours per chart

Replace static Recharts with interactive Victory charts for:
- Test execution timeline (brush to zoom, click for details)
- Flakiness trend over time (animated transitions)
- Pass/fail distribution (interactive pie/donut)

### 4.2 Voice Test Reports
**Tool**: https://github.com/jamiepine/voicebox
**Effort**: 4 hours

Generate spoken test summaries:
- "Your nightly regression suite completed. 42 passed, 3 failed, 2 self-healed."
- Attach as audio to Slack/Discord notifications via OpenClaw bridge
- Enable via user preference toggle in Settings

---

## Priority Matrix

```
         HIGH IMPACT
              |
 flakestress  ●     Perfetto ●
    [4h]      |        [6h]
              |
  llamafile ● |    AgentOfEmpires ●
    [4h]      |        [8h]
              |
 LOW EFFORT ──┼────────────────── HIGH EFFORT
              |
  ruflo ●     |     RuVector ●
   [2h]       |       [6h]
              |
  Victory ●   |    Voicebox ●
   [3h]       |      [4h]
              |
         LOW IMPACT
```

## Execution Order

| Sprint | Tools | Effort | Cumulative Value |
|--------|-------|--------|-----------------|
| This week | flakestress + llamafile | 8h | Real flaky detection + offline AI |
| Next week | Perfetto | 6h | Performance traces on test runs |
| Sprint 3 | Agent of Empires pattern | 8h | Parallel test generation |
| Sprint 4 | RuVector + Victory | 9h | Failure search + interactive charts |
| Sprint 5 | Voicebox + ruflo patterns | 6h | Voice reports + self-learning |

**Total**: ~37 hours across 5 sprints
