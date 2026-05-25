---
name: ll-learn
displayName: Luna Learn
description: Self-learning memory — Luna gets smarter with every task, remembering patterns, preferences, and successful approaches
version: 1.0.0
category: intelligence
agent: luna-task-executor
parameters:
  - name: action
    type: string
    description: "Action: status (show what Luna knows), teach (add knowledge), forget (remove), export, import"
    required: false
    default: status
mcp_servers:
  - memory
  - ruflo
  - sequential-thinking
---

# /learn — Luna Gets Smarter Over Time

Every command you run teaches Luna. Successful patterns are stored, failures are analyzed, and your preferences are remembered. Luna evolves with you.

## The Learning Loop

```
You run a command → Luna executes → Outcome observed
                                          │
                    ┌─────────────────────┤
                    ▼                     ▼
              SUCCESS                 FAILURE
              │                       │
              ▼                       ▼
        DISTILL pattern         ANALYZE root cause
        Store in memory         Store anti-pattern
              │                       │
              └───────────┬───────────┘
                          ▼
                    MEMORY BANK
                    │
                    ├── Your code style preferences
                    ├── Your architecture patterns
                    ├── Your test strategy
                    ├── Your deploy workflow
                    ├── Your review standards
                    ├── Common bugs in your codebase
                    ├── Successful fix patterns
                    └── Failed approaches to avoid
                          │
                          ▼
                    NEXT COMMAND
                    Luna applies learned patterns
                    Avoids known failures
                    Matches your style
```

## What Luna Learns

| Category | Examples |
|----------|---------|
| **Code Style** | You prefer functional over class components, named exports, barrel files |
| **Architecture** | You use Zustand over Redux, Hono over Express, Zod for validation |
| **Testing** | You write integration tests first, mock at boundaries, 90%+ coverage |
| **Review** | You care about bundle size, hate magic numbers, enforce 200-line limit |
| **Deploy** | You use canary deploys, always run visual QA before production |
| **Naming** | camelCase for functions, PascalCase for components, kebab-case for files |
| **Failures** | "Don't use SPA mode with serve for static sites" (learned from this session!) |

## Usage

```bash
/learn                     # Show what Luna knows about you
/learn status              # Same — full knowledge dashboard
/learn teach "Always use Bun over npm for this project"
/learn teach "Our API uses snake_case, not camelCase"
/learn forget "old pattern about Redux"
/learn export              # Export knowledge as JSON
/learn import ./team.json  # Import team's shared knowledge
```

## In Pipes

```bash
/pipe learn >> go *5                    # Apply learned patterns then code
/pipe go *5 >> test >> learn            # Code, test, then distill learnings
/pipe learn export >> share team        # Share learnings with team
```
