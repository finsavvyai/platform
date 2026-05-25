---
name: luna-claude-instructions
description: Generate a Claude browser-extension instructions file from your codebase — all menus, buttons, flows, pages, routing map, and UI inventory
homepage: https://agents.lunaos.ai
---

# Luna Claude Instructions Builder

When the user wants to generate an instructions file for the Claude Chrome browser extension that covers their entire application, use this skill.

## How to use

1. Crawl the target codebase and collect:
   - All page/route components and their paths
   - Navigation menus and sidebar items
   - Buttons, form actions, and interactive elements
   - User flows (login → dashboard → settings, etc.)
   - Feature flags and conditional UI

2. Send to the LunaOS Claude Instructions agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "claude-instructions",
    "context": "<collected UI inventory JSON>",
    "useRag": true
  }'
```

3. The agent generates a structured instructions markdown file containing:
   - **Application Overview** — purpose, tech stack, key concepts
   - **Page Inventory** — every route with its purpose, key UI elements, and data sources
   - **Navigation Map** — sidebar, header, breadcrumbs, and routing hierarchy
   - **Feature Catalogue** — each feature with its buttons, forms, and actions
   - **User Flow Diagrams** — end-to-end journeys described step-by-step
   - **Component Library** — reusable components and their props/variants
   - **Keyboard Shortcuts** — global and per-page hotkeys

4. Save the output to `.luna/{project}/claude-instructions.md` for paste into the extension.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "generate Claude instructions" or "build extension instructions"
- User wants a comprehensive guide for the Claude browser extension
- User needs a full UI inventory of their app
- User wants all pages, menus, and buttons documented for AI context

## When NOT to use

- Generic documentation (use luna-docs-generator)
- Architecture-only docs (use luna-architect)
