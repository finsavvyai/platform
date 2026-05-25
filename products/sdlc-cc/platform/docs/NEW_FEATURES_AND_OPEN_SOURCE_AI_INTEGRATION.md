# Adding New Features & Integrating Open-Source AI (OpenHands, OpenClaw, Others)

**Purpose:** How to add new product features and integrate open-source AI platforms (OpenHands, OpenClaw, and others) into the SDLC platform while keeping compliance and architecture consistent.

**See also:** [VISION.md](./VISION.md), [SPRINTS_PLAN.md](./SPRINTS_PLAN.md), [docs/architecture](./architecture).

---

## 1. How New Features Are Added Today

### 1.1 Extension Points in the Platform

| Layer | Where | How to extend |
|-------|--------|----------------|
| **LLM providers** | `services/llm-gateway` | Implement `Provider` interface; add case in `Factory.NewProvider()` / `AddProvider()`; add config in `config.yaml`. |
| **Gateway routes** | `services/gateway` | Add route group in `main.go` or `routes.go`; add handler; optional OPA policy. |
| **OpenClaw** | `services/gateway/cmd/server/openclaw.go` | Discovery reads filesystem (`OPENCLAW_ROOT`); `/api/v1/openclaw/health`, `/api/v1/openclaw/capabilities`. |
| **Memory (OpenClaw-compatible)** | `services/gateway/internal/domain/services/agentmemory.go` | `MemoryStore` + `VectorSearcher` + `BM25Searcher`; exposed via `RegisterMemoryRoutes`. |
| **LAM agents** | `services/agents/*.js` | New agent file extending `base-agent.js`; register in LAM core; add to dashboard. |
| **RAG** | `services/rag` | LLM/embedding providers in config; storage backends; DLP in pipeline. |
| **DLP** | `services/dlp`, `packages/dlp` | New detector/redactor; register in scan pipeline. |
| **Proxy** | `services/proxy-worker` | Add provider passthrough (e.g. new upstream URL + auth). |

### 1.2 Adding a New LLM Provider (e.g. Ollama, LocalAI)

1. **LLM Gateway**  
   - In `services/llm-gateway/internal/llm/providers/`: add `ollama.go` (or similar) implementing `Provider`.  
   - In `factory.go`: add `case "ollama": return NewOllamaProvider(config, f.logger)`.  
   - In `config.yaml`: add `providers.ollama` with `base_url`, `models`, etc.  
   - Keep existing interface: `Complete`, `StreamCompletion`, `Health`, `GetModelInfo`, token/cost.

2. **Proxy Worker**  
   - If traffic goes through the proxy: add route/upstream for the new provider (e.g. `api.openhands.dev` or local Ollama) and apply the same PII/audit pipeline.

3. **Compliance**  
   - Run all new provider paths through DLP and audit; no bypass.

### 1.3 Adding a New LAM Agent

1. In `services/agents/`: create e.g. `incident-responder.js` extending `base-agent.js`.  
2. Implement the agent contract (process request, return structured result).  
3. Register in `services/lam-system.js` (or equivalent) and wire config.  
4. Add metrics/dashboard in LAM monitoring.

### 1.4 Adding a New Gateway Feature (e.g. New API Surface)

1. Add handler in `services/gateway` (Go) or a Worker.  
2. Register route under `/api/v1/...`.  
3. Add auth/OPA if needed; add audit logging for sensitive operations.  
4. Document in API docs and SDKs if public.

---

## 2. OpenClaw Integration (Current & How to Deepen)

### 2.1 What’s Already There

- **Discovery:** `services/gateway/cmd/server/openclaw.go` discovers capabilities from a local OpenClaw install:
  - `OPENCLAW_ROOT` or `~/openclaw/openclaw`
  - Scans `docs/channels`, `docs/nodes`, `extensions/`, `skills/` (with `SKILL.md`)
  - Endpoints: `GET /api/v1/openclaw/health`, `GET /api/v1/openclaw/capabilities`
- **Memory:** OpenClaw-compatible agent memory in the gateway:
  - `MemoryEntry`, `MemoryStore`, vector + BM25 search
  - Routes registered via `handlers.RegisterMemoryRoutes(r)` under `/api/v1/...`
- **Landing:** `landing-page/components/OpenClawCapabilities.tsx` shows channels, nodes, extensions, skills (static list; can be switched to live API later).

### 2.2 How to Deepen OpenClaw Integration

| Goal | Approach |
|------|----------|
| **Live capabilities** | Call Gateway `GET /api/v1/openclaw/capabilities` from the landing page (or Admin UI) when `OPENCLAW_ROOT` is set in the deployed environment. |
| **Run OpenClaw behind SDLC** | Route OpenClaw’s LLM calls through the SDLC proxy so all traffic gets PII redaction, audit, and policy. Configure OpenClaw to use SDLC proxy URL as base URL. |
| **Shared memory** | Use the gateway’s OpenClaw-compatible memory APIs from OpenClaw agents (or from a small adapter) so memory is centralized and auditable. |
| **New channels/nodes** | No code change for discovery: add them in the OpenClaw filesystem; discovery will pick them up. Optionally surface in Admin UI. |
| **Skills as LAM inputs** | Map OpenClaw skills to LAM “capabilities” or use skill metadata to drive policy/routing in the gateway. |

---

## 3. OpenHands Integration

### 3.1 What OpenHands Is

- **OpenHands** (e.g. [openhands.dev](https://openhands.dev), GitHub: All-Hands-AI/OpenHands): open-source AI coding agents (SDK, CLI, local GUI, cloud).  
- Model-agnostic (Claude, GPT, etc.); Python/TypeScript; MIT; supports local and cloud.

### 3.2 Integration Options

| Option | Description | Effort | Compliance |
|--------|-------------|--------|------------|
| **A. Proxy LLM traffic** | Run OpenHands agents; point their LLM base URL to the SDLC proxy. All prompts/responses go through DLP + audit. | Low | High: same as other clients. |
| **B. OpenHands as LAM “agent”** | Wrap OpenHands SDK (or CLI) in a LAM agent; LAM handles routing, risk, policy; OpenHands runs the coding task. | Medium | High: controlled by LAM. |
| **C. Gateway API for OpenHands** | Expose a small “agent job” API on the gateway: create job, poll status, get result. OpenHands (or another runner) executes; gateway enforces auth, quotas, audit. | Medium | High: central policy. |
| **D. OpenHands in Admin UI** | Embed or link to OpenHands local GUI; ensure it uses SDLC proxy for LLM. | Low | Depends on config. |

**Recommended starting point:** **A** (proxy) + **B** (optional LAM wrapper for high-value workflows). Use the existing LLM Gateway and proxy-worker; add OpenHands as a documented client and, if needed, a LAM agent that invokes OpenHands.

### 3.3 Concrete Steps for OpenHands + SDLC

1. **Document** in developer docs: “Use SDLC proxy as your LLM base URL” (OpenHands supports custom endpoints).  
2. **Config example:** Set OpenHands env/config to `https://api.sdlc.cc/v1` (or your proxy URL) with API key from the dashboard.  
3. **Optional:** In `services/agents/`: add `openhands-runner.js` that calls OpenHands SDK/CLI with a task; LAM passes context and gets back result; audit via LAM + gateway.  
4. **Optional:** Add “OpenHands” to the landing or docs as a supported client (like OpenClaw).

---

## 4. Other Open-Source AI (Ollama, LocalAI, LangChain, etc.)

| Project | Integration point | Notes |
|---------|-------------------|--------|
| **Ollama** | LLM Gateway provider | Add Ollama provider in llm-gateway (often local `http://localhost:11434`); proxy can forward to it with DLP. |
| **LocalAI** | LLM Gateway provider | Same pattern: new provider + config; optional proxy upstream. |
| **LangChain / LangGraph** | Client of SDLC | Use SDLC proxy as the LLM endpoint in LangChain; no change in gateway except docs. |
| **Open source coding agents** (e.g. Cursor-style, Aider) | Proxy + optional LAM | Same as OpenHands: proxy LLM; optionally wrap in LAM for policy and audit. |
| **Embedding models** (sentence-transformers, etc.) | RAG / embedding service | Add embedding provider in `services/embedding` or RAG config; use for RAG/LAM memory. |

**Rule:** Any new LLM or agent runtime that sends prompts/completions should go through the same compliance path: DLP, audit, policy (Gateway/OPA), and optional LAM oversight.

---

## 5. Checklist for New Features & Integrations

- [ ] **Ownership:** Which product in [SPRINTS_PLAN.md](./SPRINTS_PLAN.md) owns it (Gateway, RAG, LAM, Proxy, etc.)?  
- [ ] **Interface:** Use existing interfaces (Provider, MemoryStore, LAM agent, route group) where possible.  
- [ ] **Compliance:** New LLM/agent traffic → proxy or gateway → DLP + audit; no unlogged sensitive paths.  
- [ ] **Config:** Feature flags or env (e.g. `OPENCLAW_ROOT`, `OPENHANDS_LLM_URL`); document in README or config schema.  
- [ ] **Tests:** Unit + integration for new provider/agent/route; coverage rules per [CLAUDE.md](../CLAUDE.md).  
- [ ] **Docs:** Update API docs, SDK examples, and “Supported clients” (OpenClaw, OpenHands, etc.) where relevant.  
- [ ] **Security:** No new Critical/High; SAST and dependency scan; least privilege for new credentials.

---

## 6. Summary

| Integration | Current state | Next steps |
|-------------|----------------|-----------|
| **OpenClaw** | Discovery + memory APIs + landing section | Live capabilities from API; route OpenClaw LLM via proxy; optional Admin UI. |
| **OpenHands** | [docs/integrations/OpenHands.md](./integrations/OpenHands.md) | Use SDLC proxy as LLM URL; optional LAM agent wrapper. |
| **Other OSS AI** | LLM Gateway has OpenAI/Anthropic; proxy generic | Add providers (Ollama, LocalAI) in llm-gateway; use proxy for all clients; document. |

New features should plug into the existing extension points (LLM Factory, gateway routes, LAM agents, memory, proxy) and keep a single, auditable path for sensitive data.

---

*Last updated: February 2026.*
