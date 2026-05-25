---
name: ll-cache-tune
displayName: Luna Cache Tune
description: Anthropic prompt-cache optimizer — switch TTL between 5m and 1h mid-conversation, install keepalive proxy, measure cache hit rate, cut token cost.
version: 1.0.0
category: performance
agent: luna-cache-tune
parameters:
  - name: action
    type: string
    description: "audit | tune | keepalive | report"
    required: false
    default: "audit"
  - name: target
    type: string
    description: Project path (default cwd)
    required: false
    default: "."
  - name: ttl
    type: string
    description: "5m | 1h | auto"
    required: false
    default: "auto"
workflow:
  - locate_anthropic_sdk_calls
  - measure_current_cache_hit_rate
  - classify_prompt_blocks_by_volatility
  - propose_cache_strategy
  - apply_cache_control_breakpoints
  - install_keepalive_if_long_ttl
  - verify_token_savings
output:
  - .luna/{current-project}/cache-tune-report.md
  - .luna/{current-project}/cache-tune-fixes.diff
prerequisites:
  - anthropic SDK in deps (typescript, python, or go)
---

# Luna Cache Tune — Anthropic Prompt Cache Optimizer

Cuts Claude API cost by tuning prompt cache TTL, placing breakpoints correctly, and keeping caches warm. Inspired by `mcp-sophon`, `pi-cache-ttl-config`, `openclaw-cache-keepalive`.

## What It Does

```
1. Find every Anthropic SDK call in the project (Messages.create, etc.)
2. Decompose each prompt into stable / semi-stable / volatile blocks
3. Measure current cache_creation_input_tokens vs cache_read_input_tokens
4. Recommend TTL per call site:
     - stable system prompts + tool defs        → 1h cache
     - semi-stable conversation prefix          → 5m cache
     - volatile last user turn                  → no cache
5. Apply cache_control: { type: 'ephemeral', ttl: '1h' | '5m' } breakpoints
6. Install keepalive worker if any 1h block exists (refresh @ 50min)
7. Re-run, compare token costs, report
```

## Cost Math

Default 5m cache:
- write = 1.25× input cost
- read  = 0.1× input cost

1h cache (April 2026 pricing):
- write = 2× input cost
- read  = 0.1× input cost

1h pays off when prefix is reused ≥ 4× per hour OR conversation longer than 5 min between turns.

## Strategy Picker

```
Calls per hour ≥ 4   AND  prefix > 1024 tokens   → ttl=1h
Calls per minute ≥ 1 AND  prefix > 1024 tokens   → ttl=5m
Calls sporadic       OR   prefix < 1024 tokens   → no cache
```

## Cache Block Layout

Recommended order in every prompt (Anthropic best practice):

```
[system prompt + tool defs]          ← cache_control: 1h
[long static context (docs/code)]    ← cache_control: 1h
[conversation history prefix]        ← cache_control: 5m
[latest user turn]                   ← no cache
```

Up to 4 cache breakpoints per request — use them all.

## Keepalive

For 1h TTL blocks, install a keepalive job that re-issues a tiny prompt (1 token output) at minute 50 to refresh the cache. Saves write-cost on the next real call.

## Modes

- `audit` (default): scan, report, no edits
- `tune`: scan + apply cache_control changes
- `keepalive`: install/remove keepalive worker
- `report`: read cache stats from response usage and write savings report

## Usage

```
/ll-cache-tune                              # audit current project
/ll-cache-tune tune --ttl 1h                # apply 1h caching everywhere it pays off
/ll-cache-tune keepalive                    # install warm-up worker
/ll-cache-tune report                       # show $ saved last 7 days
```

## Output

`.luna/{project}/cache-tune-report.md`:
- Per-call-site recommendation
- Estimated $ saved / month at current QPS
- Cache hit rate before/after
- Keepalive job specs

`.luna/{project}/cache-tune-fixes.diff` — applied edits (revertible).

## Rules

- Do not enable 1h TTL on prompts containing PII or per-user secrets — privacy risk if cache leaks across users
- Always preserve at least one breakpoint for the latest user turn (never cache it)
- Verify total breakpoints ≤ 4 per request
- Stop on any SDK version below the cache-supported minimum (anthropic-py >= 0.34, anthropic-ts >= 0.27)

## In Pipes

```bash
/pipe ll-cache-tune audit >> rev >> ll-cache-tune tune
/pipe feature "x" >> ll-cache-tune tune >> ship
```
