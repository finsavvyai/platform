---
name: luna-test-writer
description: Generate comprehensive test suites using LunaOS's Testing & Validation agent — unit, integration, and e2e tests
homepage: https://agents.lunaos.ai
---

# Luna Test Writer

When the user wants tests written for their code, use this skill to generate comprehensive test suites.

## How to use

1. Read the source code the user wants tests for.

2. Send to the LunaOS Testing agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "testing-validation",
    "context": "<the source code to write tests for>",
    "useRag": true
  }'
```

3. Parse the SSE response. The agent outputs ready-to-use test files.

4. Present the tests organized by type:
   - **Unit tests** — individual function testing with mocks
   - **Integration tests** — component interaction testing
   - **Edge cases** — boundary conditions, error paths, null handling

5. Offer to write the test files to disk.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "write tests" or "generate tests"
- User asks for test coverage
- User wants to test a specific function or module
- User asks about testing strategy

## When NOT to use

- Running existing tests (use `exec` directly)
- Debugging test failures (analyze the failure first)
