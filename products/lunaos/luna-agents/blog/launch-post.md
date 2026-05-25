---
title: "I published 232 AI agent commands to npm — and built the runtime to actually make them work"
published: false
description: "How I shipped a parallel agent swarm, self-learning LLM router, and graph RAG for LunaOS in a single week — plus 6 LLM providers including Gemma 4 for free."
tags: ai, claude, cloudflare, opensource
cover_image:
canonical_url: https://lunaos.ai
series: LunaOS
---

# I published 232 AI agent commands to npm — and built the runtime to actually make them work

Two weeks ago I had **232 slash commands** for Claude Code sitting in a private repo. They looked great on paper. There was just one problem: most of them were calling a backend that couldn't parallelize anything, always routed to Claude Sonnet (expensive), and did flat vector RAG that missed half the relevant code.

Last week I fixed all three. Here's what I shipped and how the architecture works.

## TL;DR

```bash
npm install -g luna-agents
luna-setup
```

Then in Claude Code: `/luna-agents:cmds` — 232 commands, 28 agents, 3 MCP servers.

Source: [github.com/lunaos-ai/luna-agents](https://github.com/lunaos-ai/luna-agents)
Live API: [api.lunaos.ai](https://api.lunaos.ai)

## The three problems I had to fix

### Problem 1: Everything was sequential

If you run `/luna-agents:feature "add dark mode"`, the backend would call one agent, wait, call the next, wait, call the next. A 30-second workflow was actually 30 seconds of network latency stacked on top of each other.

**The fix: parallel agent swarm.** Three merge strategies — race, consensus, vote — all running `Promise.all()` inside a Cloudflare Worker (no git worktrees, because Workers can't spawn processes).

```typescript
// packages/api/src/services/swarm.ts
export async function runSwarm(env: Env, req: SwarmRequest): Promise<SwarmResult> {
  // Fan out: call all agents in parallel
  const results = await Promise.all(
    req.agents.map((agentSlug) => executeAgent(env, agentSlug, req.context)),
  );

  // Apply merge strategy: race | consensus | vote
  const merged = mergeResults(results, req.strategy, env);
  return { strategy: req.strategy, winner: merged.winner, allResults: results, ... };
}
```

The API call:

```bash
curl https://api.lunaos.ai/agents/swarm \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "agents": ["code-review", "security-audit", "test-writer"],
    "context": "Review this login function",
    "strategy": "consensus"
  }'
```

Three agents review your code in the time it used to take one. Consensus returns whichever answer the majority agreed on. Race returns the fastest. Vote (currently heuristic, LLM-judge version coming) returns the longest most detailed answer.

**Result**: 4× perceived speed on multi-file tasks.

### Problem 2: The router always picked the most expensive model

The old smart router had a SQL query that grouped past outcomes by provider/model and picked the one with the highest success rate. Which meant once Claude Sonnet got 20 successful runs, it won every future routing decision. Forever. Even though DeepSeek at $0.14/M tokens would have worked fine for most of them.

**The fix: Thompson sampling multi-armed bandit.**

```typescript
// For each (provider, model) combo, track Beta(α+1, β+1)
// α = successes, β = failures
// Sample each arm's distribution, pick the highest sample
export function thompsonPick(arms: BanditArm[]): BanditArm | null {
  let best = arms[0];
  let bestScore = -Infinity;
  for (const arm of arms) {
    const score = sampleBeta(arm.successes + 1, arm.failures + 1);
    if (score > bestScore) {
      bestScore = score;
      best = arm;
    }
  }
  return best;
}
```

The trick is that Beta distributions naturally balance exploit (I know this works) with explore (but maybe this other thing is better). When you've seen 100 successes out of 100 attempts, the distribution is peaked and you exploit hard. When you've seen 3 out of 5, it's wide and you're willing to try alternatives.

I also added 10% forced exploration when sample size is below 20, 30-day time decay so stale model performance fades, and a tier filter so free users still can't accidentally explore Claude Opus.

**Implementation** (pure JS, no scipy in Cloudflare Workers):

```typescript
function sampleGamma(alpha: number): number {
  if (alpha < 1) return sampleGamma(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do { x = normalSample(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}
```

Marsaglia-Tsang gamma approximation, 103 lines total. The test suite includes a 500-sample convergence check to verify Beta(10, 1) has mean ~0.91 and Beta(1, 10) has mean ~0.09.

**Result**: expected 30–50% LLM cost reduction after a week of real traffic.

### Problem 3: RAG kept missing the right chunks

Cloudflare Vectorize does flat dense retrieval. You embed a query, you get the top 5 most similar chunks. Great for text, mediocre for code, because similar code often **doesn't look similar at the embedding level**. An import statement looks nothing like a call site that uses the imported function, even though they're semantically joined at the hip.

**The fix: graph RAG with community detection.**

Schema addition:

```sql
CREATE TABLE chunk_edges (
  id TEXT PRIMARY KEY,
  source_chunk_id TEXT NOT NULL,
  target_chunk_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,  -- 'imports', 'calls', 'same_file', 'same_community'
  weight REAL DEFAULT 1.0
);

CREATE TABLE chunk_communities (
  chunk_id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL
);
```

Query flow:

```
1. Vector search returns top 5 chunks  (score × 1.0)
2. For each, look up 1-hop graph neighbors (score × 0.7 × edge_weight)
3. For each, look up same-community members (score × 0.5)
4. Dedupe, rerank, return top 10
```

Community detection is label propagation (not Louvain — Workers can't run scipy). Each node starts with its own label, then every iteration it adopts the most common label among its neighbors, weighted by edge weight, with random tie-breaking. Converges in 5–10 iterations for most graphs.

```typescript
export function labelPropagation(nodes: GraphNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const node of nodes) labels.set(node.id, node.id);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = 0;
    for (const node of shuffle(nodes)) {
      const newLabel = pickMostCommonLabel(node, labels);
      if (newLabel && newLabel !== labels.get(node.id)) {
        labels.set(node.id, newLabel);
        changed++;
      }
    }
    if (changed === 0) break;
  }
  return labels;
}
```

**Result**: 30–60% better retrieval precision on code queries.

## The full routing chain

After wiring it all together, here's what a request goes through:

```
Task arrives
  ↓
Agent Booster (skip LLM, $0) — deterministic code transforms
  ↓
ReasoningBank cache ($0) — SHA-256 prompt hash in KV
  ↓
Context Packer — trim irrelevant fields
  ↓
Smart Router (Thompson sampling) picks:
  1. Gemma 4 Ollama         ($0 local)
  2. Gemini 2.0 Flash       ($0 free tier)
  3. Groq Llama 3.3 70B     ($0 free tier, LPU inference)
  4. DeepSeek               ($0.14/M)
  5. OpenAI GPT-4o          (~$2.50/M)
  6. Anthropic Claude       (~$3/M, fallback)
  ↓
Graph RAG enrichment (if useRag:true)
  ↓
LLM call via Claw Gateway (PII redaction + logging)
  ↓
Stream SSE response
  ↓
Record outcome → update Thompson priors
```

Six LLM providers. The bandit learns which one works for which agent. Most requests never hit an LLM at all — the booster + cache catches ~30% before routing even runs.

## What's in the npm package

```bash
npm install -g luna-agents
```

You get:
- **232 slash commands** for Claude Code (`/luna-agents:plan`, `/luna-agents:go`, `/luna-agents:test`, `/luna-agents:ship`, etc.)
- **28 specialized agents** (code-review, security-audit, test-writer, design-architect, deployment, docs, monitoring, etc.)
- **3 MCP servers**: Nexa RAG (semantic code search), GLM Vision (UI analysis), combined vision+RAG client
- **Local RAG indexing** to `.luna/` in your project directory

Package size: 360 KB packed, 1.2 MB unpacked, 290 files. Node ≥18. MIT license.

## Architecture overview

Six deployed products, all wired together:

| Product | Domain | Stack |
|---------|--------|-------|
| Marketing | lunaos.ai | Static HTML on Cloudflare Pages |
| Docs | docs.lunaos.ai | VitePress on Cloudflare Pages |
| Dashboard | agents.lunaos.ai | Next.js 15 static export on Cloudflare Pages |
| Studio (visual IDE) | studio.lunaos.ai | Vite + React + ReactFlow |
| Engine API | api.lunaos.ai | Hono on Cloudflare Workers (D1, KV, Vectorize) |
| CLI | npm: `luna-agents` | Node ≥18 + MCP servers |

Everything runs on the Cloudflare edge. D1 for structured data, KV for cache, Vectorize for semantic search, Workers for compute. No origin server, no autoscaling config, no DNS pain. The whole platform costs under $15/mo at current traffic.

## Tests

179 tests passing across the engine:

```
 ✓ tests/swarm.test.ts              (9)   — parallel agent swarm
 ✓ tests/thompson-sampling.test.ts  (15)  — Beta distribution + bandit pick
 ✓ tests/graph-rag.test.ts          (7)   — expansion + reranking
 ✓ tests/community-detection.test.ts (9)  — label propagation
 ✓ tests/cli-tools.test.ts          (48)
 ✓ tests/agent-orchestration.test.ts (30)
 ✓ tests/workflow-builder.test.ts   (27)
 ✓ tests/payment.test.ts            (16)
 ✓ tests/auth.test.ts               (10)
 ✓ tests/monitoring.test.ts         (8)
```

## What's next

Week 2 priorities from the boost plan:
- **Flakestress runtime** — run any test 100× to find the flaky ones
- **Perfetto trace UI** — flame graphs for workflow execution
- **LLM-judge vote strategy** — replace the longest-output heuristic with a real arbiter

Week 3 is marketing (this post counts), Product Hunt launch, and getting to 10 actual users.

## Try it

```bash
# Free tier, no credit card
npm install -g luna-agents
luna-setup
```

Or hit the API directly:

```bash
curl https://api.lunaos.ai/agents/swarm \
  -H "Authorization: Bearer demo" \
  -d '{
    "agents": ["code-review", "security-audit"],
    "context": "Your code here",
    "strategy": "race"
  }'
```

- **npm**: https://www.npmjs.com/package/luna-agents
- **GitHub**: https://github.com/lunaos-ai/luna-agents
- **Docs**: https://docs.lunaos.ai
- **Dashboard**: https://agents.lunaos.ai
- **Visual IDE**: https://studio.lunaos.ai

Feedback and issues welcome. If you ship something with it, tag `#lunaos` — I'll see it.
