# LunaOS Intelligence Features — Documentation + Examples

## 1. Claw Gateway (Shared AI Proxy)

**What:** Single API endpoint that routes LLM calls to the cheapest/best provider.
**Why:** Instead of each project managing its own API keys and providers, all projects call one gateway.

```bash
# Any project calls the same endpoint
curl -X POST https://claw-gateway.workers.dev/v1/prompt \
  -H "Authorization: Bearer claw_xxxx" \
  -H "X-Project-Id: my-project" \
  -d '{"prompt": "Explain this code", "maxTokens": 500}'
```

**Result:** `{"text": "This function takes a list and...", "usage": {"inputTokens": 45, "outputTokens": 120}}`

---

## 2. Agent Booster (Skip AI for Simple Tasks)

**What:** Detects simple deterministic tasks and handles them instantly without calling the LLM.
**Why:** ~15% of requests are simple transforms that don't need AI. Saves tokens + 2-5 seconds latency.

```
User sends: "Convert var to const in this code"
→ Booster detects: var-to-const transform
→ Applies regex: var x = 1 → const x = 1
→ Returns in <1ms, $0 cost

User sends: "Explain the architecture of this app"
→ Booster: not a simple transform
→ Falls through to LLM
```

**Supported transforms:** var-to-const, add-types, remove-console, add-error-handling, format-json, to-async

**Per-project boosters:**
- Push-CI: lint-only/format-only pipelines → instant pass
- PipeWarden: known OWASP patterns → instant alert
- QueryFlux: simple SQL (SELECT * FROM x) → skip AI
- Aegis: exact name+DOB+country match → instant AML hit

---

## 3. ReasoningBank (Prompt Cache)

**What:** Caches successful prompt→response pairs in KV with 24-hour TTL.
**Why:** Same question asked twice = same answer. Skip the LLM call entirely on cache hit.

```
First call:  "What does this function do?" → calls LLM (2s, 500 tokens) → stores in cache
Second call: "What does this function do?" → cache hit → returns in <10ms, $0

Cache key = SHA-256(agent + system_prompt + user_message)
```

**Per-project caches:**
- Push-CI: same pipeline config → same analysis
- PipeWarden: same security scan → same results
- QueryFlux: same NL question → same SQL query
- Aegis: same entity → same screening result (24hr)
- TenantIQ: same tenant config → same analysis (4hr)

---

## 4. Context Packing (Trim Before Sending)

**What:** Analyzes the context and removes irrelevant parts before sending to the LLM.
**Why:** Less tokens = less cost + faster response + often better accuracy (less noise).

```
Before packing (8,000 tokens):
  - Full file with 200 lines of imports
  - 50 blank lines
  - Long JSDoc comments
  - Entire test file

After packing (3,200 tokens):
  - Imports compressed to names only
  - Comments removed
  - Blank lines collapsed
  - Only relevant function bodies kept

Savings: 60% (reported in X-Context-Savings header)
```

**4 progressive stages:**
1. Remove comments + collapse blank lines
2. Simplify imports + truncate long strings
3. Trim function bodies
4. Edge preservation (keep first/last 40%)

---

## 5. Smart Router (Self-Learning Model Selection)

**What:** Tracks which AI model works best for each type of task, and automatically routes future requests to the cheapest model that succeeds.
**Why:** DeepSeek at $0.14/M tokens works fine for 80% of tasks. No need to pay $3/M for Claude on simple queries.

```
Day 1: All requests go to default model (deepseek for free tier)
Day 2: 50 successful code-review runs logged
Day 3: Smart Router knows:
  - code-review + deepseek → 92% success, avg 1.2s
  - code-review + claude → 98% success, avg 2.8s
  → Routes free tier to deepseek (saves $$$)
  → Routes pro tier to claude (better quality)

Stored in D1: routing_outcomes table
Confidence: high (≥20 samples), medium (≥10), low (<10)
```

---

## 6. Hybrid Search (Sparse + Dense Fusion)

**What:** Combines keyword search (PostgreSQL FTS / D1 FTS5) with vector search (Vectorize/pgvector) using Reciprocal Rank Fusion.
**Why:** Keywords catch exact matches, vectors catch semantic matches. Together = 20-49% better results.

```
Query: "authentication middleware"

Sparse (keyword):     Found: auth.ts, middleware.ts, jwt.ts
Dense (vector):       Found: auth-guard.ts, session.ts, oauth.ts
RRF Fusion:           auth.ts (rank 1+3), auth-guard.ts (rank 5+1), middleware.ts (rank 2+7)...

Result: Better ranking than either search alone
RRF formula: score = Σ(1 / (k + rank_i)) where k=60
```

---

## 7. Credit System (Gamification)

**What:** Users earn credits for actions, unlock achievement badges at milestones.
**Why:** Gamification increases engagement and retention.

```
Actions and rewards:
  signup         → 100 credits (welcome bonus)
  first_execution → 50 credits
  daily_login    → 5 credits
  share_workflow → 25 credits

Milestones:
  10 executions  → "Getting Started" badge + 20 credits
  100 executions → "Power User" badge + 50 credits
  1000 executions → "Expert" badge + 200 credits

API:
  GET  /credits              → { balance: 175, achievements: [...] }
  POST /credits/earn         → { action: "daily_login" }
  GET  /credits/leaderboard  → top 20 users
```

---

## 8. Queen-Led Swarm (Multi-Agent Orchestration)

**What:** A coordinator agent (Queen) decomposes complex tasks into subtasks and dispatches them to worker agents running in parallel.
**Why:** Complex tasks finish 3-5x faster with parallel execution.

```
User: "Refactor this module, add tests, update docs"

Queen (strategic) decomposes:
  Subtask 1: "Refactor the database queries" → Worker A
  Subtask 2: "Add unit tests for each function" → Worker B
  Subtask 3: "Update the README with new API" → Worker C

Workers execute in parallel via Claw Gateway.
Queen aggregates results into a single coherent output.

Consensus modes:
  'first'    — return first worker's result (fastest)
  'majority' — return most common result (safest)
  'best'     — Queen picks the best result (smartest)
```

---

## 9. Self-Learning SDK (Client-Side Intelligence)

**What:** The Claw SDK learns from every call — caches locally, tracks which routes work best, and optimizes future calls.
**Why:** Even before reaching the gateway, the client can skip network calls for cached results.

```typescript
import { ClawClient } from '@opensyber/claw-sdk';

const claw = new ClawClient({ apiKey: 'claw_xxx', projectId: 'my-app' });

// First call: hits gateway (200ms)
const result1 = await claw.ask('What is 2+2?');

// Second call: local cache hit (0ms, no network)
const result2 = await claw.ask('What is 2+2?');

// SDK tracks: this prompt pattern works best with deepseek
// Future similar prompts auto-route to deepseek
const stats = claw.getLearning().getStats();
// { cacheHits: 1, totalCalls: 2, hitRate: 0.5 }
```

---

## 10. Local Providers (llamafile + Voicebox)

**What:** Detects if llamafile (LLM) or Voicebox (TTS) are running locally, and uses them for free.
**Why:** Zero cost, zero latency, works offline.

```bash
# Start llamafile (one command, no install)
./llamafile-qwen3.5 --server --port 8080

# Start Voicebox (local TTS)
# Opens at localhost:17493

# LunaOS auto-detects both:
GET /providers/status
{
  "cloud": { "anthropic": true, "openai": true },
  "local": {
    "llamafile": { "available": true, "latencyMs": 3 },
    "voicebox": { "available": true, "latencyMs": 5 }
  }
}
```

---

## 11. Product Map (Visual Planning)

**What:** Hierarchical planning view in Studio: Product → Workflows → Feature Cards.
**Why:** Plan before you build. Each feature card tracks status, tags, and relevant files.

```
studio.lunaos.ai#map

Product: "My SaaS App"
├── Auth Workflow
│   ├── [done] Login Page
│   ├── [building] OAuth Integration
│   └── [planned] MFA Support
├── Billing Workflow
│   ├── [done] Pricing Page
│   └── [planned] Usage Metering
└── Dashboard Workflow
    ├── [building] Analytics Charts
    └── [planned] Team Settings

Click any card → "Start Building" → opens canvas with context
```

---

## 12. Perfetto Tracing

**What:** Generates Chrome Trace Event Format JSON that can be loaded into ui.perfetto.dev for performance analysis.
**Why:** See exactly where time is spent in agent execution, API calls, database queries.

```typescript
import { createTracer } from '@opensyber/shared/tracing';

const tracer = createTracer();

tracer.begin('agent-execution');
const result = await tracer.measure('llm-call', () => claw.prompt(...));
await tracer.measure('db-write', () => db.insert(result));
tracer.end('agent-execution');

// Export and open in Perfetto
const json = tracer.toJSON();
// → Upload to ui.perfetto.dev for timeline visualization


                                                                                                                                                            
  ┌───────────────────┬───────────────────┬──────────────────────────────────────────────────────┐                                                              
  │      Feature      │   Where It Runs   │                     What It Does                     │                                                            
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ Agent Booster     │ Before gateway    │ Skips everything if deterministic                    │                                                            
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                            
  │ Context Packing   │ Before gateway    │ Reduces what gets sent                               │                                                              
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ ReasoningBank     │ Before gateway    │ Returns cached response if seen before               │                                                              
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ Smart Router      │ Before gateway    │ Picks which model to use                             │                                                            
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                            
  │ Claw Gateway      │ The call itself   │ Routes to LLM provider                               │
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ Hybrid Search     │ Separate endpoint │ Better RAG retrieval (feeds into context)            │
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ Credit System     │ After gateway     │ Awards credits for usage                             │                                                            
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ Self-Learning SDK │ Client-side       │ Caches on the client before even hitting the server  │                                                            
  ├───────────────────┼───────────────────┼──────────────────────────────────────────────────────┤                                                              
  │ Queen-Led Swarm   │ Above all of this │ Decomposes task, runs multiple pipelines in parallel │                                                            
  └───────────────────┴───────────────────┴──────────────────────────────────────────────────────┘                                                              
                                                                                                                                                              
  They're a pipeline, not embedded. Each feature is a sep
```
