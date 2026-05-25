# OpenSyber — Tool Mapping

**Generated**: 2026-04-08

## Matched Tools (by priority)

### 1. Victory — Composable React Charts
**Match**: 95% | **Gap**: No data visualization library
**Why**: OpenSyber's dashboard (43 page directories, 165 components) lacks a charting library. Security posture dashboards need:
- Time-series charts for threat trends, alert volumes, compliance scores
- Pie/donut charts for finding severity distribution
- Bar charts for skill usage, marketplace revenue
- Area charts for agent health metrics over time

**Integration Points**:
- `apps/web/src/app/dashboard/` — Main metrics dashboard
- `apps/web/src/app/admin/` — Admin analytics
- `apps/web/src/app/marketplace/` — Skill usage stats
- `apps/web/src/components/` — Reusable chart components in `packages/ui`

**Effort**: ~4 hours | **Impact**: High (visual UX upgrade for launch)

---

### 2. RuVector — Self-Learning Vector DB + Graph RAG
**Match**: 85% | **Gap**: No semantic search
**Why**: OpenSyber has 24 skills, 103 DB tables of security findings, and threat intelligence data. Current search is SQL-based. Vector search enables:
- Semantic skill discovery ("find skills that detect lateral movement")
- Similar-finding clustering (group related CVEs)
- Natural language threat queries via Claw Gateway
- Graph RAG for attack path analysis (already has attack-paths service)

**Integration Points**:
- `apps/api/src/routes/skill-recommendations.ts` — Replace keyword matching
- `apps/api/src/services/attack-paths/` — Graph-based retrieval
- `apps/api/src/routes/ai-query.ts` — Semantic search backend
- `skills/ai-threat-intel/` — Enrichment with vector similarity

**Effort**: ~8 hours | **Impact**: High (differentiated search UX)

---

### 3. Perfetto — Performance Tracing + SQL Analysis
**Match**: 80% | **Gap**: No structured APM
**Why**: OpenSyber runs 8 CF Workers + agent daemons with custom monitors (`apps/agent/src/monitors/`). Perfetto adds:
- Structured trace collection for AI skill execution latency
- SQL-based trace querying (find slow API routes)
- Flame charts for claw-gateway LLM proxy timing
- Dashboard integration for ops monitoring

**Integration Points**:
- `apps/claw-gateway/src/services/llm-proxy.ts` — Trace LLM call timing
- `apps/api/src/middleware/` — Request lifecycle tracing
- `apps/agent/src/monitors/` — Export to Perfetto format
- `apps/web/src/app/admin/` — Embed trace viewer

**Effort**: ~6 hours | **Impact**: Medium-High (ops visibility)

---

### 4. flakestress — Flaky Test Detection Under Stress
**Match**: 75% | **Gap**: No flaky test analysis
**Why**: 538 test files across the monorepo. Before Product Hunt launch, you need confidence that CI won't randomly fail. flakestress runs each test N times to surface intermittent failures.

**Integration Points**:
- `vitest.config.ts` (root + per-package)
- CI pipeline (GitHub Actions)
- Focus areas: D1 database tests, Durable Object tests, auth middleware tests

**Effort**: ~2 hours | **Impact**: Medium (CI reliability)

---

### 5. Tailscale — Zero-Config WireGuard Mesh VPN
**Match**: 70% | **Gap**: Agent-platform secure networking
**Why**: OpenSyber agents run on Hetzner VMs communicating via X-Gateway-Token over public internet. Tailscale provides:
- Encrypted mesh between agent VMs and CF Workers
- Zero-config NAT traversal (no port forwarding)
- ACL-based access control per agent instance
- MagicDNS for agent discovery

**Integration Points**:
- `apps/agent/src/` — Agent daemon networking
- `apps/api/src/routes/gateway.ts` — Gateway token verification over Tailscale
- Enterprise tier — private mesh for customer-dedicated agents

**Effort**: ~4 hours | **Impact**: Medium (security + enterprise feature)

---

### 6. llamafile — Offline AI Inference
**Match**: 60% | **Gap**: No offline/air-gapped AI
**Why**: Enterprise/government customers may need air-gapped AI agent operation. llamafile bundles LLM as single executable.

**Integration Points**:
- `apps/agent/src/` — Local inference fallback when Claw Gateway unreachable
- `skills/shared/llm.js` — Add llamafile as provider option
- `packages/claw-sdk/src/providers.ts` — Add local provider

**Effort**: ~6 hours | **Impact**: Medium (enterprise differentiator)

---

### 7. Agent of Empires — Parallel AI Agents with Git Worktrees
**Match**: 50% | **Gap**: Reference architecture for multi-agent orchestration
**Why**: OpenSyber's skill execution could benefit from parallel agent patterns for:
- Running multiple AI skills simultaneously on a finding
- Consensus-based triage (multiple AI models vote on severity)
- Parallel remediation validation

**Integration Points**:
- `apps/api/src/routes/ai-triage.ts` — Multi-model consensus
- `skills/` — Parallel skill execution framework
- `apps/agent/src/skills/` — Skill runtime orchestration

**Effort**: ~8 hours | **Impact**: Low-Medium (architecture improvement)

---

### 8. LLaMA-Mesh — Text-to-3D Mesh Generation
**Match**: 40% | **Gap**: No 3D visualization
**Why**: Attack graph visualization currently 2D. 3D network topology could differentiate:
- 3D attack path visualization
- Infrastructure topology explorer
- Marketing hero asset generation

**Integration Points**:
- `apps/web/src/app/dashboard/` — 3D attack graph widget
- Marketing site — 3D hero visuals

**Effort**: ~12 hours | **Impact**: Low (nice-to-have visual)

## Tools NOT Matched

| Tool | Reason for Exclusion |
|------|---------------------|
| any-llm | Claw Gateway already abstracts multi-provider LLM |
| nanoGPT / llm.c | Training not needed — OpenSyber consumes LLMs, doesn't train |
| 3DGRUT / PPISP | Ray tracing/camera correction not relevant |
| Voicebox | Already integrated as a skill (skills/voice-synthesis/) |
| Spacedrive | Desktop patterns not applicable (web-first platform) |
| KarpathyTalk | Social platform patterns not relevant |
| Inbox Zero | Email management not in scope |
| Dossier | Planning patterns — project already has robust planning |
