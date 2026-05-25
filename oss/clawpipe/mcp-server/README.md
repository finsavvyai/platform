# clawpipe-mcp-server

Model Context Protocol server for ClawPipe — expose the intelligent AI pipeline as tools for Claude, ChatGPT, and other AI agents.

## Tools

| Tool | Description |
|------|-------------|
| `clawpipe_prompt` | Send a prompt through the full pipeline (Booster, Pack, Cache, Route, Call, Learn) |
| `clawpipe_analyze_cost` | Estimate cost of a prompt without sending it |
| `clawpipe_stats` | Get current session telemetry snapshot |
| `clawpipe_booster_check` | Check if Booster can resolve a prompt without AI |
| `clawpipe_skill_reasoning` | Root-cause + risk-score a security finding |
| `clawpipe_skill_triage` | Prioritize security findings by actual exploitability |
| `clawpipe_skill_remediation` | Generate a fix plus rollback for a vulnerability |
| `clawpipe_skill_compliance` | Write SOC 2 / ISO 27001 / HIPAA / GDPR audit evidence |
| `clawpipe_skill_threat_intel` | Enrich CVE / IOC with NVD/CIRCL-style context |
| `clawpipe_skill_incident` | Reconstruct attack chain + recommend containment steps |
| `clawpipe_report_to_jira` | Create a Jira issue from a budget breach or anomaly |
| `clawpipe_report_to_notion` | Append a Notion page for cost digests or incident logs |

## Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clawpipe": {
      "command": "npx",
      "args": ["clawpipe-mcp-server"],
      "env": {
        "CLAWPIPE_API_KEY": "cp_xxx"
      }
    }
  }
}
```

### Cursor

Add to Cursor settings → MCP:

```json
{
  "mcpServers": {
    "clawpipe": {
      "command": "npx",
      "args": ["-y", "clawpipe-mcp-server"],
      "env": { "CLAWPIPE_API_KEY": "cp_xxx" }
    }
  }
}
```

### Continue.dev

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "clawpipe-mcp-server"],
          "env": { "CLAWPIPE_API_KEY": "cp_xxx" }
        }
      }
    ]
  }
}
```

### Smithery

One-click install via [smithery.ai/server/clawpipe](https://smithery.ai/server/clawpipe) — the `smithery.yaml` in this repo is the submission manifest.

### Official MCP Registry

Submitted via `server.json` (root of this package). Search "clawpipe" in the [MCP Registry](https://registry.modelcontextprotocol.io).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAWPIPE_API_KEY` | Yes | Your ClawPipe API key |
| `CLAWPIPE_PROJECT_ID` | No | Project ID (defaults to `mcp-default`) |

## Publishing / registration

1. **npm:** `npm publish --access public` (package is `clawpipe-mcp-server`).
2. **Official MCP Registry:** submit `server.json` at https://registry.modelcontextprotocol.io/submit
3. **Smithery:** connect the GitHub repo at https://smithery.ai/new — `smithery.yaml` is auto-detected.
4. **Glama + mcp.so:** both index from GitHub topics. Ensure `mcp` topic is set on the repo.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
