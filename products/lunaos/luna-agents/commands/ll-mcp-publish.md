---
name: ll-mcp-publish
displayName: Luna MCP Publish
description: Publish your MCP server to Official Registry, Smithery, Glama, and mcp.so — generate server.json, validate, and submit
version: 1.0.0
category: deployment
agent: luna-seo
parameters:
  - name: name
    type: string
    description: "MCP server qualified name (e.g., org/project)"
    required: true
    prompt: true
  - name: npm_package
    type: string
    description: "npm package name (e.g., my-mcp-server)"
    required: true
    prompt: true
  - name: description
    type: string
    description: "Short description (max 100 chars for Official Registry)"
    required: true
    prompt: true
workflow:
  - detect_mcp_tools_from_code
  - generate_server_json
  - generate_glama_json
  - add_mcpName_to_package_json
  - validate_server_json
  - publish_official_registry
  - publish_smithery
  - verify_registration
  - generate_publish_report
output:
  - server.json
  - glama.json
  - package.json (updated with mcpName)
  - .luna/{current-project}/mcp-publish-report.md
mcp_servers:
  - git
  - fetch
---

# /mcp-publish — Publish to Every MCP Registry

One command to publish your MCP server to all registries where AI agents discover tools.

## Registries

| Registry | Method | Status |
|----------|--------|--------|
| **Official MCP Registry** | `mcp-publisher publish` | Primary — used by Claude, Cursor |
| **Smithery** | `smithery mcp publish` | 100K+ tools marketplace |
| **Glama** | `glama.json` in repo | Auto-indexes from GitHub |
| **mcp.so** | API submission | Community registry |

## Prerequisites

```bash
# Official MCP Registry CLI
brew install mcp-publisher

# Smithery CLI
npx @smithery/cli@latest auth login

# npm package must be published
npm publish
```

## server.json Format (Official Registry)

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "{org}/{project}",
  "description": "{max 100 chars}",
  "repository": {
    "url": "https://github.com/{org}/{project}",
    "source": "github"
  },
  "version": "1.0.0",
  "packages": [{
    "registryType": "npm",
    "identifier": "{npm-package}",
    "version": "1.0.0",
    "transport": { "type": "stdio" }
  }]
}
```

## Workflow

```
/mcp-publish --name finsavvyai/pushci --npm_package pushci --description "AI-native zero-config CI/CD"
    │
    ├── Scan code for MCP tool definitions
    ├── Generate server.json (Official Registry format)
    ├── Generate glama.json (Glama auto-index)
    ├── Add mcpName to package.json
    ├── Validate: mcp-publisher validate
    ├── Publish: mcp-publisher publish
    ├── Publish: smithery mcp publish
    └── Report: registries published, verification URLs
```
