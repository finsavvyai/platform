---
name: ll-multi-agent
displayName: Luna Multi-Agent
description: Run multiple AI agents in parallel on isolated git worktrees — race or consensus strategies, inspired by Agent of Empires
version: 1.0.0
category: orchestration
agent: luna-task-executor
parameters:
  - name: task
    type: string
    description: The task to distribute across parallel agents
    required: true
    prompt: true
  - name: agents
    type: number
    description: "Number of parallel agents to spawn (default: 3)"
    required: false
    default: 3
  - name: strategy
    type: string
    description: "Strategy: race (first wins), consensus (merge best parts) (default: race)"
    required: false
    default: race
mcp_servers:
  - memory
  - git
  - sequential-thinking
prerequisites:
  - name: git-worktree
    check: "git worktree list"
    install: "Requires git 2.15+ with worktree support"
    optional: false
  - name: tmux
    check: "which tmux"
    install: "brew install tmux (macOS) or apt install tmux (Linux)"
    optional: true
---

# /multi-agent — Parallel AI Agents on Isolated Branches

Run multiple AI agents simultaneously on different git worktrees, each tackling the same task independently. Pick the best result (race) or merge the best parts (consensus). Inspired by Agent of Empires.

## What It Does

```
/multi-agent "Implement user authentication" --agents 3
    │
    ├── SETUP: Create isolated environments
    │   ├── git worktree add .worktrees/agent-1 -b agent/auth-1
    │   ├── git worktree add .worktrees/agent-2 -b agent/auth-2
    │   └── git worktree add .worktrees/agent-3 -b agent/auth-3
    │
    ├── EXECUTE: Run agents in parallel
    │   ├── Agent 1: Working in .worktrees/agent-1 ...
    │   ├── Agent 2: Working in .worktrees/agent-2 ...
    │   └── Agent 3: Working in .worktrees/agent-3 ...
    │   (tmux sessions for real-time monitoring)
    │
    ├── EVALUATE: Compare results
    │   ├── Run tests in each worktree
    │   ├── Score: test pass rate, code quality, coverage
    │   ├── Compare approaches and trade-offs
    │   └── Select winner or merge best parts
    │
    └── MERGE
        ├── race:      Cherry-pick winner to main branch
        └── consensus: Merge best files from each agent
```

## Strategies

### Race (default)
All agents work independently. The first one that passes all tests wins. Others are discarded.

```
Agent 1: ████████████ PASS ← Winner!
Agent 2: ██████████░░ FAIL
Agent 3: ████████░░░░ (still running, cancelled)
```

### Consensus
All agents complete their work. An evaluator agent reviews all solutions and merges the best parts from each.

```
Agent 1: Auth middleware (best)    → KEEP
Agent 2: Token refresh (best)     → KEEP
Agent 3: Test coverage (best)     → KEEP
Result:  Combined best of all three
```

## How It Works

1. **Git worktrees**: Each agent gets an isolated working directory on its own branch
2. **Parallel execution**: Agents run concurrently via tmux or background processes
3. **Isolation**: No agent can see or interfere with another's work
4. **Evaluation**: Tests + code quality scoring determine the winner
5. **Cleanup**: Worktrees and branches are removed after merge

## Usage

```bash
/multi-agent "Implement OAuth2 login"                         # 3 agents, race
/multi-agent "Build dashboard" --agents 5                     # 5 agents
/multi-agent "Refactor auth module" --strategy consensus      # Merge best parts
/multi-agent "Write API tests" --agents 2 --strategy race    # 2 agents race
```

## Use Cases

| Use Case | Why |
|----------|-----|
| Parallel feature development | 3 approaches, pick the best |
| A/B code generation | Compare different architectures |
| Multi-approach problem solving | Consensus merges best of each |
| Competitive coding | Race to the best solution |
| Explore trade-offs | See how different agents solve it |

## Session Management

```bash
# Monitor running agents (tmux)
tmux attach -t luna-multi-agent          # View all agent sessions
tmux select-window -t agent-1           # Focus on agent 1

# Manual control
/multi-agent status                      # Check progress
/multi-agent cancel                      # Stop all agents
/multi-agent results                     # View comparison
```

## Output Structure

```
.worktrees/
├── agent-1/          # Isolated worktree (cleaned up after merge)
├── agent-2/
└── agent-3/

multi-agent-results/
├── comparison.md     # Side-by-side analysis
├── scores.json       # Per-agent scores
│   {
│     "agents": [
│       { "id": 1, "tests_passed": 42, "coverage": "94%", "score": 0.92 },
│       { "id": 2, "tests_passed": 38, "coverage": "87%", "score": 0.81 },
│       { "id": 3, "tests_passed": 40, "coverage": "91%", "score": 0.88 }
│     ],
│     "winner": 1,
│     "strategy": "race"
│   }
└── diffs/
    ├── agent-1.diff  # Each agent's changes
    ├── agent-2.diff
    └── agent-3.diff
```

## In Pipes

```bash
/pipe multi-agent "build feature" >> test >> ship
/pipe idea "my app" >> multi-agent "implement" --agents 5 >> rev >> ship
/pipe multi-agent "fix bug #42" --strategy consensus >> test >> pr
/pipe plan >> multi-agent "implement phase 1" >> flaky "npm test" >> ship
```

## Reference

- Inspired by: https://github.com/njbrake/agent-of-empires
- Git worktrees: `git worktree add <path> -b <branch>`
- tmux: Session management for parallel monitoring
