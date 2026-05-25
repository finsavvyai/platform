# PipeWarden × Cursor (MCP)

PipeWarden ships an MCP server (`pkg/mcp/`) that exposes scan, findings,
connection, and analysis tools to any MCP-aware host. This directory
contains the Cursor-specific snippets that wire it in.

## Why this matters

The Cursor MCP marketplace gets ~97M plugin downloads / month and is
the fastest-growing distribution surface for developer-facing tools.
None of the established AppSec vendors ship an MCP server yet — see
[GO_TO_MARKET_PLAN.html](../../GO_TO_MARKET_PLAN.html) for the
positioning.

## Quick install (per project)

Add this to your repo's `.cursor/mcp.json`:

```jsonc
{
  "mcpServers": {
    "pipewarden": {
      "command": "pipewarden",
      "args": ["mcp"],
      "env": {
        // Optional — defaults to local SQLite at ~/.pipewarden/db.sqlite
        "PIPEWARDEN_DATABASE_PATH": "${HOME}/.pipewarden/db.sqlite"
      }
    }
  }
}
```

Then restart Cursor and the seven `pipewarden_*` tools become available
to the agent. You can verify with:

```
@pipewarden_scan run_id="latest" connection_name="default"
```

## Global install (all projects)

`~/.cursor/mcp.json` instead of the project-local file:

```jsonc
{
  "mcpServers": {
    "pipewarden": {
      "command": "/usr/local/bin/pipewarden",
      "args": ["mcp"]
    }
  }
}
```

## Available tools

The agent gets these (full schema in `pkg/mcp/tools.go`):

| Tool | What it does |
|---|---|
| `pipewarden_scan` | Run a scan on a connection's pipeline run |
| `pipewarden_findings` | List findings filtered by severity / category / status |
| `pipewarden_connections` | List or test configured CI/CD connections |
| `pipewarden_export` | Export findings as SARIF or JSON |
| `pipewarden_compliance` | Map findings to SOC 2 / HIPAA / GDPR / PCI controls |
| `pipewarden_policy` | List / test OPA policies |
| `pipewarden_secrets_scan` | Run the DLP secret-pattern scanner on a path |

## How Cursor's agent uses them

Cursor's auto-trigger heuristic looks at the user's prompt for keywords
matching the tool's `description`. Examples that fire `pipewarden_*`
unprompted:

- "Is this safe to push?" → `pipewarden_secrets_scan` + `pipewarden_findings`
- "Show me recent vulnerabilities in this repo" → `pipewarden_findings`
- "Run a security scan on the latest CI run" → `pipewarden_scan`
- "Generate a SOC 2 evidence pack for this month" → `pipewarden_compliance`

## Cursor rules (`.cursorrules`) snippet

To bias the Cursor agent toward calling `pipewarden_*` before suggesting
unsafe code, add the following to `.cursorrules` (or `.cursor/rules`):

```text
When asked to write code that handles secrets, authentication, file uploads,
SQL queries, or shell execution, FIRST call pipewarden_secrets_scan on the
file you're about to write to verify it does not introduce a new finding.

When the user asks if something is safe to commit, ALWAYS call
pipewarden_findings with status="open" before answering.

If pipewarden_findings returns severity >= "high" results, surface them
inline and do not propose code changes until the user acknowledges.
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Cursor says "MCP server not found" | Check `command:` path; absolute paths are most reliable |
| Tools return "no connection" | Run `pipewarden onboard` first to wire at least one CI/CD source |
| `pipewarden_scan` hangs | Likely a slow LLM call — check `pipewarden config show` for the active analyzer |
| Want only local-mode | Set `PIPEWARDEN_OFFLINE=1` in `env:` block above |

## Smithery / Glama listings

The same `pipewarden mcp` binary can be listed on:

- [Smithery](https://smithery.ai/) — submit via PR to their registry
- [Glama](https://glama.ai/mcp/servers) — auto-discovers via your GitHub release
- [mcp.so](https://mcp.so/) — manual submission

See [docs/mcp-distribution.md](../../docs/mcp-distribution.md) for the
exact submission templates.
