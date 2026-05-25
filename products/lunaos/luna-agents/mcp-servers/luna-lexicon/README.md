# luna-lexicon MCP server

An MCP server that exposes the 277-entry **Luna Pipes** lexicon as discoverable, typed tools so any MCP-compatible AI client (Claude Desktop, Cursor, Windsurf, etc.) can browse, inspect, and compose Luna Pipes natively — without the user having to learn the syntax.

## Tools

| Tool | What it does |
|---|---|
| `list_skills` | Browse the lexicon. Filter by category, status (stable/beta/planned/aux), or substring. |
| `get_skill` | Fetch one skill's full record (gloss, category, status, capability manifest, call signature). |
| `compose_pipe` | Given a plain-language goal, suggest a Luna Pipe expression composed from lexicon skills. |
| `run_skill` | Dry-run plan. v1 does **not** shell out to the `luna` CLI — it returns the call signature and capability manifest so the client can show the user exactly what would happen. |

## Install

```bash
cd mcp-servers/luna-lexicon
npm install
```

## Wire into Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "luna-lexicon": {
      "command": "node",
      "args": ["/absolute/path/to/luna-agents/mcp-servers/luna-lexicon/index.js"]
    }
  }
}
```

Restart Claude. The four tools appear in the tool picker.

## Wire into Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "luna-lexicon": {
      "command": "node",
      "args": ["/absolute/path/to/luna-agents/mcp-servers/luna-lexicon/index.js"]
    }
  }
}
```

## Data source

Skills are loaded at startup from `site/src/data/skills.json`, the same file the `agents.lunaos.ai` site renders. Rebuild it with:

```bash
cd site && node src/scripts/build-lexicon.mjs
```

after editing any `commands/*.md` frontmatter or body.

## Roadmap

- v0.2: real execution via `run_skill` shelling out to `luna` CLI, behind an explicit `--exec` flag and a permission prompt.
- v0.3: capability-based access control — the MCP client can request a capability budget (network, secrets) and skills outside that budget are filtered out of `list_skills`.
- v0.4: shareable pipe URLs with a read-only preview mode (the security model the user asked for).
