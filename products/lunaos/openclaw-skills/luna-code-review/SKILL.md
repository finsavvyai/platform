---
name: luna-code-review
description: Run a deep code review using LunaOS's specialized Code Review agent — catches bugs, anti-patterns, and provides actionable fixes
homepage: https://agents.lunaos.ai
---

# Luna Code Review

When the user asks for a code review, code analysis, code quality feedback, or wants to find bugs in their code, use this skill.

## How to use

1. Gather the code the user wants reviewed. If they reference files, read them first.

2. Send the code to the LunaOS Code Review agent via API:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-review",
    "context": "<paste the code here>",
    "useRag": true
  }'
```

3. The response streams as SSE events. Parse `data:` lines — each contains a JSON object with `type` and `text` fields. Concatenate all `text` values from `chunk` events.

4. Present findings organized by severity:
   - 🔴 **Critical** — bugs, security issues, crashes
   - 🟡 **Warning** — anti-patterns, performance issues, maintainability
   - 🟢 **Suggestion** — style improvements, readability, modern idioms

5. For each issue, show the problematic code AND the fix.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key. Get one at https://agents.lunaos.ai/dashboard/api-keys

## When to use

- User says "review this code" or "check my code"
- User asks "are there any bugs?"
- User wants code quality feedback
- User asks for best practices review

## When NOT to use

- Simple syntax questions — just answer directly
- Explaining what code does — no agent needed
- Non-code conversations
