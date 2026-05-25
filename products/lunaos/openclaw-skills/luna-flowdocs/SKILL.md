---
name: luna-flowdocs
description: Document all user flows, skills, and interactions with Mermaid diagrams — from code analysis, not guesswork
homepage: https://agents.lunaos.ai
---

# Luna Flow & Skills Documentation Builder

When the user wants comprehensive documentation of all user flows, interaction patterns, skills, and feature behaviours generated from the actual codebase, use this skill.

## How to use

1. Analyze the target codebase for:
   - User-facing workflows (signup, checkout, onboarding, CRUD operations)
   - State machines and multi-step processes
   - Event handlers and user interactions
   - Agent skills and their triggers/outputs
   - Error paths and fallback behaviours
   - Role-based flows (admin vs user vs guest)

2. Send to the LunaOS Flow Documenter agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "flow-documenter",
    "context": "<flow and interaction data>",
    "useRag": true
  }'
```

3. The agent generates:
   - **Flow Catalogue** — every user flow with entry point, steps, and exit conditions
   - **Sequence Diagrams** — Mermaid sequence diagrams for key interactions
   - **State Diagrams** — state machines for multi-step processes
   - **Skills Registry** — each agent skill with trigger, input, output, and examples
   - **Interaction Matrix** — buttons/actions mapped to their effects and API calls
   - **Error Flow Diagrams** — what happens when things go wrong
   - **Permission Map** — which roles can perform which flows

4. Save the output to `.luna/{project}/flowdocs.md`.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "document the flows" or "map user interactions"
- User wants Mermaid diagrams of their app's behaviour
- User needs skills/agent documentation
- QA team needs flow specifications for test cases

## When NOT to use

- Route-only mapping (use luna-routemap)
- Code structure mapping (use luna-codemap)
