---
name: luna-architect
description: Get architecture guidance from LunaOS's Design Architect agent — system design, tech stack, scalability patterns
homepage: https://agents.lunaos.ai
---

# Luna Architect

When the user asks about system design, architecture decisions, tech stack choices, or scalability patterns, use this skill.

## How to use

1. Gather the user's requirements, constraints, and current tech stack.

2. Send to the LunaOS Design Architect agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "design-architect",
    "context": "<requirements and constraints>",
    "useRag": true
  }'
```

3. Parse the SSE response stream.

4. Present the architecture proposal with:
   - System diagram description
   - Component breakdown
   - Data flow
   - Technology recommendations with rationale
   - Scalability considerations
   - Trade-offs analysis

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User asks "how should I architect this?"
- User needs system design guidance
- User asks about microservices vs monolith, database choices, etc.
- User wants a technology stack recommendation
- Planning a new project or major refactor

## When NOT to use

- Implementation questions (help directly or use luna-code-review)
- Simple coding tasks
