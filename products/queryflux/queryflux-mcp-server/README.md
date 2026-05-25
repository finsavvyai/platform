# QueryFlux MCP Server

Model Context Protocol server for QueryFlux - enables AI agents (Claude, Cursor, etc.) to interact with databases through natural language.

## Features

### Core Tools
- **execute_query**: Execute SQL with safety checks and dry-run mode
- **get_schema**: Introspect database schema (tables, columns, indexes)
- **natural_language_query**: Convert natural language to SQL (via QueryLens)

### Advanced Tools
- **create_migration**: Generate SQL migrations (up/down) from natural language with validation
- **seed_test_data**: Generate AI-powered realistic test data with foreign key support
- **explain_query**: Analyze query execution plans with optimization suggestions

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "queryflux": {
      "command": "node",
      "args": ["/path/to/queryflux-mcp-server/dist/index.js"],
      "env": {
        "QUERYFLUX_API_URL": "http://localhost:8080"
      }
    }
  }
}
```

## Usage

In Claude Desktop:

### Basic Queries

```
Can you show me the database schema?
```

Claude will use the `get_schema` tool to fetch schema information.

```
Execute: SELECT * FROM users LIMIT 5
```

Claude will use the `execute_query` tool to run the query.

```
Show me all orders from the last 30 days
```

Claude will use `natural_language_query` to convert this to SQL and optionally execute it.

### Advanced Operations

#### Create Migration

```
Create a migration to add an email column to the users table with a unique constraint
```

Claude will use `create_migration` to generate:
- Up migration SQL (apply change)
- Down migration SQL (rollback)
- Validation warnings if the migration is unsafe

**Example Output:**
```sql
-- Up Migration
ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL UNIQUE;
CREATE INDEX idx_users_email ON users(email);

-- Down Migration
DROP INDEX idx_users_email;
ALTER TABLE users DROP COLUMN email;
```

#### Seed Test Data

```
Generate 50 realistic test records for the users table
```

Claude will use `seed_test_data` to:
- Analyze table schema and column types
- Generate contextually appropriate data (real names, valid emails, etc.)
- Respect foreign key relationships
- Preview or execute INSERT statements

**Example Output:**
```sql
INSERT INTO users (name, email, created_at) VALUES
('Alice Johnson', 'alice.johnson@example.com', '2024-01-15 10:30:00'),
('Bob Smith', 'bob.smith@example.com', '2024-01-16 14:22:10'),
-- ... 48 more rows
```

#### Explain Query

```
Analyze this query and suggest optimizations:
SELECT u.*, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.created_at > NOW() - INTERVAL '30 days'
```

Claude will use `explain_query` to:
- Show PostgreSQL execution plan
- Identify slow operations (seq scans, hash joins)
- Suggest indexes
- Recommend query rewrites
- Estimate performance impact

**Example Output:**
```
Slow Operations Detected:
- Sequential Scan on orders (cost: 1234.56)
  Full table scan on 1M rows

High Priority Suggestions:
- INDEX: CREATE INDEX idx_orders_created_at ON orders(created_at)
  Rationale: Reduce cost by ~90%, enable index-only scan

Medium Priority:
- REWRITE: Add WHERE clause before JOIN
  Rationale: Filter rows earlier in execution plan
```

## Development

```bash
# Watch mode
npm run dev

# Run tests
npm test
```

## Environment Variables

- `QUERYFLUX_API_URL`: QueryFlux backend API URL (default: http://localhost:8080)
