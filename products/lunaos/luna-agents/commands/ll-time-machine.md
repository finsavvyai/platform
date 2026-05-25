---
name: ll-time-machine
displayName: Luna Time Machine
description: Travel through your project's history — replay any state, compare any two points in time, understand why anything changed
version: 1.0.0
category: intelligence
agent: luna-task-executor
parameters:
  - name: action
    type: string
    description: "Action: replay (restore state), compare (diff two points), why (explain a change), blame (who and why)"
    required: true
    prompt: true
  - name: target
    type: string
    description: "Commit hash, date, tag, branch, or description like 'before the auth refactor'"
    required: true
    prompt: true
mcp_servers:
  - git
  - memory
  - sequential-thinking
  - playwright
  - image-compare
---

# /time-machine — Navigate Your Project's Timeline

Understand what changed, when, why, and by whom. Visually compare any two points in your project's history. Replay past states safely.

## Commands

```bash
/time-machine replay "before the auth refactor"         # Restore that state (in worktree)
/time-machine compare "last week" "now"                  # Diff with screenshots
/time-machine compare v1.0 v2.0                          # Release-to-release comparison
/time-machine why "the billing page looks different"      # Trace visual changes to commits
/time-machine blame "./src/components/Sidebar.tsx"        # Full history with reasoning
```

## Visual Time Travel

```
/time-machine compare "3 days ago" "now"
              │
              ▼
   CHECKOUT "3 days ago" (in isolated worktree)
   ├── Build and run
   ├── Screenshot every page (playwright)
   └── Capture metrics
              │
              ▼
   CHECKOUT "now"
   ├── Build and run
   ├── Screenshot every page
   └── Capture metrics
              │
              ▼
   COMPARE (image-compare MCP)
   ├── Pixel diff every page
   ├── Side-by-side gallery
   ├── List all git commits between the two points
   ├── Map each visual change to the commit that caused it
   └── Performance delta (faster? slower?)
```

## In Pipes

```bash
/pipe time-machine compare "last release" "now" >> visual-diff >> assert "no regressions" >> launch
/pipe time-machine why "homepage looks broken" >> fix >> test >> ship
```
