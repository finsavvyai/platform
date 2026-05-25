---
name: ll-parallel
displayName: Luna Parallel Runner
description: Run multiple agents in parallel — build, lint, test, type-check simultaneously
version: 1.0.0
category: workflow
agent: luna-task-executor
parameters:
  - name: agents
    type: string
    description: Comma-separated agents to run (build,lint,test,typecheck,security,e2e)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - parse_agent_list
  - validate_prerequisites
  - fan_out_parallel_agents
  - collect_results
  - merge_report
output:
  - .luna/{current-project}/parallel-report.md
prerequisites: []
---

# Luna Parallel Runner

Fan-out/fan-in orchestrator that runs multiple agents simultaneously.

## What This Command Does

1. **Parse** — reads your agent list or uses defaults
2. **Fan-out** — launches all agents in parallel
3. **Collect** — waits for all agents to complete
4. **Merge** — combines results into a single report

## Default Parallel Set

When no agents specified, runs:
- `lint` — ESLint + Prettier check
- `typecheck` — TypeScript strict compilation
- `test` — Unit test suite
- `security` — Dependency vulnerability scan
- `build` — Production build validation

## Custom Parallel Sets

```
/parallel build,lint,test
/parallel test,e2e,security
/parallel lint,typecheck
```

## Available Agents

| Agent | What It Runs |
|-------|-------------|
| `build` | Production build (`npm run build`) |
| `lint` | ESLint + Prettier (`npm run lint`) |
| `test` | Unit tests (`npm run test`) |
| `typecheck` | TypeScript (`tsc --noEmit`) |
| `security` | Dependency audit (`npm audit`) |
| `e2e` | Playwright tests (`npx playwright test`) |
| `bundle` | Bundle size analysis |
| `coverage` | Test coverage report |

## Output

- `.luna/{project}/parallel-report.md` — combined results with pass/fail per agent
- Exit status: fails if any agent fails
