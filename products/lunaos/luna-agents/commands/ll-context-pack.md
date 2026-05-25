---
name: ll-context-pack
displayName: Luna Context Pack
description: Precision context delivery — analyzes tasks and selects only relevant files to reduce token usage by 40-60%
version: 1.0.0
category: optimization
agent: luna-context-packer
parameters:
  - name: task
    type: string
    description: The task description to build a context package for
    required: true
    prompt: true
  - name: max-tokens
    type: number
    description: Maximum token budget for the context package
    required: false
    default: 4000
workflow:
  - parse_task_intent
  - scan_project_structure
  - identify_relevant_files
  - extract_key_sections
  - build_context_package
  - estimate_token_savings
output: []
prerequisites: []
---

# Luna Context Pack

Precision context delivery inspired by Dossier. Analyzes your task and selects ONLY the relevant files and documentation sections, creating a minimal context package that reduces token usage by 40-60%.

## What This Command Does

1. **Parse Task Intent** — determines what the task needs (which modules, APIs, types, tests)
2. **Scan Project** — builds a lightweight project map (file tree, exports, imports)
3. **Identify Relevant Files** — uses dependency graph + semantic matching to find related code
4. **Extract Key Sections** — pulls only the relevant functions, types, and docs (not entire files)
5. **Build Context Package** — assembles a focused context blob within your token budget
6. **Estimate Savings** — reports how many tokens saved vs sending the full codebase

## Usage

```
/context-pack "fix the billing webhook handler"
/context-pack "add rate limiting to the auth middleware" --max-tokens 8000
/context-pack "write tests for the workflow executor"
/context-pack "refactor the dashboard to use server components" --max-tokens 2000
```

## How It Selects Context

### Dependency Analysis
- Traces imports/exports from the most relevant entry file
- Includes type definitions referenced by target code
- Follows the call graph up to 3 levels deep

### Semantic Matching
- Matches task keywords against file names, function names, and comments
- Weights recently modified files higher (more likely relevant)
- Considers git blame to find related changes

### Smart Truncation
- Includes function signatures + JSDoc even when body is trimmed
- Preserves type definitions in full (they're compact and high-value)
- Summarizes large files instead of including raw content

## Token Budget Management

| Budget | Typical Coverage |
|--------|-----------------|
| 2,000 | Core function + immediate dependencies |
| 4,000 | Module + types + related tests (default) |
| 8,000 | Feature area + cross-cutting concerns |
| 16,000 | Full subsystem with docs |

## Savings Comparison

| Approach | Tokens | Cost |
|----------|--------|------|
| Full codebase dump | ~50,000 | $0.15 |
| Directory-level filter | ~20,000 | $0.06 |
| **Context Pack** | ~4,000 | **$0.01** |

## Output Format

The context package is structured as:

```
## Task Context Package
- Target: src/services/billing.ts (lines 45-89)
- Types: src/types/billing.ts (full)
- Dependencies: src/db/subscriptions.ts (getSubscription, updateSubscription)
- Tests: src/services/billing.test.ts (relevant describe blocks)
- Config: wrangler.toml (billing-related env vars)
- Token usage: 3,847 / 4,000 budget
- Estimated savings: 58% vs full context
```

