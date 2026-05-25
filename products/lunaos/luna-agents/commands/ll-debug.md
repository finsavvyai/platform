---
name: ll-debug
displayName: Luna Debugger
description: Systematic debugging — reproduce, hypothesize, instrument, test, narrow down with persistent state
version: 1.0.0
category: debugging
agent: luna-code-review
parameters:
  - name: issue
    type: string
    description: Bug description, error message, or unexpected behavior
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - reproduce_issue
  - form_hypotheses
  - instrument_code
  - test_hypotheses
  - narrow_root_cause
  - persist_debug_state
  - generate_debug_report
output:
  - .luna/{current-project}/debug-session.md
prerequisites: []
---

# Luna Debugger

Scientific debugging method with persistent state across context resets.

## What This Command Does

1. **Reproduce** — confirm the issue and document exact steps
2. **Hypothesize** — list 3-5 possible root causes ranked by likelihood
3. **Instrument** — add targeted logging/breakpoints to test hypotheses
4. **Test** — run specific scenarios to confirm or eliminate each hypothesis
5. **Narrow** — binary search through code flow to pinpoint root cause
6. **Persist** — save debug state so you can resume after context resets
7. **Report** — document findings, root cause, and suggested fix

## Debug Protocol

```
Observe → Hypothesize → Predict → Test → Repeat
    ↓
Each iteration:
  - Record what you tested
  - Record what you learned
  - Update hypothesis rankings
  - Save state to debug-session.md
```

## Usage

```
/debug "API returns 500 on workflow creation with > 10 nodes"
/debug "Dashboard shows stale data after team member removal"
/debug "Playwright test flakes on CI but passes locally"
```

## State Persistence

Debug state is saved to `.luna/{project}/debug-session.md` so you can:
- Resume debugging after context window resets
- Hand off to another developer with full context
- Review the debugging process for learning

## Differs from /fix

- `/fix` — knows the bug, writes test, fixes it
- `/debug` — doesn't know root cause, investigates systematically
