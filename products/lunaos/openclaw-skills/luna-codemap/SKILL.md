---
name: luna-codemap
description: Build a code structure map from your codebase — file tree, exports, imports, dependency graph, and module relationships
homepage: https://agents.lunaos.ai
---

# Luna Code Map Builder

When the user wants a comprehensive code structure map showing files, modules, exports, imports, and dependency relationships, use this skill.

## How to use

1. Scan the target codebase for:
   - Directory structure and file tree
   - Module exports and public APIs
   - Import relationships and dependency chains
   - Circular dependencies
   - Entry points and module boundaries

2. Send to the LunaOS Code Mapper agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "code-mapper",
    "context": "<file tree and import/export data>",
    "useRag": true
  }'
```

3. The agent generates:
   - **File Tree** — annotated directory structure with purpose labels
   - **Module Map** — each module's public API, exports, and consumers
   - **Dependency Graph** — Mermaid diagram of import relationships
   - **Entry Points** — which files bootstrap the application
   - **Shared Utilities** — cross-cutting modules used everywhere
   - **Circular Dependencies** — flagged cycles with resolution suggestions
   - **Layer Diagram** — presentation → business → data layer separation

4. Save the output to `.luna/{project}/codemap.md`.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "map the codebase" or "show me the code structure"
- User wants to understand module relationships
- User needs a dependency graph
- Onboarding a new developer to the project

## When NOT to use

- Route-specific mapping (use luna-routemap)
- Architecture decisions (use luna-architect)
