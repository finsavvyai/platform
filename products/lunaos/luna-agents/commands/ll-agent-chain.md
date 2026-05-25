---
name: ll-agent-chain
displayName: Luna Agent Chain
description: Chain multiple agents together — RAG + Nexa + OpenHands + LAM in custom pipelines
version: 1.0.0
category: ai
agent: luna-task-executor
parameters:
  - name: chain
    type: string
    description: Agent chain definition (e.g., "rag->nexa->openhands" or natural language)
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - parse_chain_definition
  - validate_agent_availability
  - execute_chain_sequentially
  - pass_context_between_agents
  - collect_chain_results
  - generate_chain_report
output:
  - .luna/{current-project}/chain-report.md
prerequisites: []
---

# Luna Agent Chain

Compose custom pipelines by chaining AI agents together.

## What This Command Does

1. **Parse** — reads your chain definition (DSL or natural language)
2. **Validate** — checks all agents in the chain are available
3. **Execute** — runs agents sequentially, passing output as input to next
4. **Context** — each agent receives the previous agent's output as context
5. **Collect** �� combines all agent outputs into a unified report
6. **Report** — documents the full chain execution with per-agent results

## Chain Syntax

```
# Arrow syntax — agents execute left to right
/agent-chain "rag -> nexa review -> openhands implement -> test"

# Natural language — auto-detected
/agent-chain "search the codebase for auth patterns, review them, then fix any issues"

# Parallel branches with merge
/agent-chain "(lint + test + typecheck) -> deploy"

# Conditional
/agent-chain "test -> if-pass: deploy -> if-fail: fix -> test"
```

## Available Agents for Chaining

| Agent | Input | Output |
|-------|-------|--------|
| `rag` | Query string | Relevant code snippets + context |
| `nexa` | Code path | AI analysis (review, bugs, explain) |
| `openhands` | Task description | Generated code changes |
| `lam` | High-level goal | Executed actions + results |
| `test` | Code path | Test results (pass/fail) |
| `review` | Code path | Review report |
| `lint` | Code path | Lint results |
| `build` | Project | Build output |
| `deploy` | Project | Deployment status |

## Preset Chains

```
# Full feature with AI
/agent-chain "rag understand -> lam implement -> test -> review -> pr"

# AI-powered bug fix
/agent-chain "rag search -> nexa bugs -> fix -> test"

# Code quality pipeline
/agent-chain "(lint + typecheck + test + security) -> review -> pr"

# AI code review with context
/agent-chain "rag context -> nexa review -> openhands fix suggestions"
```

## Usage

```
/agent-chain "rag -> nexa review -> fix"
/agent-chain "nexa debt -> refactor -> test"
/agent-chain "rag -> lam 'add pagination to all list endpoints'"
```

## Context Passing

Each agent in the chain receives:
- The original user goal
- The previous agent's output
- Accumulated context from all prior agents
- Project rules and constraints
