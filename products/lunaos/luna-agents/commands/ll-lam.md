---
name: ll-lam
displayName: Luna LAM (Large Action Model)
description: Action-driven AI — combine RAG understanding with autonomous code actions across the full stack
version: 1.0.0
category: ai
agent: luna-rag-enhanced
parameters:
  - name: goal
    type: string
    description: High-level goal in natural language
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - understand_goal_with_rag
  - plan_action_sequence
  - execute_actions_autonomously
  - validate_each_action
  - loop_until_goal_met
  - generate_lam_report
output:
  - .luna/{current-project}/lam-report.md
prerequisites: []
---

# Luna LAM (Large Action Model)

Goal-driven AI that understands your codebase (RAG) and takes autonomous actions to achieve objectives.

## What This Command Does

Combines semantic code understanding (Nexa RAG) with autonomous action execution to accomplish high-level goals. Unlike `/feature` which follows a fixed pipeline, LAM dynamically decides what actions to take based on codebase analysis.

1. **Understand** — uses RAG to deeply understand your codebase and the goal
2. **Plan** — generates an action sequence (not just code — files, configs, tests, deps)
3. **Execute** — takes actions autonomously (create, edit, delete, install, configure)
4. **Validate** — checks each action against rules and tests
5. **Adapt** — if something fails, re-plans and tries alternative approach
6. **Loop** — continues until the goal is met or reports blockers

## How LAM Differs from Other Commands

| Command | Approach |
|---------|----------|
| `/feature` | Fixed pipeline: plan → implement → test → review |
| `/go` | Executes one task from a pre-made plan |
| `/openhands` | Delegates to external autonomous agent |
| `/lam` | **Dynamic actions** — decides what to do based on RAG understanding |

## Usage

```
/lam "make the dashboard load 2x faster"
/lam "add multi-tenancy support to the entire API"
/lam "convert all API endpoints from REST to tRPC"
/lam "set up a complete CI/CD pipeline with staging and production"
```

## Action Types LAM Can Take

- Create files (components, services, routes, tests)
- Edit existing files (refactor, optimize, add features)
- Install dependencies (`npm install`, `pip install`)
- Configure tools (ESLint, Tailwind, Prisma, Docker)
- Run commands (build, test, migrate, deploy)
- Generate documentation
- Create database migrations
- Set up infrastructure configs

## Architecture

```
Natural language goal
  -> RAG: understand codebase context
  -> Planner: generate action sequence
  -> Executor: take actions
  -> Validator: check results
  -> Feedback loop: adapt if needed
  -> Goal achieved
```

## Safety

- Validates every action against project rules (100-line cap, tests)
- Dry-run mode available for destructive actions
- Checkpoints after each major action for rollback
- Maximum 10 action iterations before reporting blockers
- All changes are reviewable before commit
