---
name: ll-agent-boost
displayName: Luna Agent Boost
description: WASM-based simple task executor — skips LLM calls entirely for deterministic code transforms at sub-millisecond speed
version: 1.0.0
category: optimization
agent: luna-wasm-executor
parameters:
  - name: action
    type: string
    description: "The transform to apply: var-to-const, add-types, add-error-handling, async-await, add-logging, remove-console, format, lint-fix"
    required: true
    prompt: true
    enum: [var-to-const, add-types, add-error-handling, async-await, add-logging, remove-console, format, lint-fix]
  - name: file
    type: string
    description: Path to the file to transform
    required: true
    prompt: true
workflow:
  - validate_file_exists
  - detect_language
  - load_wasm_transform
  - apply_transform
  - verify_syntax
  - write_result
output: []
prerequisites: []
---

# Luna Agent Boost

WASM-based simple task executor inspired by Agent Booster. Skips LLM calls entirely for deterministic code transforms — sub-millisecond execution, zero token cost.

## What This Command Does

1. **Validate File** — confirms the target file exists and is a supported language
2. **Detect Language** — identifies TypeScript, JavaScript, Python, or Go from extension and content
3. **Load WASM Transform** — loads the pre-compiled WASM module for the requested action
4. **Apply Transform** — executes the AST-level transform deterministically
5. **Verify Syntax** — parses the output to confirm valid syntax
6. **Write Result** — writes the transformed file back (with backup)

## Usage

```
/agent-boost var-to-const src/utils/helpers.ts
/agent-boost add-types src/services/billing.ts
/agent-boost add-error-handling src/routes/api.ts
/agent-boost async-await src/legacy/callbacks.js
/agent-boost add-logging src/middleware/auth.ts
/agent-boost remove-console src/components/Dashboard.tsx
/agent-boost format src/index.ts
/agent-boost lint-fix src/utils/validators.ts
```

## Supported Transforms

| Action | What It Does | Languages |
|--------|-------------|-----------|
| **var-to-const** | Convert `var`/`let` to `const` where safe | JS, TS |
| **add-types** | Infer and add TypeScript types to untyped params | TS |
| **add-error-handling** | Wrap async calls in try/catch with structured errors | JS, TS |
| **async-await** | Convert Promise chains and callbacks to async/await | JS, TS |
| **add-logging** | Add structured logging at function entry/exit points | JS, TS, Python |
| **remove-console** | Strip all `console.log/warn/error` statements | JS, TS |
| **format** | Apply Prettier-compatible formatting | JS, TS, JSON |
| **lint-fix** | Auto-fix common ESLint violations | JS, TS |

## Performance

| Metric | Value |
|--------|-------|
| Execution time | <1ms per file |
| Token cost | $0.00 (no LLM call) |
| Accuracy | 100% (deterministic AST transforms) |
| Rollback | Automatic `.bak` file created before transform |

## Why Use This Over LLM

- **Speed**: 1000x faster than an LLM round-trip
- **Cost**: Zero tokens consumed
- **Determinism**: Same input always produces same output
- **Reliability**: No hallucinations, no creative interpretations

## Safety

- Creates a `.bak` backup before every transform
- Validates output syntax before writing
- Refuses to transform files with syntax errors
- Dry-run mode available with `--dry-run` flag

