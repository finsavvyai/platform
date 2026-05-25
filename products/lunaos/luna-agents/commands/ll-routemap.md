---
name: ll-routemap
displayName: Luna Route Map Builder
description: Build a complete routing and navigation map with pages, params, guards, and auth matrix
version: 1.0.0
category: documentation
agent: luna-route-mapper
parameters:
  - name: scope
    type: string
    description: Project or app scope for route mapping
    required: true
    prompt: true
workflow:
  - discover_route_definitions
  - extract_dynamic_params_and_middleware
  - map_navigation_hierarchy
  - build_auth_matrix
  - generate_routemap_document
output:
  - .luna/{current-project}/routemap.md
prerequisites:
  - source_code
---

# Luna Route Map Builder

Builds a complete routing and navigation map showing all pages, dynamic parameters, middleware chains, auth guards, redirects, and API routes.

## What This Command Does

This command discovers all route definitions in your project (Next.js App Router, React Router, Express, etc.), maps their relationships, and produces a visual navigation hierarchy with auth matrix.

## Prerequisites

Requires in your current project:
- Source code with route/page definitions

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full-project route map
- Type **app-name** to scope to a specific application

## Execution Steps

1. **Route Discovery**: Finds all route definitions and page components
2. **Parameter Extraction**: Maps dynamic segments and catch-all routes
3. **Navigation Hierarchy**: Builds tree of sidebar, tabs, breadcrumb navigation
4. **Auth Matrix**: Documents which routes are public, protected, or admin-only
5. **Map Generation**: Produces `routemap.md` with Mermaid diagrams

## Output Files

Creates in your current project:
- `.luna/{current-project}/routemap.md`

Includes:
- Route table (URL, method, component, access level)
- Mermaid navigation tree
- Dynamic routes with example values
- Auth guard matrix
- Middleware execution order per route
- API route index grouped by resource
- Redirect and rewrite map

## Next Steps in Workflow

After route mapping:
```
/luna-flowdocs    # Document user flows across routes
/luna-hld         # Generate full HLD from code
```

## Tips

- Pair with `/luna-codemap` for a complete project overview
- The auth matrix helps catch unprotected routes
- Update after adding new pages or changing navigation
