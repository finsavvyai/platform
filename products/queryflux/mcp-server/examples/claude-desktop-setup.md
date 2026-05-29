# Claude Desktop MCP Integration - Setup Guide

## Prerequisites

- Claude Desktop installed
- QueryFlux backend running (http://localhost:8080)
- MCP server built (`npm run build`)

## Step 1: Build MCP Server

```bash
cd /Users/shaharsolomon/dev/projects/03_Enterprize_application/products/data-intelligence/queryflux-mcp-server
npm run build
```

Verify `dist/index.js` exists.

## Step 2: Configure Claude Desktop

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "queryflux": {
      "command": "node",
      "args": [
        "/Users/shaharsolomon/dev/projects/03_Enterprize_application/products/data-intelligence/queryflux-mcp-server/dist/index.js"
      ],
      "env": {
        "QUERYFLUX_API_URL": "http://localhost:8080"
      }
    }
  }
}
```

## Step 3: Restart Claude Desktop

Quit Claude Desktop completely and restart.

## Step 4: Test MCP Tools

### Test 1: Get Database Schema

In Claude Desktop:
```
Can you show me the database schema using QueryFlux?
```

Expected: Claude uses `get_schema` tool and displays table structure.

### Test 2: Execute Query

```
Using QueryFlux, execute: SELECT * FROM users LIMIT 3
```

Expected: Claude uses `execute_query` tool and shows results.

### Test 3: Natural Language Query

```
Using QueryFlux, show me all users who registered in the last 7 days
```

Expected: Claude uses `natural_language_query` tool to generate SQL, then executes it.

## Troubleshooting

### MCP Server Not Showing Up

1. Check config file syntax (valid JSON)
2. Verify file path is absolute
3. Check Claude Desktop logs:
   ```bash
   tail -f ~/Library/Logs/Claude/mcp*.log
   ```

### Connection Errors

1. Verify QueryFlux backend is running:
   ```bash
   curl http://localhost:8080/health
   ```
2. Check MCP server can connect:
   ```bash
   node dist/index.js
   ```

### Tool Execution Fails

1. Check QueryFlux backend logs
2. Verify database connection
3. Test API endpoints manually with curl

## Expected Behavior

When working correctly:
- Claude will mention "using QueryFlux" when executing database operations
- You'll see tool invocations in the chat
- Results will be formatted nicely by Claude
- Errors will be explained clearly

## Advanced Usage

### Dry Run Queries

```
Using QueryFlux, validate this query (dry run):
SELECT * FROM users WHERE invalid_column = 1
```

Claude should use `execute_query` with `dry_run: true`.

### Schema Exploration

```
What tables are in the QueryFlux database? What columns does the users table have?
```

Claude should use `get_schema` and parse the results.

### Natural Language Queries

```
Show me:
- Total number of users
- Users registered this month
- Most active database connections
```

Claude should convert each to SQL using `natural_language_query`.

## Success Criteria

- [ ] Claude Desktop shows QueryFlux in available tools
- [ ] Can execute simple SELECT queries
- [ ] Schema introspection works
- [ ] Natural language queries generate valid SQL
- [ ] Dry run validation catches errors
- [ ] Error messages are helpful

## Next Steps

Once basic integration works:
1. Test with complex queries (JOINs, aggregations)
2. Try natural language migrations
3. Test performance with large result sets
4. Explore multi-step workflows
