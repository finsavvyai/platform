---
name: luna-routemap
description: Build a routing and navigation map — all pages, dynamic params, guards, middleware, redirects, and navigation hierarchy
homepage: https://agents.lunaos.ai
---

# Luna Route Map Builder

When the user wants a complete routing map of their application showing all pages, navigation paths, guards, and URL structure, use this skill.

## How to use

1. Scan the target codebase for:
   - Route definitions (Next.js App Router, React Router, Express routes, etc.)
   - Dynamic route parameters and catch-all segments
   - Middleware, guards, and auth checks
   - Redirects and rewrites
   - Navigation components (sidebar, tabs, breadcrumbs)
   - API routes and their HTTP methods

2. Send to the LunaOS Route Mapper agent:

```bash
curl -s -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $LUNAOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "route-mapper",
    "context": "<route definitions and navigation data>",
    "useRag": true
  }'
```

3. The agent generates:
   - **Route Table** — every URL path, method, component, and access level
   - **Navigation Tree** — hierarchical Mermaid diagram of the sitemap
   - **Dynamic Routes** — parameterised paths with example values
   - **Auth Matrix** — which routes are public, protected, or admin-only
   - **Middleware Chain** — per-route middleware and guard execution order
   - **API Route Index** — backend endpoints grouped by resource
   - **Redirect Map** — all redirects, rewrites, and fallback routes

4. Save the output to `.luna/{project}/routemap.md`.

## Environment Variables

- `LUNAOS_API_KEY`: Your LunaOS API key

## When to use

- User says "map the routes" or "show all pages"
- User needs a sitemap or navigation structure
- User wants to audit auth guards across routes
- Planning a new page or restructuring navigation

## When NOT to use

- Code-level dependency mapping (use luna-codemap)
- Full architecture design (use luna-architect)
