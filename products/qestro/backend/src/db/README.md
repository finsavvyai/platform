# PostgreSQL Database Module

Complete PostgreSQL Drizzle ORM implementation for Qestro production server.

## Files

- **pg-schema.ts** (559 lines)
  - 19 tables with full relationships
  - 11 PostgreSQL enums
  - 30+ strategic indexes
  - JSONB flexible storage
  - UUID primary keys
  - Timezone-aware timestamps

- **connection.ts** (380 lines)
  - Production-ready connection pool
  - Health checks and auto-recovery
  - Graceful shutdown handlers
  - Connection metrics
  - Transaction support

## Quick Start

```typescript
// Initialize on app startup
import { initializeDatabase, getDatabase } from './db/connection';
import { projects, testRuns } from './db/pg-schema';

await initializeDatabase();
const db = getDatabase();

// Query
const myProjects = await db
  .select()
  .from(projects)
  .where(eq(projects.userId, userId));
```

## Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NODE_ENV=production
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30000
```

## Migration

```bash
npx drizzle-kit migrate
```

## Full Documentation

- `POSTGRES_SETUP.md` - Comprehensive guide (setup, examples, deployment)
- `POSTGRES_QUICKSTART.md` - Quick reference (5-minute setup, common queries)

## Schema Tables (19)

| Category | Tables |
|----------|--------|
| **Core** | users, projects, team_members |
| **Testing** | test_cases, test_plans, test_runs, test_results |
| **Automation** | automation_runs, recording_sessions, scheduled_tests, cycles |
| **Integrations** | integrations, notifications, audit_logs |
| **APIs** | virtual_services, virtual_service_requests, api_keys |
| **Billing** | subscriptions, usage_records |

## API Reference

### Initialization
- `initializeDatabase()` - Full startup
- `initializeConnectionPool()` - Low-level init

### Usage
- `getDatabase()` - Get Drizzle instance
- `getConnectionPool()` - Get raw Pool
- `executeQuery<T>(sql, params)` - Raw SQL

### Monitoring
- `checkDatabaseHealth()` - Health check
- `getConnectionPoolMetrics()` - Pool stats
- `startHealthMonitoring(interval)` - Auto-recovery
- `stopHealthMonitoring()` - Stop monitoring

### Management
- `closeDatabaseConnection()` - Graceful shutdown
- `reconnectDatabase(maxRetries, delay)` - Manual reconnect
- `runMigrations()` - Migration runner

## Features

- Connection pooling (min: 2, max: 10)
- Health checks with auto-recovery
- Exponential backoff retry logic
- Graceful SIGTERM/SIGINT shutdown
- SSL support (auto in production)
- Connection metrics and monitoring
- Test mode support
- Transaction support via Drizzle ORM
- Raw SQL query execution

## Type Safety

All tables, enums, and relationships are fully typed. No `any` types.

```typescript
// Fully typed queries
const run: typeof testRuns.$inferSelect = await db
  .select()
  .from(testRuns)
  .where(eq(testRuns.id, runId))
  .then(rows => rows[0]);
```

## Deployment

### Docker Compose
```bash
docker-compose up postgres backend
```

### Kubernetes
```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/qestro-backend.yaml
```

## Performance

- 30+ indexes on FK, status, timestamps
- Connection pooling for concurrency
- JSONB for flexible schema
- Pagination with LIMIT/OFFSET
- Batch operations via transactions

## Support

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Node.js pg](https://github.com/brianc/node-postgres)
