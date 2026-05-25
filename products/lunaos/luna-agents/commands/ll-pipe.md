---
name: ll-pipe
displayName: Luna Pipeline Runner
description: Luna's AI programming language — combine commands with operators, variables, conditions, loops, and workflows
version: 2.0.0
category: workflow
agent: luna-task-executor
parameters:
  - name: pipeline
    type: string
    description: Pipeline expression or saved workflow name
    required: true
    prompt: true
workflow:
  - parse_pipeline_expression
  - resolve_variables_and_imports
  - validate_commands
  - execute_pipeline
  - collect_results
  - generate_pipeline_report
output:
  - .luna/{current-project}/pipeline-report.md
prerequisites: []
---

# Luna Pipe — AI Programming Language

Compose Luna commands into powerful pipelines with variables, conditions, loops, workflows, and more.

**Every command in a pipe is a Luna command.**

---

## Operators

### Flow Control

| Operator | Meaning | Example |
|----------|---------|---------|
| `>>` | Sequential | `req >> des >> plan` |
| `~~` | Parallel | `rev ~~ test ~~ sec` |
| `( )` | Group | `(rev ~~ test) >> ship` |
| `?>>` | If success | `test ?>> ship` |
| `!>>` | If failure | `test !>> fix` |

### Loops

| Operator | Meaning | Example |
|----------|---------|---------|
| `*N` | Loop N times | `go *5` |
| `*N?` | Loop up to N, stop on success | `(fix >> test) *3?` |
| `*N!` | Loop up to N, stop on failure | `go *10!` |
| `*?` | Loop until success (max 10) | `(fix >> test) *?` |

### Hooks

| Operator | Meaning | Example |
|----------|---------|---------|
| `@before:CMD` | Run before each step | `@before:rules` |
| `@after:CMD` | Run after each step | `@after:test` |
| `@each:CMD` | Before + after each step | `@each:rev` |

### Variables

| Operator | Meaning | Example |
|----------|---------|---------|
| `$name = CMD` | Capture output into variable | `$report = rev` |
| `$name` | Use variable as input to next step | `fix $report` |
| `$CMD.field` | Access output field | `$test.coverage` |

### Conditionals

| Operator | Meaning | Example |
|----------|---------|---------|
| `if COND >> CMD` | Run if condition true | `if $test.coverage < 90 >> fix` |
| `else >> CMD` | Run if condition false | `else >> ship` |
| `match VAR` | Switch on value | `match $env >> staging: ... >> prod: ...` |

### Error Handling

| Operator | Meaning | Example |
|----------|---------|---------|
| `try (CMDS)` | Try block | `try (go >> test >> ship)` |
| `catch (CMDS)` | Run on error | `catch (rollback >> fix)` |
| `finally (CMDS)` | Always run | `finally (docs >> changelog)` |

### Assertions

| Operator | Meaning | Example |
|----------|---------|---------|
| `assert COND` | Fail pipeline if false | `assert $test.coverage >= 90` |
| `assert files.max_lines <= 100` | Check file constraints | `assert files.max_lines <= 100` |

### Approval Gates

| Operator | Meaning | Example |
|----------|---------|---------|
| `approve "MSG"` | Pause for user confirmation | `approve "Ship to prod?"` |

### Context Blocks

| Operator | Meaning | Example |
|----------|---------|---------|
| `with scope:NAME` | Set scope for block | `with scope:billing (go *3 >> test)` |
| `with model:NAME` | Set AI model for block | `with model:opus (nexa review)` |

### Multi-Repo

| Operator | Meaning | Example |
|----------|---------|---------|
| `in REPO (CMDS)` | Run in specific repo | `in lunaos-engine (test >> ship)` |

### Map/Reduce

| Operator | Meaning | Example |
|----------|---------|---------|
| `map [ITEMS] >> CMD` | Apply to each item | `map [auth, billing, teams] >> (go >> test)` |
| `reduce CMD` | Merge results | `reduce pr` |

### Watch & Events

| Operator | Meaning | Example |
|----------|---------|---------|
| `watch PATH >> CMD` | Run on file change | `watch src/ >> test` |
| `on EVENT >> CMD` | Run on event | `on git:push >> (rev ~~ test) ?>> ship` |

### Timing

| Operator | Meaning | Example |
|----------|---------|---------|
| `timeout Nm CMD` | Timeout after N minutes | `timeout 5m (nexa review)` |
| `retry N CMD` | Retry N times on failure | `retry 3 test` |

### Snapshots

| Operator | Meaning | Example |
|----------|---------|---------|
| `snapshot` | Checkpoint current state | `snapshot >> go *5` |
| `diff` | Show changes since snapshot | `diff >> rev >> pr` |

### Named Workflows

| Operator | Meaning | Example |
|----------|---------|---------|
| `def NAME = PIPE` | Define reusable workflow | `def qg = (rev ~~ test ~~ sec)` |
| `run NAME` | Execute saved workflow | `run qg ?>> ship` |
| `import NAME` | Load from .luna/pipelines/ | `import team-pipeline` |

### Logging

| Operator | Meaning | Example |
|----------|---------|---------|
| `log "MSG"` | Log message to report | `log "Starting deploy"` |

---

## Complete Examples

### Standard Dev Workflow
```
/pipe req >> des >> plan >> go *5 >> rev >> test >> ship
```

### Full Workflow with All Safety Nets
```
/pipe try (
  req >> des >> plan >>
  @before:rules @after:test go *5 >>
  (rev ~~ sec ~~ a11y) >>
  assert $test.coverage >= 90 >>
  assert files.max_lines <= 100 >>
  approve "Ship to production?" >>
  ship >> watch
) catch (
  rollback >> fix >> test
) finally (
  docs >> changelog
)
```

### Quality Gate with Variables
```
/pipe $result = (rev ~~ test ~~ sec) >>
  if $result.pass >> ship >> docs
  else >> fix >> test >> ship
```

### Named Workflows
```
/pipe def quality = (rev ~~ test ~~ sec ~~ a11y)
/pipe def safe-ship = quality ?>> approve "Ship?" >> ship !>> fix >> quality

/pipe go *5 >> run safe-ship >> docs >> changelog
```

### Multi-Repo Deploy
```
/pipe in lunaos-engine (test >> ship) ~~
      in lunaos-dashboard (test >> ship) ~~
      in lunaos-studio (test >> ship) >>
  log "All services deployed"
```

### Map Across Features
```
/pipe map [auth, billing, teams, workflows] >> (
  with scope:$item (go >> test >> rev)
) >> reduce pr
```

### AI Autopilot with Assertions
```
/pipe search "auth patterns" >>
  nexa review >>
  lam "improve auth security" >>
  test >>
  assert $test.pass >>
  assert $test.coverage >= 90 >>
  rev >> pr
```

### Watch Mode (Continuous)
```
/pipe watch src/**/*.ts >> test >> rev
```

### Event-Driven
```
/pipe on git:push >> (rev ~~ test ~~ sec) ?>> ship !>> fix >> test
/pipe on schedule:daily >> deps >> sec >> perf
```

### Retry with Timeout
```
/pipe timeout 10m (nexa review) >> retry 3 (test) >> ship
```

### Snapshot + Diff for Safe Refactoring
```
/pipe snapshot >> refactor *3 >> diff >> test >> rev >> pr
```

### Feature with Auto-Fix Loop
```
/pipe @before:rules feature "add billing page" >>
  (rev ~~ test ~~ sec) ?>> pr
  !>> (fix >> test) *3? >> pr
```

### Brand Launch Pipeline
```
/pipe brand >> auth >> hig >> a11y >>
  test >> approve "Launch?" >>
  ship >> docs >> changelog >>
  log "Launched!"
```

---

## Available Luna Commands

**Workflow**: `req`, `des`, `plan`, `go`, `rev`, `test`, `ship`, `watch`, `retro`
**Autopilot**: `feature`, `parallel`, `fix`, `debug`, `refactor`, `pr`
**Quality**: `rules`, `perf`, `a11y`, `deps`, `mock`, `storybook`
**Code Gen**: `auth`, `brand`, `api-client`, `migrate`, `i18n`, `ci`, `changelog`
**DevOps**: `env`, `rollback`, `dock`, `cf`, `sec`
**AI**: `nexa`, `lam`, `oh`, `chain`, `vision`, `search`, `q`
**Tools**: `hig`, `ui`, `docs`, `cfg`

---

## Execution Rules

1. All commands in a pipe are Luna commands (shortcuts or full names)
2. `>>` sequential — next starts after previous completes
3. `~~` parallel — all start simultaneously
4. `()` groups — treated as single unit
5. `?>>` / `!>>` — branch on success/failure
6. `*N` loops — repeat N times with variants `*N?`, `*N!`, `*?`
7. `@before` / `@after` / `@each` — hooks run on every step
8. `$var` — capture and pass output between steps
9. `if/else/match` — branch on conditions or values
10. `try/catch/finally` — structured error handling
11. `assert` — fail pipeline if condition not met
12. `approve` — pause for human confirmation
13. `with` — set context (scope, model) for a block
14. `in` — target specific repo
15. `map/reduce` — apply pipeline to list, merge results
16. `watch/on` — reactive and event-driven execution
17. `timeout/retry` — timing controls
18. `snapshot/diff` — track changes across pipeline
19. `def/run/import` — named reusable workflows
20. `log` — pipeline logging
21. Scope inheritance — all steps share project context
22. Fail-fast by default — use `?>>` / `!>>` / `try` for control
23. Report generated at `.luna/{project}/pipeline-report.md`
