---
name: ll-context-compress
displayName: Luna Context Compress
description: Deterministic context compressor for LLM prompts — slot-based pre-prompt pruning that cuts tokens 30-60% with zero ML inference, stacks on top of prompt caching.
version: 1.0.0
category: performance
agent: luna-context-compress
parameters:
  - name: target_file
    type: string
    description: Path to file/folder containing prompt builder code
    required: false
    default: "."
  - name: budget_tokens
    type: number
    description: Max tokens per compressed prompt
    required: false
    default: 50000
  - name: mode
    type: string
    description: "audit | apply | benchmark"
    required: false
    default: "audit"
workflow:
  - locate_prompt_builders
  - identify_context_inputs
  - measure_input_token_size
  - install_compressor_pipeline
  - benchmark_before_after
  - report_savings
output:
  - .luna/{current-project}/context-compress-report.md
  - src/lib/context-compressor.{ts|py}
prerequisites: []
---

# Luna Context Compress — Deterministic Pre-Prompt Compressor

Cuts prompt tokens by 30-60% with zero ML at query time. Inspired by `mcp-sophon`. Stacks on top of Anthropic prompt caching for additive savings.

## Why Deterministic, Not Summarization

LLM-summarized context:
- Costs tokens to compute
- Adds latency
- Loses fidelity
- Can hallucinate

Deterministic compression:
- O(n) string ops, sub-millisecond
- Lossless for structured data
- Reproducible (same input → same output)
- Cheap

## Compression Slots

| Slot | Technique | Typical savings |
|------|-----------|-----------------|
| **Whitespace** | Collapse runs of spaces/newlines, strip trailing | 5-10% |
| **Comments** | Strip non-doc comments from code | 8-15% |
| **Imports** | Compress import groups to a one-liner manifest | 3-7% |
| **Boilerplate** | Drop license headers, generated banners | 2-5% |
| **JSON** | Re-emit minified, key-sort for cache stability | 5-15% |
| **Markdown** | Compact tables, drop empty headers | 4-10% |
| **Diff** | Drop context lines beyond N around hunks | 10-25% |
| **Logs** | Drop timestamps and trace IDs from log bodies | 15-40% |
| **Symbol map** | Replace deeply nested AST with file:symbol index | 20-50% |
| **Dedup** | Hash-collapse repeated chunks (file fragments) | 10-30% |

## Pipeline

```
raw inputs
    ↓
[detector] file type / kind
    ↓
[router]   pick compressors per kind
    ↓
[apply]    deterministic transforms
    ↓
[budget]   if total > budget_tokens: priority-drop low-value sections
    ↓
[emit]     compressed string + sidecar metadata
```

Cache stability: every transform is **deterministic and idempotent** so the compressed bytes match across runs and the prompt cache stays hot.

## Modes

- `audit` (default): measure where tokens go, recommend compressors
- `apply`: install `context-compressor.{ts|py}` and wire into prompt builders
- `benchmark`: A/B with and without compression, report savings

## Usage

```
/ll-context-compress                            # audit current project
/ll-context-compress . --mode apply             # install compressor
/ll-context-compress src/agents --budget 30000  # tighter budget
/ll-context-compress . --mode benchmark         # measure savings
```

## Output

**`.luna/{project}/context-compress-report.md`**:
- Token breakdown before/after per slot
- Compressors selected per call site
- Estimated $/month saved at current QPS

**`src/lib/context-compressor.{ts|py}`**:
- Pluggable compressor interface
- Per-kind handlers (code, json, md, diff, logs)
- Budget enforcer with priority drop list

## Stacking with /cache-tune

```
[raw context] → /context-compress → /cache-tune (1h block)
                     ↓                        ↓
                  -40% tokens             -90% on cache hits
                     ↓                        ↓
                  combined: -94% steady-state cost
```

Run `/cache-tune` AFTER `/context-compress` so cache stores the smallest payload.

## Rules

- **Determinism**: no `Date.now()`, no `Math.random()`, no Map iteration order
- **Reversibility**: compressor must keep a sidecar (line→symbol) so error messages can be back-mapped
- **Budget priority drop order**: tests > docs > examples > generated banners > license headers > whitespace > imports > inline comments. Never drop production code.
- **Verify equality** of compressed-then-decompressed against original under test fixtures
- **No PII shifting**: compression must not move or duplicate sensitive data into different positions

## In Pipes

```bash
/pipe ll-context-compress audit >> rev >> ll-context-compress apply
/pipe ll-context-compress apply >> ll-cache-tune tune >> ship
```
