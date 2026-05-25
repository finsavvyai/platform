# LunaOS Workflow Execution — Performance Profile

**Agent:** 1c-3
**Branch:** race/agent-1c-3
**Scope:** Workflow / chain execution hot path on Cloudflare Workers
**Date:** 2026-04-25

---

## 1. Annotated Hot Path (Trigger -> Run -> Per-node Skill -> Finish)

```
[HTTP trigger]                packages/api/src/routes/chains.ts:43-69          POST /chains/execute
   |
   |-> insert chain_executions row (D1)              chains.ts:64-67           1 D1 write
   |-> streamChainExecution(...)                     chains.ts:69
        |
        v
[SSE stream open]              packages/api/src/services/chain-stream-handler.ts:103-160
   |-> sendChainStart(...)                           chain-stream-handler.ts:25-44
   |-> executeChain(...)                             chain-stream-handler.ts:110-117
        |
        v
[Chain executor]              packages/api/src/services/chain-executor.ts:57-152
   |-> validateChain (Kahn topo sort)                chain-executor.ts:74; chain-schema.ts:70-160
   |-> nodeMap = Map(...)                            chain-executor.ts:83
   |-> for i in executionOrder:                      chain-executor.ts:103-136
        |-> chain.edges.filter(...).map(...)         chain-executor.ts:116        <- O(E) per node
        |-> nodeResults.find(...)                    chain-executor.ts:117        <- O(N) per pred
        |-> executeNode(...)                         chain-executor.ts:126-130
              |
              v
        [Per-node runner]      packages/api/src/services/chain-node-runner.ts:30-105
              |-> onProgress node_start (SSE write)  chain-node-runner.ts:38-44
              |-> getPersona                         chain-node-runner.ts:47
              |-> buildNodePrompt (string concat)    chain-node-runner.ts:58; chain-schema.ts:172-199
              |-> callLLMSync (await fetch)          chain-node-runner.ts:66-70; chain-llm.ts:11-85
              |-> onProgress node_complete (SSE)     chain-node-runner.ts:79-85
   |-> compute terminalNodeIds                       chain-executor.ts:138-140
   |-> onProgress chain_complete                     chain-executor.ts:147-149
        ^
        |
[Stream handler post-loop]
   |-> saveExecutionState (D1 UPDATE)                chain-stream-handler.ts:75-100, 119-126
   |-> stream.writeSSE chain_done                    chain-stream-handler.ts:128-147

[Scheduled trigger variant]   packages/api/src/services/scheduled-runner.ts:10-112
   |-> SELECT scheduled_tasks                        scheduled-runner.ts:19-28
   |-> for task: dispatchTask (no Promise.all)       scheduled-runner.ts:37-42, 48-111
        |-> JSON.parse(chain_def)                    scheduled-runner.ts:55
        |-> INSERT chain_executions                  scheduled-runner.ts:68-78
        |-> executeChain (await)                     scheduled-runner.ts:81-85
        |-> UPDATE chain_executions                  scheduled-runner.ts:88-98
        |-> UPDATE scheduled_tasks                   scheduled-runner.ts:102-106
```

---

## 2. Top 5 Hot Spots

### HS-1 — Sequential per-node LLM await blocks every parallelizable branch (HIGH)

**File:** `packages/api/src/services/chain-executor.ts:103-136`

**Problem:** The executor walks `executionOrder` in a strict serial `for ... await`. Even when the DAG has independent branches (very common in LunaOS preset chains: e.g. `requirements -> [design | research] -> code-review`), nodes that share no transitive dependency are still executed one after another. Every node's wall time is dominated by an LLM HTTP round-trip (1-15s). For a typical 5-node chain with 2 independent branches, ~40% of the wall clock is wasted serializing nodes that could fan out.

**Evidence:**
```ts
// chain-executor.ts:103-136
for (let i = options?.startIndex || 0; i < executionOrder.length; i++) {
    const nodeId = executionOrder[i];
    ...
    const { result, output } = await executeNode({ ... });   // <- always awaited, single-flight
    nodeResults.push(result);
    if (output) nodeOutputs.set(nodeId, output);
    completedCount++;
}
```

**Proposed fix — level-based parallel execution:**
```ts
// Group nodes by topological level (ready when all predecessors done)
const levels = computeLevels(chain, executionOrder);   // Map<nodeId, depth>
const byLevel = new Map<number, string[]>();
for (const [id, lvl] of levels) (byLevel.get(lvl) ?? byLevel.set(lvl, []).get(lvl)!).push(id);

for (const lvl of [...byLevel.keys()].sort((a,b)=>a-b)) {
    const ids = byLevel.get(lvl)!;
    const settled = await Promise.all(ids.map(id => {
        const node = nodeMap.get(id)!;
        if (predecessorFailedFor(id)) return Promise.resolve({ skipped: true, id });
        return executeNode({ ...buildParams(node, id) });
    }));
    for (const r of settled) {
        nodeResults.push(r.result);
        if (r.output) nodeOutputs.set(r.result.nodeId, r.output);
    }
}
```

**Estimated speedup:** 30-50% wall-clock reduction on 4+ node chains with any branching (~40% average across the seven preset chains in `data/preset-chains`). Conservative: **~35%**.

---

### HS-2 — O(N x E) predecessor lookup inside the per-node loop (MEDIUM)

**File:** `packages/api/src/services/chain-executor.ts:116-117`

**Problem:** For every node we (a) `chain.edges.filter(...).map(...)` to find predecessors and (b) for each predecessor do a linear `nodeResults.find(...)`. Allocates a fresh array twice per iteration. On a 50-node, 80-edge chain this is 50 * (80 filter + ~3 * 50 find) ≈ 11,500 ops and ~150 transient arrays — small in absolute terms, but it scales O(N*(E+N)) and re-allocates on each tick of the SSE stream. Cumulatively a noticeable fraction of CPU between LLM awaits and contributes to GC pressure inside Workers' tight CPU budget.

**Evidence:**
```ts
// chain-executor.ts:116-117
const predecessorIds = (chain.edges || []).filter(e => e.to === nodeId).map(e => e.from);
const predecessorFailed = predecessorIds.some(pid =>
    nodeResults.find(r => r.nodeId === pid && r.status === 'failed'),
);
```

**Proposed fix — precompute once:**
```ts
// Build before the loop:
const predecessorsByNode = new Map<string, string[]>();
for (const e of chain.edges || []) {
    (predecessorsByNode.get(e.to) ?? predecessorsByNode.set(e.to, []).get(e.to)!).push(e.from);
}
const failedNodes = new Set<string>();
// ...
const preds = predecessorsByNode.get(nodeId) || [];
const predecessorFailed = preds.some(pid => failedNodes.has(pid));
// after a node fails:
if (result.status === 'failed') failedNodes.add(nodeId);
```

**Estimated speedup:** Drops node-orchestration overhead from O(N*(E+N)) to O(N+E). On 50-node chains saves ~1-3ms CPU per chain inside the Worker (~2-5% of orchestration wall time, ~0.5% of total chain wall time when LLMs dominate, but **~15% on the cache-hit fast path** where LLM is bypassed). Estimate: **~3% total, 15% on cache hits**.

---

### HS-3 — Unbounded `JSON.stringify` of node outputs into D1 `context` column on every state save (HIGH)

**File:** `packages/api/src/services/chain-stream-handler.ts:75-100, 119-126`

**Problem:** `saveExecutionState` serializes the entire `intermediateOutputs` map to a JSON string and writes it as a single D1 cell — and only at the end. But the full per-node outputs (each can be up to `maxTokens=4096` tokens ≈ 16-24KB UTF-8) are duplicated: once in the `node_results` write at finish, again here in `context`, plus they are already kept in memory via `chain-stream-handler.ts:104, 47-72` (the SSE callback also pushes to the same map). For a 10-node chain this is one 200-300KB stringify under the await → blocks Workers CPU and bloats D1 row size (D1 hard cap warnings start past ~1MB rows). On the resume path (`chains.ts:88-89`) the same payload is re-parsed, re-allocated, and converted to a Map — pure waste when a resume isn't requested.

**Evidence:**
```ts
// chain-stream-handler.ts:85-96
await db.prepare(`UPDATE chain_executions SET ... context = ? ...`)
    .bind(..., JSON.stringify(Array.from(context.entries())), ...).run();
```
```ts
// chain-stream-handler.ts:51-72  (callback also retains every output in memory)
if (event.result?.output) intermediateOutputs.set(event.result.nodeId, event.result.output);
```

**Proposed fix — only persist context when paused, store outputs in R2 if large:**
```ts
async function saveExecutionState(db, chainId, status, nodeIndex, ctx, completed) {
    // Only persist context when we may need to resume.
    const persistCtx = status === 'paused';
    const ctxBlob = persistCtx ? JSON.stringify(Array.from(ctx.entries())) : null;
    // For paused chains > 64KB, push to R2 and store the key instead.
    const ctxRef = ctxBlob && ctxBlob.length > 64_000
        ? await putR2(`chain-ctx/${chainId}.json`, ctxBlob)   // returns 'r2:<key>'
        : ctxBlob;
    await db.prepare(`UPDATE chain_executions
        SET status=?, current_node_index=?, context=?, updated_at=?, completed_at=?
        WHERE id=?`).bind(status, nodeIndex, ctxRef, now, completed ? now : null, chainId).run();
}
```

**Estimated speedup:** Eliminates a 50-300KB serialization on the happy path (most chains never pause). Removes ~5-25ms CPU and ~50-300KB of D1 write traffic per chain. **~5% total wall time** on small chains, **~10-15%** on chains with long outputs.

---

### HS-4 — N+1 D1 writes per scheduled task (no batching, sequential dispatch loop) (HIGH)

**File:** `packages/api/src/services/scheduled-runner.ts:37-42, 68-106`

**Problem:** Cron tick executes `dispatchTask` per task with **3 separate D1 writes per task** (INSERT chain_executions, UPDATE chain_executions, UPDATE scheduled_tasks) and the loop fans out via `.catch()` but is not awaited — meaning failures past the function return are silently dropped, AND each task does its INSERT before kicking off the LLM, serializing the cold-start cost of D1 prepared statements. With 1K daily runs (per `LUNA_DOMINATION_PLAN_2026.md`) this is 3K D1 writes that could be 1K batched writes. Also `JSON.stringify(chainDef)` (line 75) is recomputed even when the row already stored `chain_def` — pure duplicate work on the row that the executor will read again.

**Evidence:**
```ts
// scheduled-runner.ts:68-78
await env.DB.prepare(`INSERT INTO chain_executions (id, ...) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(chainId, task.user_id, chainDef.name, JSON.stringify(chainDef), 'running', new Date().toISOString()).run();
// scheduled-runner.ts:88-98  -- second write
// scheduled-runner.ts:102-106 -- third write
```

**Proposed fix — D1 batch + skip duplicate JSON.stringify:**
```ts
const nowIso = new Date().toISOString();
// One round-trip for INSERT + UPDATE scheduled_tasks
await env.DB.batch([
    env.DB.prepare(`INSERT INTO chain_executions (id, user_id, chain_name, chain_def, status, created_at)
        VALUES (?, ?, ?, ?, 'running', ?)`)
        .bind(chainId, task.user_id, chainDef.name, task.chain_def /* reuse stored JSON */, nowIso),
    env.DB.prepare(`UPDATE scheduled_tasks SET last_run_at = ?, updated_at = ? WHERE id = ?`)
        .bind(nowIso, nowIso, task.id),
]);
// run LLM ...
// final UPDATE remains 1 write (status + duration + node_results)
```

**Estimated speedup:** D1 RTT on Workers ≈ 8-20ms each. Dropping 2 RTTs per task saves ~16-40ms per task. For 1K daily scheduled runs that's 16-40s total worker CPU saved daily plus reduced contention. **~10% of scheduled-task latency**, ~2% of overall chain wall (LLM dominates).

---

### HS-5 — Zero LLM-call deduplication / coalescing inside a chain (and double redaction) (MEDIUM)

**Files:** `packages/api/src/services/chain-llm.ts:11-85`, `packages/api/src/services/llm-caller.ts:25-26` (compare path), and re-call pattern in `chain-node-runner.ts:66`

**Problem:** Two independent issues compound:
1. The chain executor never reuses identical (system_prompt, user_message) calls. If the user replays/resumes a chain, every node hits the upstream LLM again — the ReasoningBank cache used by `routes/agents.ts:143-150` is **not wired into the chain path**. With chain replays expected for failed/paused executions, this is a guaranteed redundant cost.
2. `redactPII` runs unconditionally on `systemPrompt + userMessage` for every node; for long persona system prompts (~2-4KB) that's two regex passes per node × N nodes — but only `llm-caller.ts` does this; `chain-llm.ts` does not, so chain calls actually leak un-redacted PII to providers (correctness bug AND a perf comparison).

**Evidence:**
```ts
// chain-node-runner.ts:66-70  -- no cache check, no redact
const output = await callLLMSync(nodeProvider, nodeModel, nodeApiKey,
    persona.systemPrompt, prompt, ...);
```
```ts
// reasoning-bank.ts is only consumed in routes/agents.ts:143-150
// chain path bypasses it entirely
```

**Proposed fix — wire ReasoningBank + memoize redaction:**
```ts
// chain-node-runner.ts (in executeNode)
const safeSystem = redactPIIOnce(persona.systemPrompt);     // memoized by persona slug
const safePrompt = redactPII(prompt);
const rbKey = await cacheKey(node.agent, safeSystem, safePrompt);
const cached = await checkCache(env, rbKey);
if (cached) {
    return { result: { nodeId, agent: node.agent, status: 'completed', output: cached,
        durationMs: 0, tokenCount: cached.length }, output: cached };
}
const output = await callLLMSync(nodeProvider, nodeModel, nodeApiKey, safeSystem, safePrompt, ...);
if (output) ctx.waitUntil(storeInCache(env, rbKey, output));
```

**Estimated speedup:** Cache hit rate of 20-40% on repeated/preset chain runs eliminates the LLM round-trip entirely (~1-15s saved per cached node). On a chain with 5 nodes and 30% hit rate: **~25-30% wall-clock reduction** on warm runs. Memoized redaction saves ~0.5ms × N nodes (small but free).

---

## 3. Recommended Order of Fixes

| # | Hot spot | Why first | Risk | Effort |
|---|----------|-----------|------|--------|
| 1 | **HS-1** Parallel level-based execution | Largest, broadest win; touches one file | Low — preserves DAG semantics, just batches independent siblings | M (1 day) |
| 2 | **HS-5** Wire ReasoningBank + fix PII redaction in chain path | Big win on warm runs + closes a security gap (PII leak) | Low for cache; the redaction fix is also a correctness bug | S (½ day) |
| 3 | **HS-3** Stop persisting context on the happy path | Removes a 50-300KB hot serialization; trivial to gate | Very low — only affects resume, which we keep behind `status === 'paused'` | S (½ day) |
| 4 | **HS-4** Batch scheduled-runner D1 writes | Biggest impact on scheduled load (10K runs/day target); easy via `db.batch` | Low — single function, well-isolated | S (½ day) |
| 5 | **HS-2** Precompute predecessor index | Cheap cleanup, multiplies the gain on cache-hit fast path (after HS-5) | Trivial | XS (1 hour) |

**Aggregate estimated speedup if all five land:**

| Path | Today | After fixes | Reduction |
|------|-------|-------------|-----------|
| 5-node branchy chain, cold | 100% | ~55-60% | **~40-45%** |
| 5-node chain, warm (30% cache hit) | 100% | ~40% | **~60%** |
| 1K scheduled runs / day, D1 cost | 3K writes | 2K writes | **-33% D1 ops** |
| Memory churn per chain (allocations) | baseline | -O(N*E) arrays + -1 large stringify | meaningful at p99 |

Total realistic blended wall-clock improvement on the workflow execution hot path: **~35-40%** on cold runs, **~55-60%** on warm runs, with a measurable D1 cost reduction and one PII-leak correctness fix as bonuses.

---

## 4. Out-of-Scope / Follow-ups

- `chain-llm.ts` keeps an entire response body in memory before returning the parsed text — switch to streaming + accumulator for very long outputs (>64KB).
- `chain-executor.ts:138-140` rebuilds `outgoingNodes` set every run; could live next to the precomputed `predecessorsByNode` from HS-2.
- `routes/chains.ts:62-67` does an `INSERT` then immediately starts streaming; consider `db.batch([insert, ...])` with the first SSE event flushed via `executionCtx.waitUntil` for lower TTFB.
- Add a perf regression test in `tests/load.benchmark.spec.ts` that asserts wall-clock for a 5-node chain with stubbed LLM; gate at <1.4× LLM round-trip baseline.
