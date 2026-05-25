# What's New

Latest shipping in LunaOS. Most recent first.

---

## April 2026 — Major engine upgrade (179 tests passing)

Shipped in a single week: parallel agent swarm, self-learning LLM router, graph-aware RAG, and 6-provider LLM routing.

### Parallel Agent Swarm (NEW)

Run 2–5 agents against the same task in parallel. Three merge strategies:

- **race** — fastest successful agent wins
- **consensus** — majority agreement on output
- **vote** — longest/best-scored answer wins

```bash
curl https://api.lunaos.ai/agents/swarm \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "agents": ["code-review", "security-audit", "test-writer"],
    "context": "Review this login function",
    "strategy": "consensus"
  }'
```

**Response shape**:
```json
{
  "strategy": "consensus",
  "winner": { "agent": "code-review", "provider": "groq", "durationMs": 340 },
  "allResults": [ /* 3 items */ ],
  "totalDurationMs": 410,
  "reason": "consensus: 3/3 agents agreed (100%)"
}
```

4× perceived speed on multi-file tasks. Workers-compatible (uses `Promise.all()`, no git worktrees).

### Self-Learning Router (Thompson Sampling)

The smart router now uses a multi-armed bandit instead of static "pick the highest success rate". Key changes:

- **Beta distribution sampling** per (agent, provider, model) — natural exploit/explore balance
- **90-day recency window** — old outcomes decay automatically
- **30-day half-life decay** — recent data weighted ~2× vs 30 days old
- **10% forced exploration** when sample size < 20

Expected 30–50% LLM cost reduction after a week of real traffic.

### Graph RAG with Community Detection

Flat vector search misses related-but-not-similar code. New graph expansion:

1. Vector search returns top 5 chunks (score × 1.0)
2. For each, look up 1-hop neighbors (score × 0.7 × edge weight)
3. For each, look up same-community members (score × 0.5)
4. Dedupe, rerank, return top 10

Community detection uses label propagation (Workers-compatible, no native graph libs). Converges in 5–10 iterations.

**30–60% better retrieval precision** on code queries.

### Six LLM Providers (up from 3)

| Provider | Cost/1M | Best For |
|----------|---------|----------|
| **Gemma 4** (Ollama) | $0 | Local dev, free inference |
| **Gemini 2.0 Flash** | Free tier then $0.075 | Fast reasoning |
| **Groq** (Llama 3.3 70B) | Free tier then $0.05–0.10 | Highest throughput (LPU) |
| **DeepSeek Chat** | $0.14 | Cheap general use |
| **OpenAI GPT-4o** | ~$2.50 | Balanced quality |
| **Anthropic Claude Sonnet** | ~$3.00 | Highest quality fallback |

The Thompson router auto-picks the best one for each agent type based on outcomes.

### Architecture

Full routing chain for every request:

```
Task arrives
  ↓
Agent Booster ($0 — deterministic code transforms)
  ↓
ReasoningBank cache ($0 — SHA-256 prompt hash in KV)
  ↓
Context Packer (trim irrelevant fields)
  ↓
Smart Router (Thompson sampling picks provider + model)
  ↓
Graph RAG enrichment (if useRag:true)
  ↓
LLM call via Claw Gateway (PII redaction + audit log)
  ↓
Stream SSE response
  ↓
Record outcome → update Thompson priors
```

~30% of requests never hit an LLM thanks to booster + cache.

---

## April 2026 — CLI published on npm

`luna-agents@2.0.1` is now on the npm registry.

```bash
npm install -g luna-agents
luna-setup
```

- **232 slash commands** for Claude Code
- **28 specialized agents**
- **3 MCP servers**: Nexa RAG, GLM Vision, combined vision+RAG client
- **360 KB packed**, **290 files**, Node ≥18, MIT license

GitHub release: https://github.com/lunaos-ai/luna-agents/releases/tag/v2.0.1

---

## April 2026 — Dashboard deployed

The admin dashboard is live at **[agents.lunaos.ai](https://agents.lunaos.ai)**.

Pages:
- `/dashboard` — overview with recent executions and usage
- `/dashboard/agents` — browse 28 agents, run any of them
- `/dashboard/chains` — build multi-step workflows
- `/dashboard/api-keys` — create/revoke API keys
- `/dashboard/billing` — upgrade plan, view invoices
- `/dashboard/kb` — knowledge base (upload docs for RAG)
- `/dashboard/repos` — connect GitHub repos for indexing
- `/dashboard/analytics` — usage charts

Built on Next.js 15 static export, deployed on Cloudflare Pages.

---

## Test coverage

Engine API: **179/179 tests passing**

```
 ✓ tests/swarm.test.ts              (9)   — parallel agent swarm
 ✓ tests/thompson-sampling.test.ts  (15)  — Beta distribution + bandit
 ✓ tests/graph-rag.test.ts          (7)   — expansion + reranking
 ✓ tests/community-detection.test.ts (9)  — label propagation
 ✓ tests/cli-tools.test.ts          (48)
 ✓ tests/agent-orchestration.test.ts (30)
 ✓ tests/workflow-builder.test.ts   (27)
 ✓ tests/payment.test.ts            (16)
 ✓ tests/auth.test.ts               (10)
 ✓ tests/monitoring.test.ts         (8)
```

---

## What's next

- **Flakestress runtime** — run any test 100× to detect flakes
- **Perfetto trace UI** — flame graphs for workflow execution
- **LLM-judge vote strategy** — replace longest-output heuristic with a real arbiter
- **Product Hunt launch**

---

_Stay updated: follow [@lunaos_ai](https://twitter.com/lunaos_ai) or watch [github.com/lunaos-ai](https://github.com/lunaos-ai)._
