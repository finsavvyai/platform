# Tool Mapping — amliq-frontend

**Date:** 2026-04-21

## Applied Matching: FinTech SaaS + TypeScript/React + Gaps

### HIGH PRIORITY

#### 1. RuVector — Hybrid Search + Graph RAG
**Why:** AML screening = entity lookup at scale. RuVector's hybrid search (vector + keyword) + graph RAG maps directly onto PEP/sanctions entity matching, adverse media clustering, and case similarity search.
**Gap filled:** No search / no AI-assisted triage.
**Effort:** Medium. Expose RuVector as a sidecar; wire into screening API.

#### 2. Perfetto — Performance Tracing
**Why:** Compliance dashboards load heavy datasets (batch screening results, transaction logs). No perf monitoring exists. Perfetto's SQL-queryable trace format lets you profile render bottlenecks and API latency.
**Gap filled:** No performance monitoring.
**Effort:** Low. Integrate perfetto-ui or use `trace_processor` on CI runs.

#### 3. flakestress — Flaky Test Detection
**Why:** 50 test files + Playwright E2E = meaningful flakiness risk. flakestress stress-tests under parallel load to surface ordering-dependent or timing-sensitive failures before they hit CI.
**Gap filled:** Test reliability.
**Effort:** Very low. One CLI addition to CI pipeline.

#### 4. any-llm — Unified LLM SDK for AI Triage
**Why:** Alert triage and adverse media summarization are obvious AI wins. `any-llm` gives a provider-agnostic Python layer — wire to a backend service that summarizes articles or scores entity risk.
**Gap filled:** No AI features.
**Effort:** Medium. Requires a thin backend proxy; frontend gets summary payloads.

### MEDIUM PRIORITY

#### 5. Voicebox — Voice Input for Case Notes
**Why:** Compliance analysts log notes constantly. Local TTS + speech-to-text (23 languages) enables hands-free case annotation without sending audio to third parties — important in regulated environments.
**Gap filled:** No voice.
**Effort:** Medium. Wrap Voicebox in a React hook; attach to case note textarea.

#### 6. Inbox Zero patterns — Alert Queue Intelligence
**Why:** Alert queue UX maps to email triage. Inbox Zero's AI categorization patterns (batch label, archive, priority) can inform a "smart sort" layer on the alert queue.
**Gap filled:** AI-assisted triage workflow.
**Effort:** Medium. Architectural pattern adoption, not direct library import.

### LOW PRIORITY / FUTURE

#### 7. Agent of Empires — Parallel Screening Agents
**Why:** Batch screening jobs could run as parallel git-worktree agents. Useful when screening thousands of entities across multiple lists simultaneously.
**Gap filled:** Parallelism for batch jobs.
**Effort:** High. Requires backend rearchitecture.

#### 8. llamafile — Offline AI (Air-gapped Compliance)
**Why:** Some compliance environments are air-gapped or restrict external API calls. llamafile bundles an LLM as a single executable — no cloud dependency.
**Gap filled:** Offline AI.
**Effort:** High. Ops + infra work.

### NOT APPLICABLE

| Tool | Why not |
|------|---------|
| LLaMA-Mesh / 3DGRUT | No 3D use case |
| nanoGPT / llm.c | No model training |
| Tailscale | Infrastructure concern, not frontend |
| KarpathyTalk | Social platform, not relevant |
| GitNexus | Repo analytics, not product feature |
| Victory | Already have Recharts |
