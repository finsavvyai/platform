---
name: ll-workflow
displayName: Luna Workflow Manager
description: Save, load, list, and share named pipeline workflows
version: 1.0.0
category: workflow
agent: luna-task-executor
parameters:
  - name: action
    type: string
    description: Action (save, load, list, delete, share, templates)
    required: true
    prompt: true
  - name: name
    type: string
    description: Workflow name
    required: false
    prompt: true
workflow:
  - parse_action
  - execute_workflow_action
  - update_workflow_registry
output:
  - .luna/pipelines/
prerequisites: []
---

# Luna Workflow Manager

Save, load, and share reusable pipeline workflows.

## Actions

### Save a workflow
```
/workflow save quality-gate "(rev ~~ test ~~ sec ~~ a11y)"
/workflow save safe-ship "quality-gate ?>> approve 'Ship?' >> ship"
/workflow save full-dev "req >> des >> plan >> @before:rules @after:test go *10! >> run quality-gate >> ship"
```

### Load and run a workflow
```
/pipe run quality-gate
/pipe run safe-ship
/pipe go *5 >> run quality-gate ?>> pr
```

### List saved workflows
```
/workflow list
```

### Delete a workflow
```
/workflow delete old-pipeline
```

### Templates — pre-built workflows
```
/workflow templates
```

Shows built-in templates you can install:

| Template | Pipeline | Install |
|----------|----------|---------|
| `full-dev` | `req >> des >> plan >> go *5 >> rev >> test >> ship >> docs >> watch` | `/workflow save full-dev ...` |
| `quality-gate` | `(rev ~~ test ~~ sec ~~ a11y)` | `/workflow save quality-gate ...` |
| `safe-ship` | `quality-gate ?>> approve "Ship?" >> ship !>> fix >> test` | `/workflow save safe-ship ...` |
| `ai-review` | `search >> nexa review >> nexa bugs >> fix >> test >> pr` | `/workflow save ai-review ...` |
| `quick-fix` | `(fix >> test) *3? >> pr` | `/workflow save quick-fix ...` |
| `feature-auto` | `@before:rules @after:test feature >> (rev ~~ sec) ?>> pr` | `/workflow save feature-auto ...` |
| `brand-launch` | `brand >> auth >> hig >> test >> ship >> docs >> changelog` | `/workflow save brand-launch ...` |
| `refactor-safe` | `snapshot >> @after:test refactor *3 >> diff >> rev >> pr` | `/workflow save refactor-safe ...` |
| `multi-deploy` | `map [engine, dashboard, studio] >> in $item (test >> ship)` | `/workflow save multi-deploy ...` |
| `nightly` | `on schedule:daily >> deps >> sec >> perf >> changelog` | `/workflow save nightly ...` |

## Storage

Workflows are saved to `.luna/pipelines/{name}.pipe`:

```
.luna/pipelines/
  quality-gate.pipe
  safe-ship.pipe
  full-dev.pipe
```

Each `.pipe` file contains the pipeline expression and metadata:
```yaml
name: quality-gate
description: Parallel quality checks — review, test, security, accessibility
created: 2026-03-29
pipeline: (rev ~~ test ~~ sec ~~ a11y)
```

## Usage in Pipes

```
# Reference by name
/pipe run quality-gate ?>> ship

# Chain multiple workflows
/pipe run full-dev >> run quality-gate >> run safe-ship

# Use in def
/pipe def my-flow = go *5 >> run quality-gate >> pr
```
