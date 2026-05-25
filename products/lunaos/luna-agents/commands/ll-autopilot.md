---
name: ll-autopilot
displayName: Luna Autopilot
description: Fully autonomous development — give Luna a goal, it plans, codes, tests, reviews, fixes, and ships without intervention
version: 1.0.0
category: orchestration
agent: luna-task-executor
parameters:
  - name: goal
    type: string
    description: What you want built, fixed, or shipped — in plain English
    required: true
    prompt: true
  - name: budget
    type: number
    description: "Max iterations before stopping for human review (default: 20)"
    required: false
    default: 20
  - name: auto_ship
    type: boolean
    description: "Auto-deploy when done? (default: false — stops for approval)"
    required: false
    default: false
mcp_servers:
  - ruflo
  - git
  - memory
  - sequential-thinking
  - playwright
  - zai-mcp-server
  - accessibility-scanner
  - fetch
---

# /autopilot — Set the Goal, Walk Away

The most powerful command in Luna. Give it a goal in plain English. Luna autonomously plans, implements, tests, reviews, fixes, and optionally ships — learning from each iteration.

## Autonomous Loop

```
/autopilot "Add Stripe billing with free trial, pro plan, and team plan"
                    │
                    ▼
         ┌─── THINK ──────────┐
         │  Analyze the goal    │
         │  Break into tasks    │
         │  Identify risks      │
         │  Plan approach       │
         │  (sequential-thinking)│
         └────────┬────────────┘
                  │
         ┌─── EXECUTE ────────┐
         │  For each task:      │
         │  ├── Code it         │
         │  ├── Test it         │
         │  ├── Review it       │
         │  ├── Fix issues      │
         │  └── Mark complete   │
         │  (ruflo swarm)       │
         └────────┬────────────┘
                  │
         ┌─── VERIFY ─────────┐
         │  Run full test suite │
         │  Visual QA check     │
         │  Security scan       │
         │  A11y compliance     │
         │  Performance check   │
         └────────┬────────────┘
                  │
              PASS? ──NO──→ FIX ──→ back to EXECUTE
                │
               YES
                │
         ┌─── DELIVER ────────┐
         │  Generate changelog  │
         │  Create PR or deploy │
         │  Update docs         │
         │  Store learnings     │
         └─────────────────────┘
```

## The Difference

| Traditional | Luna Autopilot |
|------------|---------------|
| You plan tasks | Luna plans tasks |
| You code each one | Luna codes each one |
| You run tests manually | Luna runs tests automatically |
| You fix failures | Luna fixes failures |
| You request review | Luna reviews its own code |
| You deploy manually | Luna deploys with confidence |
| **Hours of work** | **One command, walk away** |

## Usage

```bash
/autopilot "Add user authentication with email, Google OAuth, and magic links"
/autopilot "Refactor the API from REST to GraphQL" --budget 30
/autopilot "Fix all accessibility violations" --budget 15
/autopilot "Add dark mode to the entire dashboard" --auto-ship
/autopilot "Build a CLI that generates reports from our API"
/autopilot "Migrate from Prisma to Drizzle ORM"
```

## Safety

- **Budget limit**: Stops after N iterations (default 20) for human review
- **Auto-ship disabled by default**: Always asks before deploying
- **Checkpoint commits**: Every successful task gets its own git commit
- **Rollback ready**: Can undo any autopilot session with one command
- **Learning**: Each autopilot run makes the next one smarter
```
