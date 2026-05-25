# PostgreSQL Quick Start

## Files Created

```
backend/src/db/
├── pg-schema.ts        (559 lines) - PostgreSQL schema with 19 tables + enums + indexes
└── connection.ts       (380 lines) - Connection pool manager with health checks

POSTGRES_SETUP.md       (14 KB)    - Comprehensive setup and migration guide
POSTGRES_QUICKSTART.md  (this)     - Quick reference
```

## 5-Minute Setup

### 1. Install Dependencies
```bash
cd backend
npm install pg drizzle-orm drizzle-kit @types/pg
```

### 2. Set Environment Variables
```bash
# .env or .env.production
DATABASE_URL=postgresql://user:password@localhost:5432/qestro_prod
NODE_ENV=production
```

### 3. Create Database
```bash
createdb qestro_prod
createuser qestro_user
psql qestro_prod -c "ALTER USER qestro_user WITH PASSWORD 'password';"
```

### 4. Run Migrations
```bash
npx drizzle-kit migrate
```

### 5. Initialize in App
```typescript
// main.ts or server.ts
import { initializeDatabase } from './db/connection';

await initializeDatabase();
app.listen(3000);
```

## Core API

```typescript
// Imports
import {
  getDatabase,                    // Get Drizzle instance
  initializeDatabase,             // Initialize on startup
  checkDatabaseHealth,            // Health check
  closeDatabaseConnection,        // Graceful shutdown
  reconnectDatabase,              // Manual reconnect
  getConnectionPoolMetrics,       // Pool stats
  startHealthMonitoring,          // Auto-recovery
} from './db/connection';

import * as schema from './db/pg-schema';

// Usage
const db = getDatabase();

// Query with Drizzle ORM
const projects = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.userId, userId));

// Health check
const isHealthy = await checkDatabaseHealth();

// Metrics
const metrics = getConnectionPoolMetrics();
console.log(metrics.totalConnections, metrics.availableConnections);
```

## Schema Overview

### 19 Tables

**User & Auth:**
- `users` - Accounts with OAuth support
- `team_members` - Team collaboration

**Testing:**
- `test_cases` - Test definitions
- `test_plans` - Test collections
- `test_runs` - Execution history
- `test_results` - Per-test results

**Automation:**
- `automation_runs` - Batch runs
- `recording_sessions` - UI recordings
- `scheduled_tests` - Cron jobs
- `cycles` - Planning cycles

**Features:**
- `api_keys` - API authentication
- `integrations` - GitHub/GitLab/Jira/Slack
- `notifications` - User alerts
- `audit_logs` - Change tracking

**APIs:**
- `virtual_services` - API mocks
- `virtual_service_requests` - Mock logs

**Billing:**
- `subscriptions` - Stripe integration
- `usage_records` - Metering

### 11 PostgreSQL Enums

```typescript
userRole             // admin, user, viewer, team_lead
subscriptionPlan     // free, starter, pro, enterprise
testStatus          // draft, active, archived, disabled
testPriority        // low, medium, high, critical
testType            // functional, regression, smoke, e2e
framework           // playwright, cypress, maestro, api
testRunStatus       // pending, running, passed, failed, skipped, cancelled
recordingStatus     // recording, completed, processing, error, failed
automationRunStatus // queued, running, passed, failed, partial, cancelled
integrationType     // github, gitlab, jira, slack, teams, discord
integrationStatus   // connected, disconnected, error
notificationType    // test_result, test_failure, system, alert, info
```

## Common Queries

```typescript
import { getDatabase } from './db/connection';
import { eq, desc, and, sql } from 'drizzle-orm';
import * as schema from './db/pg-schema';

const db = getDatabase();

// Get user's projects
const projects = await db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.userId, userId));

// Get recent test runs
const runs = await db
  .select()
  .from(schema.testRuns)
  .where(eq(schema.testRuns.projectId, projectId))
  .orderBy(desc(schema.testRuns.createdAt))
  .limit(20);

// Count passed tests
const { count } = await db
  .select({ count: sql`count(*)`.mapWith(Number) })
  .from(schema.testResults)
  .where(and(
    eq(schema.testResults.testRunId, runId),
    eq(schema.testResults.status, 'passed')
  ));

// Get user with team projects
const results = await db
  .select()
  .from(schema.teamMembers)
  .leftJoin(
    schema.projects,
    eq(schema.teamMembers.projectId, schema.projects.id)
  )
  .where(eq(schema.teamMembers.userId, userId));

// Update test run status
await db
  .update(schema.testRuns)
  .set({ status: 'passed', completedAt: new Date() })
  .where(eq(schema.testRuns.id, runId));

// Delete old records
await db
  .delete(schema.testResults)
  .where(sql`created_at < NOW() - INTERVAL '30 days'`);
```

## Configuration

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Or individual components
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qestro_prod
DB_USER=postgres
DB_PASSWORD=secret

# Optional (defaults shown)
DB_MIN_CONNECTIONS=2
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30000        # milliseconds
DB_CONNECT_TIMEOUT=10000     # milliseconds
NODE_ENV=production
```

### Pool Settings

```typescript
// Connection pool tuning
const poolConfig = {
  max: 10,                    // Max concurrent connections
  min: 2,                     // Min idle connections
  idleTimeoutMillis: 30000,   // Close idle after 30s
  connectionTimeoutMillis: 10000, // Fail if can't connect in 10s
};
```

## Deployment Checklist

- [ ] Create PostgreSQL database
- [ ] Set DATABASE_URL in production secrets
- [ ] Run migrations: `drizzle-kit migrate`
- [ ] Install dependencies: `npm install pg drizzle-orm`
- [ ] Call `initializeDatabase()` on app startup
- [ ] Add health check endpoint: `/health` -> `checkDatabaseHealth()`
- [ ] Monitor logs for connection errors
- [ ] Test graceful shutdown (SIGTERM)
- [ ] Verify auto-recovery works under connection loss

## Troubleshooting

### Connection Timeout
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify credentials
psql -h localhost -U qestro_user -d qestro_prod
```

### Too Many Connections
```bash
# Reduce max connections in .env
DB_MAX_CONNECTIONS=5

# Or restart app to recycle pool
```

### Slow Queries
```bash
# Enable query logging
DB_DEBUG=true

# Check indexes
SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;

# Analyze slow query
EXPLAIN ANALYZE SELECT ...;
```

### Connection Leak
```typescript
// Ensure all connections are returned
// Using Drizzle ORM handles this automatically
// Check pool metrics
console.log(getConnectionPoolMetrics());
```

## Performance Tips

1. **Use indexes** - 30+ are pre-created for common queries
2. **Pagination** - Always use `.limit()` and `.offset()`
3. **Connection pooling** - Reuse connections (handled automatically)
4. **Batch operations** - Use transactions for multiple inserts
5. **Monitor metrics** - Check `getConnectionPoolMetrics()` regularly

## Next Steps

1. Read `POSTGRES_SETUP.md` for detailed guide
2. Run migrations: `npx drizzle-kit migrate`
3. Generate types: `npx drizzle-kit generate:pg`
4. Update API routes to use new schema
5. Run tests
6. Deploy!

## Support

- **Drizzle ORM Docs**: https://orm.drizzle.team
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **Node.js pg**: https://github.com/brianc/node-postgres
