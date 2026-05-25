---
name: ll-openhands
displayName: Luna OpenHands
description: Autonomous AI coding agent — delegate complex tasks to OpenHands for autonomous implementation
version: 1.0.0
category: ai
agent: luna-task-executor
parameters:
  - name: task
    type: string
    description: Task description for OpenHands to execute autonomously
    required: true
    prompt: true
  - name: mode
    type: string
    description: Execution mode (autonomous, supervised, plan-only)
    required: false
    prompt: true
workflow:
  - analyze_task_complexity
  - prepare_openhands_context
  - launch_openhands_agent
  - monitor_execution
  - review_changes
  - validate_output
  - generate_openhands_report
output:
  - .luna/{current-project}/openhands-report.md
prerequisites: []
---

# Luna OpenHands

Delegate complex coding tasks to the OpenHands autonomous AI agent.

## What This Command Does

1. **Analyze** — evaluates task complexity and prepares context
2. **Context** — sends relevant codebase context to OpenHands
3. **Launch** — starts OpenHands agent via REST API
4. **Monitor** — streams execution progress via WebSocket/SSE
5. **Review** — validates generated code against project rules
6. **Validate** — runs tests and lint on OpenHands output
7. **Report** — documents what was changed and why

## Execution Modes

| Mode | Behavior |
|------|----------|
| `autonomous` | OpenHands works independently, reports when done |
| `supervised` | Pauses at each step for your approval |
| `plan-only` | Returns execution plan without implementing |

## Usage

```
/openhands "implement user settings page with profile edit"
/openhands "refactor the billing service to use LemonSqueezy webhooks" supervised
/openhands "add WebSocket support to the run logs endpoint" plan-only
```

## Integration Points

```
Luna CLI -> OpenHands REST API -> Agent Execution
     ↓                                ↓
  RAG context (Nexa)          Code generation
     ↓                                ↓
  Project rules              Validation & tests
```

## Safety

- All OpenHands output is validated against project rules
- 100-line file cap enforced on generated code
- Tests must pass before accepting changes
- Code review runs automatically on output
- Supervised mode for high-risk changes
