---
name: ll-claude-instructions
displayName: Luna Claude Instructions Builder
description: Generate a comprehensive instructions file for the Claude Chrome browser extension from your codebase
version: 1.0.0
category: documentation
agent: luna-claude-instructions
parameters:
  - name: scope
    type: string
    description: Project or feature scope for instructions generation
    required: true
    prompt: true
workflow:
  - scan_all_pages_and_routes
  - inventory_menus_buttons_forms
  - map_user_flows
  - catalogue_features_and_interactions
  - generate_claude_instructions_file
output:
  - .luna/{current-project}/claude-instructions.md
prerequisites:
  - source_code
---

# Luna Claude Instructions Builder

Generates a comprehensive instructions file for the Claude Chrome browser extension by analysing your entire codebase. The output covers all pages, menus, buttons, flows, routing, and features — ready to paste into the extension.

## What This Command Does

This command crawls your project, inventories every UI element, maps all routes and navigation, documents user flows, and produces a single markdown file optimised for the Claude browser extension's custom instructions field.

## Prerequisites

Requires in your current project:
- Source code with page/route components

No prior Luna artifacts are required — this skill works directly from code.

## Usage Instructions

When you run this command, you'll be prompted for the scope:
- Press **ENTER** for full-project instructions
- Type **feature-name** for feature-specific instructions

## Execution Steps

1. **Page & Route Scan**: Discovers all pages, routes, and URL patterns
2. **UI Inventory**: Catalogues menus, buttons, forms, modals, and interactive elements
3. **Flow Mapping**: Traces user flows from entry to completion
4. **Feature Catalogue**: Groups features with their UI elements and API calls
5. **Instructions Generation**: Produces `claude-instructions.md` for the extension

## Output Files

Creates in your current project:
- `.luna/{current-project}/claude-instructions.md`

The file includes:
- Application overview and tech stack
- Complete page inventory with purpose and UI elements
- Navigation map (sidebar, header, routing hierarchy)
- Feature catalogue with buttons, forms, and actions
- User flow descriptions step-by-step
- Component library reference
- Keyboard shortcuts

## Next Steps in Workflow

After generating instructions:
- Paste into the Claude Chrome extension custom instructions
- Run `/luna-routemap` for a dedicated route-only map
- Run `/luna-flowdocs` for detailed Mermaid flow diagrams

## Tips

- Run this after every major UI change to keep instructions current
- Combine with `/luna-codemap` for a comprehensive developer context
- The output is optimised for AI context — concise but complete
