---
name: Bug Report
about: Something isn't working
title: "[BUG] "
labels: bug, needs-triage
assignees: ''
---

## Describe the bug

<!-- A clear description of what the bug is -->

## To reproduce

Steps to reproduce the behaviour:

1. Start gateway with `...`
2. Call `curl ...`
3. See error

## Expected behaviour

<!-- What you expected to happen -->

## Actual behaviour

<!-- What actually happened — include full error message / stack trace -->

```
paste error here
```

## Environment

| Field | Value |
|-------|-------|
| FinSavvyAI version | `finsavvyai --version` |
| Python version | `python --version` |
| OS | e.g. macOS 14, Ubuntu 22.04 |
| Install method | Docker / pip / git clone |
| Provider(s) | OpenAI / Anthropic / Ollama / Local |

## Gateway health output

```bash
curl http://localhost:8080/health?verbose=true
```

```json
paste output here
```

## Doctor output

```bash
finsavvyai doctor
```

```
paste output here
```

## Additional context

<!-- Add any other context, screenshots, or log snippets -->
