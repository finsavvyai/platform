# Open Source Leverage Reference — LunaOS Platform

Scanned repositories, what they offer, and how LunaOS products can adopt their best patterns.

---

## Repo Reference Sheets

### ruflo (ruvnet/ruflo)
**Stars**: 30.6K | **Lang**: TypeScript/WASM/Rust | **License**: MIT
Self-learning AI agent orchestration with 100+ agent types, WASM booster, Byzantine consensus.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| SONA self-learning | Agents adapt routing from past success | Engine (Claw Gateway) | P1 |
| WASM Agent Booster | Skip LLM for simple transforms, <1ms | Engine + CLI | P1 |
| ReasoningBank | Cache successful prompt/response pairs | Engine (KV) | P1 |
| Queen-led swarms | Strategic/Tactical/Adaptive coordination | CLI (/swarm) | P2 |
| Byzantine consensus | 2/3 fault-tolerant decisions | CLI (/multi-agent) | P2 |
| Background workers | 12 auto-dispatch worker types | Engine (cron) | P3 |
| Token optimizer | 30-50% cost reduction | Claw Gateway | P1 |

### flow-nexus (ruvnet/flow-nexus)
**Stars**: 84 | **Lang**: TypeScript | **License**: MIT
Competitive agentic platform on MCP with gamification and credit economy.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Credit economy | Earn/spend credits for platform usage | Dashboard | P2 |
| Challenge arena | Timed coding competitions + AI judge | Dashboard | P3 |
| Achievement system | Badges, tiers, progression | Dashboard | P3 |
| Skill marketplace | Publish/install with royalties | CLI + Dashboard | P2 |
| Sandbox environments | Sub-second isolated containers | Studio | P3 |

### Dossier (ruvnet/Dossier)
**Stars**: 31 | **Lang**: TypeScript (Next.js) | **License**: MIT
Visual planning and context control for AI coding.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Product map | Hierarchical Product → Workflow → Feature | Studio | P1 |
| Context packages | Only send relevant code to agents | Engine | P1 |
| Per-card approval | Review before agent execution | Studio | P2 |
| Repo mapping | Auto-infer features from codebase | CLI (/product-map) | P2 |
| E2E test generation | Auto-generate from feature specs | CLI (/test) | P2 |

### RuVector (ruvnet/RuVector)
**Stars**: 3.7K | **Lang**: Rust | **License**: MIT
Self-learning vector DB with GNN, hybrid search, graph RAG.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Self-learning HNSW | Index improves from every query | Engine (RAG) | P1 |
| Hybrid search | Sparse + dense fusion (20-49% better) | Engine (RAG) | P1 |
| Graph RAG | Knowledge graph + community detection | Engine (RAG) | P2 |
| Local LLM (ruvllm) | GGUF model inference, no cloud | CLI (--local) | P2 |
| WASM 5.5KB | Vector search in browser | Studio | P3 |

### Voicebox (jamiepine/voicebox)
**Stars**: New | **Lang**: Rust (Tauri) + Python (FastAPI) | **License**: MIT
Open-source ElevenLabs alternative. Local TTS + voice cloning.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Local TTS | Free voice synthesis, REST API | CLI (/voice, /record) | P1 |
| Voice cloning | Clone voices from audio samples | CLI (/record) | P2 |
| 23 languages | Multi-language narration | CLI (/flow-record) | P2 |

### llamafile (mozilla-ai/llamafile)
**Stars**: High | **Lang**: C/C++ | **License**: Apache-2.0
Run LLMs as single executables. No install, offline.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Single-file LLM | Download and run, no deps | CLI (--local) | P1 |
| OpenAI-compat API | localhost:8080 drop-in | Claw Gateway fallback | P1 |
| Offline mode | No internet required | CLI | P2 |

### Perfetto (google/perfetto)
**Stars**: High | **Lang**: C++ | **License**: Apache-2.0
Performance tracing with SQL analysis and web UI.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Chrome traces | Capture during browser tests | CLI (/perf-trace) | P2 |
| SQL analysis | Query traces programmatically | CLI | P3 |
| Web UI | Timeline visualization | Dashboard | P3 |

### Inbox Zero (elie222/inbox-zero)
**Stars**: High | **Lang**: TypeScript (Next.js) | **License**: AGPL
AI email management — categorize, unsubscribe, draft replies.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Email triage | AI-categorize inbox | CLI (/inbox) | P2 |
| Bulk unsubscribe | One-click newsletter cleanup | CLI (/inbox) | P2 |
| Meeting briefs | Prep from calendar + threads | CLI (/inbox) | P3 |

### Agent of Empires (njbrake/agent-of-empires)
**Stars**: New | **Lang**: Rust | **License**: MIT
Parallel AI agent runner with tmux + git worktrees.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Git worktree isolation | Each agent on own branch | CLI (/multi-agent) | P2 |
| tmux sessions | Persistent background agents | CLI | P3 |

### Victory (FormidableLabs/victory)
**Stars**: High | **Lang**: TypeScript (React) | **License**: MIT
Composable React charting components.

| Feature | Description | LunaOS Product | Priority |
|---------|-------------|---------------|----------|
| Chart components | Analytics dashboards | Dashboard | P2 |
| Composable API | Reusable across views | Studio | P3 |

---

## Integration Plan by LunaOS Product

### Engine (api.lunaos.ai)
1. **WASM Agent Booster** → Add to execute route, skip LLM for simple transforms
2. **ReasoningBank** → KV cache for prompt/response pairs, check before LLM call
3. **Smart routing** → Track success rates in D1, route to cheapest viable model
4. **Context packages** → Analyze task, send only relevant files (not full codebase)
5. **Hybrid search** → Upgrade RAG to sparse+dense fusion
6. **Self-learning HNSW** → Track query→result quality, adjust index weights
7. **Multi-provider failover** → Add Gemini, Cohere, Ollama to Claw Gateway
8. **Token optimizer** → Cache + route + batch = 30-50% savings

### Studio (studio.lunaos.ai)
1. **Product map view** → Hierarchical planning (Dossier pattern) alongside ReactFlow
2. **Per-feature context** → Select which files/docs each workflow node accesses
3. **Approval workflow** → Review agent output before applying
4. **WASM vector search** → Client-side RAG in the canvas (RuVector 5.5KB)
5. **Victory charts** → Analytics panel in Studio

### Dashboard (agents.lunaos.ai)
1. **Credit system** → Track usage, earn credits for contributions
2. **Achievement badges** → Milestones (first deploy, 100 runs, etc.)
3. **Inbox integration** → Email management panel
4. **Analytics charts** → Victory-based execution visualizations
5. **Marketplace** → Browse/install/publish skills

### CLI (luna-agents-cli)
1. **--local flag** → Route through llamafile instead of Claw Gateway
2. **Voicebox integration** → Free local TTS for /record and /flow-record
3. **Git worktree agents** → Isolated parallel development
4. **Background workers** → Auto-dispatch on file changes

### CodeRailFlow (flow.coderail.dev)
1. **Voicebox narration** → Free TTS for flow recordings
2. **Perfetto profiling** → Capture performance traces during flows
3. **Credit system** → Gamified flow creation
4. **Graph RAG** → Smart element selection using code knowledge graph
