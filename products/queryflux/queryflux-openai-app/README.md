# QueryFlux OpenAI App

AI-powered database intelligence platform for ChatGPT.

## Overview

QueryFlux OpenAI App brings the full power of QueryFlux database intelligence directly into ChatGPT conversations. Built with the OpenAI Apps SDK, it provides 6 powerful tools for database operations, schema introspection, and AI-powered query generation.

## Features

### 6 AI Tools for ChatGPT

1. **execute_query** - Execute SQL queries with safety checks
2. **get_schema** - Database schema introspection
3. **natural_language_query** - NLP-to-SQL conversion
4. **create_migration** - Generate migrations from natural language
5. **seed_test_data** - AI-generated test data
6. **explain_query** - Query performance analysis

## Quick Start

### Prerequisites

- Node.js 18+
- QueryFlux backend running (localhost:8080)
- OpenAI Apps SDK account

### Installation

```bash
cd queryflux-openai-app
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your settings:
```env
QUERYFLUX_API_URL=http://localhost:8080
PORT=3000
```

### Development

```bash
# Build TypeScript
npm run build

# Start app
npm start

# Development mode (auto-reload)
npm run dev
```

### Testing

```bash
npm test
```

## Usage in ChatGPT

Once deployed, users can interact with QueryFlux directly in ChatGPT:

### Example Conversations

**User**: "Using QueryFlux, show me the database schema"

**ChatGPT** (uses get_schema tool):
```
## Database Schema

### users
- **id** (integer) 🔑 PK NOT NULL
- **email** (varchar) NOT NULL
- **name** (varchar)
- **created_at** (timestamp)

### database_connections
- **id** (integer) 🔑 PK NOT NULL
...
```

**User**: "Execute: SELECT * FROM users LIMIT 3"

**ChatGPT** (uses execute_query tool):
```
✅ Query executed successfully!

**Results**: 2 rows in 1.42ms

| id | email | name | created_at |
| --- | --- | --- | --- |
| 1 | demo@queryflux.dev | Demo User | 2026-02-28 12:00:00 |
| 2 | ai-agent@queryflux.dev | AI Agent Test | 2026-02-28 12:00:00 |
```

**User**: "Generate SQL to find users who signed up last week"

**ChatGPT** (uses natural_language_query tool):
```
## Generated SQL

```sql
SELECT * FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**Confidence**: 95%
```

**User**: "Create a migration to add an index on users.email"

**ChatGPT** (uses create_migration tool):
```
## Migration: Add index on users.email

**Up Migration:**
```sql
CREATE INDEX idx_users_email_lookup ON users(email);
```

**Down Migration:**
```sql
DROP INDEX IF EXISTS idx_users_email_lookup;
```

✅ No warnings
```

## Architecture

```
┌─────────────────┐
│    ChatGPT      │
│   (OpenAI)      │
└────────┬────────┘
         │ Apps SDK
         │
┌────────▼────────┐
│ QueryFlux       │
│ OpenAI App      │ (TypeScript)
│ (This Package)  │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│ QueryFlux       │
│ Go Backend      │ (localhost:8080)
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │
│   Database      │
└─────────────────┘
```

## API Endpoints

### Health Check
```
GET /health
```

Returns backend health status.

## Tool Definitions

All tools are automatically registered with OpenAI Apps SDK and available in ChatGPT conversations.

### execute_query
- **Parameters**: database_id, sql, dry_run (optional)
- **Returns**: Query results as formatted table
- **Example**: "Execute: SELECT COUNT(*) FROM users"

### get_schema
- **Parameters**: database_id
- **Returns**: Formatted database schema
- **Example**: "Show me the database structure"

### natural_language_query
- **Parameters**: database_id, question
- **Returns**: Generated SQL with confidence score
- **Example**: "Find all active users"

### create_migration
- **Parameters**: database_id, description, validate (optional)
- **Returns**: Up/down migration SQL
- **Example**: "Add a created_at column to orders table"

### seed_test_data
- **Parameters**: database_id, table_name, row_count, data_type, execute (optional)
- **Returns**: INSERT SQL with generated data
- **Example**: "Generate 10 test users"

### explain_query
- **Parameters**: database_id, query, analyze (optional)
- **Returns**: Execution plan + optimization suggestions
- **Example**: "Analyze this query's performance: SELECT * FROM users WHERE email LIKE '%@example.com'"

## Deployment

### Option 1: OpenAI Apps Platform
```bash
# Build for production
npm run build

# Deploy to OpenAI Apps
openai-apps deploy
```

### Option 2: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### Option 3: Cloudflare Workers
- Convert to Hono framework
- Deploy as Cloudflare Worker
- Benefits: Edge deployment, low latency

## Security

- All database credentials stored securely
- API calls authenticated with JWT
- Input validation on all parameters
- Rate limiting enforced
- No SQL injection (parameterized queries)

## Performance

- Tool response time: < 100ms target
- Query execution: < 50ms (P50)
- Schema introspection: < 200ms
- NLP-to-SQL: < 2s

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Troubleshooting

### "Connection refused to localhost:8080"
- Ensure QueryFlux backend is running
- Check `QUERYFLUX_API_URL` in `.env`

### "Tool not appearing in ChatGPT"
- Verify app is deployed to OpenAI Apps platform
- Check app status in OpenAI dashboard
- Restart ChatGPT session

### "Query execution failed"
- Check backend logs for errors
- Verify database connection
- Ensure SQL syntax is valid

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT

## Support

- **Documentation**: https://queryflux.dev/docs
- **Issues**: https://github.com/queryflux/queryflux/issues
- **Discord**: https://discord.gg/queryflux

---

**Part of the QueryFlux ecosystem** - AI-powered database intelligence for the modern data stack.
