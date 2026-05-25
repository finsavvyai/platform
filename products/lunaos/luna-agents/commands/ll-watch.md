---
name: ll-watch-pipe
displayName: Luna Watch
description: Watch file changes and auto-run Luna pipeline on every change
version: 1.0.0
category: workflow
agent: luna-task-executor
parameters:
  - name: path
    type: string
    description: File path or glob to watch (e.g., src/**/*.ts)
    required: true
    prompt: true
  - name: pipeline
    type: string
    description: Luna pipeline to run on change
    required: true
    prompt: true
workflow:
  - setup_file_watcher
  - run_pipeline_on_change
  - report_results
output: []
prerequisites: []
---

# Luna Watch

Auto-run Luna commands when files change.

## Usage

```
/watch-pipe src/**/*.ts >> test
/watch-pipe src/components/ >> (test ~~ rev)
/watch-pipe src/ >> test ?>> ship !>> fix
/watch-pipe prisma/schema.prisma >> migrate >> test
```

## How It Works

1. Watches the specified path for file changes
2. On save/create/delete, runs the Luna pipeline
3. Debounces rapid changes (waits 500ms after last change)
4. Shows results inline
5. Keeps running until you cancel (Ctrl+C)

## Examples

```
# Auto-test on save
/watch-pipe src/ >> test

# Auto-review + test on save
/watch-pipe src/ >> (rev ~~ test)

# Auto-fix accessibility on component change
/watch-pipe src/components/ >> a11y >> hig

# Auto-migrate on schema change
/watch-pipe prisma/ >> migrate >> test

# Full quality check on save
/watch-pipe src/ >> (rev ~~ test ~~ sec) >> log "All passed"
```
