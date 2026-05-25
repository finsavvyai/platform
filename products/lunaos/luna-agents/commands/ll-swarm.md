---
name: ll-swarm
displayName: Luna Swarm
description: Spawn a coordinated multi-agent swarm — parallel coding, reviewing, testing, and deploying with consensus
version: 1.0.0
category: orchestration
agent: luna-task-executor
parameters:
  - name: task
    type: string
    description: The task for the swarm to accomplish
    required: true
    prompt: true
  - name: topology
    type: string
    description: "Swarm topology: star (default), mesh, ring, hierarchical"
    required: false
    default: star
  - name: agents
    type: number
    description: "Number of agents to spawn (default: 5)"
    required: false
    default: 5
mcp_servers:
  - ruflo
  - memory
  - git
  - sequential-thinking
---

# /swarm — Multi-Agent Parallel Execution

Spawn multiple AI agents that work simultaneously on different aspects of a task, coordinate via consensus, and merge their work automatically.

## How It Works

```
/swarm "Build a user dashboard with charts, tables, and real-time updates"
                    │
                    ▼
         ┌─── QUEEN AGENT ───┐
         │  Decomposes task   │
         │  Assigns roles     │
         │  Monitors progress │
         └────────┬──────────┘
                  │
    ┌─────┬──────┼──────┬─────┐
    ▼     ▼      ▼      ▼     ▼
 CODER  CODER  TESTER  REVIEW DESIGNER
 Charts Tables  Tests   Code   HIG
 comp.  comp.  suite   review  check
    │     │      │      │     │
    └─────┴──────┼──────┴─────┘
                 ▼
         ┌─── CONSENSUS ────┐
         │  Merge branches   │
         │  Resolve conflicts│
         │  Validate tests   │
         │  Final review     │
         └──────────────────┘
```

## Topologies

| Topology | When to Use |
|----------|-------------|
| **star** | Default. Queen coordinates, agents work independently. Best for most tasks. |
| **mesh** | All agents communicate. Best for creative/design tasks needing consensus. |
| **ring** | Sequential pipeline. Best for code review chains, refactoring passes. |
| **hierarchical** | Queen → sub-queens → workers. Best for large features spanning multiple services. |

## Usage

```bash
/swarm "Implement Stripe billing integration"
/swarm "Refactor auth module to use JWT" --topology ring --agents 3
/swarm "Build mobile app screens for onboarding flow" --topology mesh
/swarm "Full security audit of the API" --topology hierarchical --agents 8
```

## In Pipes

```bash
/pipe idea "my app" >> swarm "implement the full app" --agents 10 >> test >> ship
/pipe swarm "build feature X" >> (rev ~~ test ~~ sec) >> swarm "fix all issues" >> ship
```

## Agent Roles

The queen automatically assigns from this pool:

| Role | What It Does |
|------|-------------|
| **Architect** | System design, dependency planning |
| **Coder** | Implementation, feature building |
| **Tester** | Test writing, coverage analysis |
| **Reviewer** | Code review, best practices |
| **Designer** | HIG compliance, responsive layout |
| **Security** | Vulnerability scanning, auth review |
| **Optimizer** | Performance tuning, bundle size |
| **Documenter** | API docs, README, changelog |
