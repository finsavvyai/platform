---
name: luna-docs-generator
description: Generate comprehensive documentation using LunaOS's Documentation agent — API docs, README, architecture docs, user guides
homepage: https://agents.lunaos.ai
---

# Luna Documentation Generator

When the user wants documentation generated for their code, API, or project, use this skill.

## How to use

1. Gather the code or module the user wants documented.

2. Send to the LunaOS Documentation agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "documentation",
    "context": "<the code to document>",
    "useRag": true
  }'
```

3. Parse the SSE response. The agent generates:
   - **API documentation** — endpoints, parameters, responses
   - **README sections** — installation, usage, examples
   - **Architecture docs** — system overview, component relationships
   - **Inline comments** — JSDoc/TSDoc annotations

4. Present the documentation in Markdown format. Offer to write it to a file.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "document this" or "write docs"
- User wants a README generated
- User needs API documentation
- User asks for JSDoc/TSDoc comments
- User wants architecture documentation

## When NOT to use

- Creative writing or blog posts
- Non-technical documentation
