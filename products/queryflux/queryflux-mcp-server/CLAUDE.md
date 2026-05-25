# QueryFlux MCP Server — CLAUDE.md

> **Portfolio Tracker**: `../../../portfolio-tracker.html` | **Readiness**: 25% | **Category**: BUILD

## Mission
Model Context Protocol (MCP) server enabling AI agents (Claude, Cursor, etc.) to safely interact with databases through natural language, SQL generation, migration, and query optimization.

## Code Map & Index

### Directory Structure
```
queryflux-mcp-server/
├── src/                            # TypeScript source (4 files)
│   ├── index.ts                    # MCP server entry, stdio transport
│   ├── tools/                      # Tool implementations
│   │   ├── execute-query.ts        # Execute SQL safely
│   │   ├── get-schema.ts           # Database introspection
│   │   ├── natural-language-query.ts  # NL→SQL via QueryLens
│   │   ├── create-migration.ts     # Generate migrations (up/down)
│   │   ├── seed-test-data.ts       # Generate realistic test data
│   │   └── explain-query.ts        # Query plan analysis
│   ├── services/
│   │   ├── api-client.ts           # QueryFlux backend HTTP client
│   │   ├── validation.ts           # Input validation, safety
│   │   └── formatting.ts           # Response formatting
│   └── types.ts                    # TypeScript interfaces
├── dist/                           # Compiled JavaScript
├── examples/                       # Usage examples
│   ├── claude-desktop-config.json  # Configuration reference
│   └── sample-queries.md           # Example prompts
├── tests/                          # Jest test suite
│   ├── tools.test.ts
│   └── api-client.test.ts
├── package.json                    # npm configuration
├── tsconfig.json                   # TypeScript config
├── jest.config.js                  # Jest configuration
├── .env.example                    # Environment template
└── README.md                       # Usage guide

### Compiled Output Structure
```
dist/
├── index.js                        # Runnable MCP server
├── tools/
│   ├── execute-query.js
│   ├── get-schema.js
│   └── ...
├── services/
│   ├── api-client.js
│   └── ...
└── types.js
```

### Key Files Index
| File | Purpose | Language | Lines |
|------|---------|----------|-------|
| `src/index.ts` | MCP server, stdio transport, tool registration | TS | 80 |
| `src/tools/execute-query.ts` | SQL execution with safety checks | TS | 120 |
| `src/tools/natural-language-query.ts` | NL→SQL conversion, calls QueryLens | TS | 100 |
| `src/tools/create-migration.ts` | Generate reversible migrations | TS | 140 |
| `src/tools/seed-test-data.ts` | AI-powered test data generation | TS | 130 |
| `src/tools/explain-query.ts` | Query plan analysis, optimization tips | TS | 110 |
| `src/services/api-client.ts` | HTTP client to QueryFlux backend | TS | 90 |
| `package.json` | npm scripts, dependencies | JSON | 40 |

## Development Guidelines

### Code Design Standards
- **Max 200 lines per tool** — Each tool = one focused capability
- **Single Responsibility** — One tool = one operation (execute, introspect, generate, explain)
- **Type Safety** — Strict TypeScript with full type coverage
- **Error Handling** — Never silently fail; return detailed error messages for Claude to understand
- **Naming** — camelCase for functions/variables, descriptive tool names
- **Safety First** — All tools validate input, check permissions, prevent injections
- **Async/Await** — All async operations properly awaited, no dangling promises

### Architecture Patterns

#### MCP Tool Registration
```typescript
// index.ts - Server initialization
const mcp = new Server({
  name: "queryflux",
  version: "1.0.0",
})

// Register tools
mcp.tool("execute_query", {
  description: "Execute SQL with safety checks and dry-run mode",
  inputSchema: {
    type: "object",
    properties: {
      database_id: { type: "string" },
      sql: { type: "string" },
      dry_run: { type: "boolean" },
    },
    required: ["database_id", "sql"],
  },
  handler: executeQuery,
})

// Start stdio transport
mcp.connect(new StdioServerTransport())
```

#### Tool Implementation Pattern
```typescript
async function executeQuery(input: ExecuteQueryInput): Promise<ExecuteQueryResponse> {
  // 1. Validate input
  validateSQL(input.sql)

  // 2. Check permissions
  await checkPermission(input.database_id, "execute")

  // 3. Dry-run (show plan without executing)
  if (input.dry_run) {
    const plan = await client.explainQuery(input.database_id, input.sql)
    return { plan, dry_run: true }
  }

  // 4. Execute safely
  const result = await client.executeQuery(input.database_id, input.sql, {
    timeout: 30000,
    max_rows: 10000,
  })

  // 5. Format response for Claude
  return {
    success: true,
    rows: result.rows,
    columns: result.columns,
    execution_time_ms: result.duration,
  }
}
```

#### Error Response Pattern
```typescript
// Tool returns structured error
{
  type: "error",
  message: "SQL Syntax Error in line 2: Missing FROM clause",
  code: "SYNTAX_ERROR",
  suggestion: "Did you mean: SELECT * FROM users LIMIT 10?"
}

// Claude can interpret and suggest fix
```

### Tool Design Patterns

#### 1. Execute Query Tool
- **Purpose**: Run SQL safely in a database
- **Inputs**: `database_id`, `sql`, `dry_run` (optional), `timeout` (optional)
- **Safety**: Parameterized queries, timeout after 30s, max 10k rows
- **Output**: `{rows, columns, execution_time_ms}`
- **Errors**: SYNTAX_ERROR, TIMEOUT, PERMISSION_DENIED, INVALID_SQL

#### 2. Get Schema Tool
- **Purpose**: Introspect database structure
- **Inputs**: `database_id`
- **Output**: `{tables: [{name, columns: [{name, type, nullable}], indexes, constraints}]}`
- **Use Case**: Claude uses this to generate SQL with correct column names

#### 3. Natural Language Query Tool
- **Purpose**: Convert natural language to SQL
- **Inputs**: `question` (string), `database_id` (optional, for schema context)
- **Flow**: Call QueryLens API → Get SQL + confidence → Return to Claude
- **Output**: `{sql, confidence: 0-1, explanation}`
- **Fallback**: If QueryLens unavailable, return error for Claude to retry

#### 4. Create Migration Tool
- **Purpose**: Generate reversible database migrations
- **Inputs**: `description`, `up_sql` (optional for AI generation), `database_id`
- **Output**: `{up_migration, down_migration, warnings}`
- **Validation**: Check for unsafe operations (DROP without backup)
- **Example Output**:
  ```sql
  -- Up Migration
  ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE;
  CREATE INDEX idx_users_email ON users(email);

  -- Down Migration
  DROP INDEX idx_users_email;
  ALTER TABLE users DROP COLUMN email;
  ```

#### 5. Seed Test Data Tool
- **Purpose**: Generate realistic test data
- **Inputs**: `table_name`, `row_count`, `database_id`
- **Logic**: Analyze schema → Generate contextual data → Respect foreign keys
- **Output**: `{insert_statement, preview: [{id, name, email, ...}]}`
- **Example**: For `users` table, generates valid emails, real-looking names

#### 6. Explain Query Tool
- **Purpose**: Analyze query performance and optimization
- **Inputs**: `sql`, `database_id`
- **Output**: `{execution_plan, slow_operations, suggestions: [{index, rewrite, impact}]}`
- **Example Suggestion**: "Missing index on orders.created_at (cost reduction: 90%)"

### Code Review Checklist
- [ ] Each tool file ≤ 200 lines
- [ ] All public functions have JSDoc comments
- [ ] No `any` types; strict TypeScript enabled
- [ ] Input validation for all tool parameters
- [ ] Error responses include helpful context for Claude
- [ ] Async operations properly awaited (no dangling promises)
- [ ] No hardcoded API URLs (use .env or process.env)
- [ ] All error cases tested
- [ ] Follows MCP protocol (tool registration, input schema, response format)

## Testing Strategy

### Unit Tests — Full Coverage Required

#### Framework
- **Framework**: Jest + supertest
- **Coverage Target**: 95% lines, 90% branches
- **Run**: `npm test` or `npm run test:watch`

#### Key Tests

**execute-query.ts**
```typescript
✅ Valid SQL returns formatted rows
✅ Invalid SQL returns SYNTAX_ERROR
✅ Long-running query times out (>30s)
✅ Dry-run shows execution plan without executing
✅ Results paginated to 10k rows max
✅ Parameterized queries prevent SQL injection
✅ Proper error messages for Claude to understand
```

**natural-language-query.ts**
```typescript
✅ "Show users from last 7 days" → correct SQL
✅ Includes database schema in context
✅ Confidence score between 0 and 1
✅ Timeout after 5s QueryLens call
✅ Fallback error if QueryLens unavailable
✅ Explanation field populated
```

**create-migration.ts**
```typescript
✅ Generate up/down migrations
✅ Validate migration safety (warn on DROP)
✅ Format SQL consistently
✅ Include foreign key constraints
✅ Reversible (up then down returns to original)
```

**seed-test-data.ts**
```typescript
✅ Generate requested number of rows
✅ Respect column types (email, phone, date)
✅ Foreign keys reference existing IDs
✅ Realistic data (not random strings)
✅ Respect constraints (unique, not null)
```

**explain-query.ts**
```typescript
✅ Return execution plan from PostgreSQL
✅ Identify sequential scans (slow)
✅ Suggest missing indexes
✅ Estimate performance impact
✅ Provide rewrite suggestions
```

**api-client.ts**
```typescript
✅ Correctly formats API requests
✅ Handles HTTP errors (500, 404, etc.)
✅ Retries on rate limit (429)
✅ Timeout after 30s
✅ Parses JSON responses
```

### Manual Testing (Claude Desktop)

**Flow 1: Ask Claude to Run a Query**
```
User: "How many users registered this week?"
Claude: Uses natural_language_query → get_schema → execute_query
Result: "42 users registered this week"
```

**Flow 2: Generate Migration**
```
User: "Add an email field to users, make it unique"
Claude: Uses create_migration
Result: "Migration created with up/down SQL"
```

**Flow 3: Optimize Slow Query**
```
User: "Why is my orders query slow?"
Claude: Uses explain_query → Suggests indexes → explain_query again to verify
Result: "Add index on orders.created_at, improves by 90%"
```

## Commands

### Development
```bash
# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Watch mode (rebuild on save)
npm run build:watch

# Development with file watcher
npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Integration
```bash
# Test MCP stdio transport
./test-mcp-stdio.sh

# Test with actual Claude Desktop
# 1. Build: npm run build
# 2. Update claude_desktop_config.json with correct path
# 3. Restart Claude Desktop
# 4. Test in conversation
```

## What's Done vs What's Left

### Completed
- MCP server scaffold with stdio transport
- Tool registration framework
- TypeScript configuration
- Test framework (Jest)
- Documentation and examples

### In Progress
- execute_query tool implementation
- get_schema tool implementation
- natural_language_query integration with QueryLens
- Input validation and error handling

### Critical Path to Production
1. **Week 1**: execute_query + get_schema (core tools)
2. **Week 2**: natural_language_query (connect to QueryLens API)
3. **Week 3**: create_migration + seed_test_data
4. **Week 4**: explain_query + optimization suggestions
5. **Week 5**: Error handling, validation, safety checks
6. **Week 6**: Testing, documentation, production readiness

## Competitors & Market Context

### Similar Implementations
- **Custom LLM Integrations**: ChatGPT plugins (limited)
- **Langchain Tools**: Generic database access (no safety)
- **Retool API**: Visual data integration (expensive)

### QueryFlux MCP Advantages
- **Safety-First**: Dry-run, timeout, max result limits
- **AI-Aware**: Responses formatted for Claude's understanding
- **Multi-Database**: Works with any database QueryFlux supports
- **Advanced Tools**: Migration generation, test data, query optimization
- **Easy Integration**: Config file in Claude Desktop, no setup needed

### Use Cases
1. **Developers**: Ask Claude to write queries, generate migrations
2. **DBAs**: Optimization analysis, performance troubleshooting
3. **Data Analysts**: Quick ad-hoc queries in Claude conversation
4. **Teams**: Shared database access through Claude + MCP

---

**QueryFlux MCP Server** — *AI-powered database access for agents*
