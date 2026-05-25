---
name: ll-smart-route
displayName: Luna Smart Route
description: Self-learning agent routing — tracks success rates per agent+model combo, routes to cheapest viable model automatically
version: 1.0.0
category: orchestration
agent: luna-smart-router
parameters:
  - name: task
    type: string
    description: The task description to route to the best agent+model combo
    required: true
    prompt: true
  - name: strategy
    type: string
    description: "Routing strategy: fast (lowest latency), cheap (lowest cost), best (highest quality)"
    required: false
    default: best
    enum: [fast, cheap, best]
workflow:
  - classify_task_type
  - lookup_historical_performance
  - score_candidate_models
  - select_optimal_route
  - execute_with_fallback
  - record_outcome
output: []
prerequisites: []
---

# Luna Smart Route

Self-learning agent routing inspired by SONA-style intelligent dispatch. Tracks which agent+model combos succeed per task type and routes to the cheapest viable option automatically.

## What This Command Does

1. **Classify Task** — analyzes the task description to determine type (code-gen, review, refactor, test, debug, docs)
2. **Lookup History** — queries KV/D1 for past execution results by task type
3. **Score Candidates** — ranks available agent+model combos by success rate, cost, and latency
4. **Select Route** — picks the optimal combo based on your chosen strategy
5. **Execute with Fallback** — runs the task; if the selected model fails, escalates to the next tier
6. **Record Outcome** — stores the result (pass/fail, cost, latency) to improve future routing

## Usage

```
/smart-route "refactor this function to use async/await"
/smart-route "write unit tests for billing service" --strategy cheap
/smart-route "review this PR for security issues" --strategy best
/smart-route "add JSDoc comments to all exports" --strategy fast
```

## Routing Strategies

| Strategy | Optimizes For | Behavior |
|----------|--------------|----------|
| **best** | Quality | Routes to highest success-rate model regardless of cost |
| **cheap** | Cost | Routes to cheapest model that meets minimum quality threshold |
| **fast** | Latency | Routes to fastest-responding model above quality floor |

## How Learning Works

- Every execution records: task type, model used, success/failure, cost, latency
- After 10+ executions per task type, routing becomes data-driven
- Cold start uses sensible defaults (Gemma 4 local for simple, Haiku for medium, Sonnet for complex)
- Performance data stored in Cloudflare KV with D1 backup for analytics

## Fallback Chain

```
free model (Gemma 4 local) → cheap model (Haiku) → mid model (Sonnet) → expensive model (Opus)
```

- If the selected model fails or produces low-quality output, automatically escalates
- Each escalation is recorded to adjust future routing weights
- Maximum 3 attempts before reporting failure

## Cost Savings

- Typical savings: 40-70% vs always using the most expensive model
- Simple tasks (formatting, comments, renames) route to Gemma 4 local at $0.000/task
- Medium tasks (code review, tests) route to Haiku at ~$0.001/task
- Complex tasks (architecture, security review) still route to Sonnet/Opus when needed
- Dashboard shows cumulative savings over time

## Data Storage

| Store | Purpose | TTL |
|-------|---------|-----|
| KV | Recent performance cache (last 100 per task type) | 7 days |
| D1 | Full execution history for analytics | 90 days |

