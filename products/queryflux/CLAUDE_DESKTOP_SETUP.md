# Claude Desktop MCP Integration Guide

## Quick Setup

1. **Open Claude Desktop config**:

```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. **Add QueryFlux MCP server**:

```json
{
  "mcpServers": {
    "queryflux": {
      "command": "node",
      "args": [
        "/Users/shaharsolomon/dev/projects/03_Enterprize_application/products/data-intelligence/queryflux-mcp-server/dist/index.js"
      ],
      "env": {
        "QUERYFLUX_API_URL": "https://queryflux-backend-prod.broad-dew-49ad.workers.dev"
      }
    }
  }
}
```

3. **Restart Claude Desktop**

4. **Test with a query**:

Ask Claude: "Using QueryFlux, show me all users in the database"

---

## Available Tools

| Tool | Description |
|------|-------------|
| `execute_query` | Execute SQL queries |
| `get_schema` | Get database schema |
| `natural_language_query` | Convert natural language to SQL |
| `create_migration` | Generate SQL migrations |
| `seed_test_data` | Insert test data |
| `explain_query` | Explain SQL queries |

---

## Troubleshooting

### Issue: "MCP server not found"

**Fix**: Make sure the path to `dist/index.js` is correct

```bash
ls -la /Users/shaharsolomon/dev/projects/03_Enterprize_application/products/data-intelligence/queryflux-mcp-server/dist/index.js
```

### Issue: "Connection refused"

**Fix**: Verify the backend is running:

```bash
curl https://queryflux-backend-prod.broad-dew-49ad.workers.dev/health
```

Should return: `{"status":"healthy","environment":"production"}`

---

## Example Queries

**List all tables**:
```
Using QueryFlux, show me all tables in the database
```

**Count users**:
```
Using QueryFlux, count how many users we have
```

**Get schema**:
```
Using QueryFlux, show me the schema for the users table
```

---

**Backend URL**: https://queryflux-backend-prod.broad-dew-49ad.workers.dev
**Status**: ✅ Live and operational
