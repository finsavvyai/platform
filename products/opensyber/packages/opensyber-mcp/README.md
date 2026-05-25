# @opensyber/mcp

MCP (Model Context Protocol) server for OpenSyber. Gives AI agents like Claude Desktop, Cursor, and Claude Code direct access to security monitoring, dependency scanning, and threat intelligence.

## Installation

```bash
npm install @opensyber/mcp
# or
pnpm add @opensyber/mcp
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "opensyber": {
      "command": "npx",
      "args": ["-y", "@opensyber/mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "opensyber": {
      "command": "npx",
      "args": ["-y", "@opensyber/mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add opensyber -- npx -y @opensyber/mcp
```

## Available Tools

### `opensyber_scan_dependency`

Check if an npm package is safe to install. Returns a safety verdict (safe / suspicious / malicious) with reasons and known CVEs.

**Parameters:**
- `package` (required) — npm package name (e.g. `"lodash"`)
- `version` (optional) — specific version to check (e.g. `"4.17.21"`)

**Example prompt:** "Is the event-stream npm package safe to use?"

### `opensyber_check_security`

Get a security score for a project. Returns a breakdown across 8 categories: dependencies, secrets, authentication, input validation, encryption, logging, access control, and infrastructure.

**Parameters:**
- `projectPath` (optional) — absolute path to the project root

**Example prompt:** "Run a security check on my project."

### `opensyber_query_threats`

Get current AI agent threat intelligence. Returns recent threats including prompt injection, supply chain attacks, and model exfiltration attempts.

**Parameters:**
- `severity` (optional) — minimum severity: `"critical"`, `"high"`, or `"medium"`

**Example prompt:** "What are the latest critical threats targeting AI agents?"

### `opensyber_list_skills`

Browse the OpenSyber audited skill marketplace. Lists available security skills that agents can install.

**Parameters:**
- `category` (optional) — filter by `"monitoring"`, `"scanning"`, `"compliance"`, `"networking"`, or `"infrastructure"`

**Example prompt:** "Show me available security scanning skills."

### `opensyber_protect`

Generate a security configuration for a web framework. Returns integration code with TokenForge device binding, rate limiting, CORS, and CSP headers.

**Parameters:**
- `framework` (required) — `"express"`, `"hono"`, `"nextjs"`, or `"fastify"`

**Example prompt:** "Generate security config for my Hono API."

## Development

```bash
# Run locally
pnpm dev

# Build
pnpm build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```

## License

MIT
