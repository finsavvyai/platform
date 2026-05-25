# PostgreSQL Setup & Migration Guide

## Overview

Qestro has been upgraded from SQLite to PostgreSQL with a complete Drizzle ORM schema. This guide covers setup, migration, and deployment.

## Files Created

### 1. `backend/src/db/pg-schema.ts` (559 lines)
Complete PostgreSQL schema with all 19 tables:

**Core Tables:**
- `users` - Authentication, profile, subscription info
- `projects` - Project management with ownership
- `team_members` - Team collaboration and roles
- `test_cases` - Test definitions with code and metadata
- `test_plans` - Grouped test execution plans
- `test_runs` - Individual test execution results
- `test_results` - Per-test result details with screenshots

**Automation Tables:**
- `automation_runs` - Batch automation execution tracking
- `recording_sessions` - UI recording/playback sessions
- `virtual_services` - API mocking endpoints
- `virtual_service_requests` - Mocked request logs

**Feature Tables:**
- `api_keys` - Programmatic access tokens
- `scheduled_tests` - Cron-based test scheduling
- `integrations` - GitHub/GitLab/Jira/Slack connections
- `notifications` - User notifications
- `audit_logs` - Full audit trail

**Billing Tables:**
- `subscriptions` - Stripe integration
- `usage_records` - Metered usage tracking

**Management Tables:**
- `cycles` - Test planning cycles/sprints

### 2. `backend/src/db/connection.ts` (380 lines)
Production-ready PostgreSQL connection manager with:

**Features:**
- Connection pooling (min: 2, max: 10, configurable)
- Health checks and auto-recovery
- Graceful shutdown (SIGTERM/SIGINT)
- Exponential backoff retry logic
- Connection metrics and monitoring
- Transaction support via Drizzle ORM
- Test mode support

**Exported Functions:**
```typescript
// Initialization
initializeDatabase()           // Call once on app startup
initializeConnectionPool()     // Low-level pool init

// Connection management
getDatabase()                  // Get Drizzle instance
getConnectionPool()            // Get raw Pool instance
closeDatabaseConnection()      // Graceful shutdown
reconnectDatabase(maxRetries)  // Manual reconnection

// Monitoring
checkDatabaseHealth()          // Simple health check
getConnectionPoolMetrics()     // Pool stats
startHealthMonitoring(interval) // Auto-recovery
stopHealthMonitoring()         // Stop monitoring

// Utilities
executeQuery<T>(sql, params)  // Raw SQL execution
runMigrations()               // Migration runner
```

## Setup Instructions

### 1. Install Dependencies

Ensure these are in `backend/package.json`:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.28.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/pg": "^8.10.0"
  }
}
```

```bash
npm install
```

### 2. Environment Configuration

Create `.env` or `.env.production`:

```bash
# PostgreSQL Connection (choose one method)

# Method A: Connection String (Supabase, Railway, etc)
DATABASE_URL=postgresql://user:password@localhost:5432/qestro_prod

# Method B: Individual Components (for custom setup)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qestro_prod
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Optional: Connection Pool Settings
DB_MIN_CONNECTIONS=2
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30000        # milliseconds
DB_CONNECT_TIMEOUT=10000     # milliseconds

# Node environment
NODE_ENV=production
```

### 3. Create PostgreSQL Database

Using `psql`:

```bash
# Connect as superuser
psql -U postgres

# Create database
CREATE DATABASE qestro_prod;

# Create user with password
CREATE USER qestro_user WITH PASSWORD 'secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE qestro_prod TO qestro_user;

# Connect to database
\c qestro_prod

# Grant schema privileges
GRANT ALL ON SCHEMA public TO qestro_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO qestro_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO qestro_user;

# Exit
\q
```

Or using Docker:

```bash
docker run -d \
  --name qestro-postgres \
  -e POSTGRES_DB=qestro_prod \
  -e POSTGRES_USER=qestro_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  postgres:16-alpine
```

### 4. Run Database Migrations

Using Drizzle Kit:

```bash
# Generate migration files from schema
npx drizzle-kit generate:pg

# Run migrations
npx drizzle-kit migrate

# Or use the exported function in code
import { runMigrations } from './db/connection';
await runMigrations();
```

The schema includes:
- 19 tables with proper relationships
- Foreign key constraints with CASCADE delete
- 30+ indexes on commonly queried columns
- PostgreSQL enums for type safety
- JSONB columns for flexible storage
- UUID primary keys for distributed systems
- Timestamp columns with timezone support

### 5. Initialize Application

```typescript
// In your Express app startup (main.ts or server.ts)
import { initializeDatabase, stopHealthMonitoring, closeDatabaseConnection } from './db/connection';

async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();

    // Start Express server
    app.listen(3000, () => {
      console.log('Server running on port 3000');
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  stopHealthMonitoring();
  await closeDatabaseConnection();
  process.exit(0);
});
```

## Schema Highlights

### Type Safety with Enums

PostgreSQL native enums prevent invalid data:

```typescript
// All enums are strongly typed
export const userRoleEnum = pgEnum('user_role', ['admin', 'user', 'viewer', 'team_lead']);
export const testStatusEnum = pgEnum('test_status', ['draft', 'active', 'archived', 'disabled']);

// Usage in schema:
role: userRoleEnum('role').notNull().default('user'),
status: testStatusEnum('status').notNull().default('draft'),
```

### Relationships & Cascading

Proper foreign key relationships with automatic cleanup:

```typescript
userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
// If user is deleted, all related projects are also deleted
```

### Indexes for Performance

30+ strategic indexes on:
- Foreign key columns (fast joins)
- Status fields (filtering)
- Created/updated timestamps (pagination)
- Composite indexes (multi-column queries)

Example:
```typescript
(table) => ({
  projectIdIdx: index('test_cases_project_id_idx').on(table.projectId),
  statusIdx: index('test_cases_status_idx').on(table.status),
  createdAtIdx: index('test_cases_created_at_idx').on(table.createdAt),
})
```

### JSONB Storage

Flexible schema for extensibility:

```typescript
settings: jsonb('settings'),           // Project config
testData: jsonb('test_data'),          // Test metadata
config: jsonb('config'),               // Integration secrets
healingDetails: jsonb('healing_details'), // Self-heal suggestions
data: jsonb('data'),                   // Notification context
```

### UUID Primary Keys

Distributed-friendly identifiers:

```typescript
id: uuid('id').primaryKey().defaultRandom(),
// Generates globally unique IDs without database coordination
```

### Timezone-Aware Timestamps

All timestamps store timezone:

```typescript
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
// Stored as timestamptz in PostgreSQL, supports global distribution
```

## Usage Examples

### Querying with Drizzle ORM

```typescript
import { getDatabase } from './db/connection';
import { eq, desc } from 'drizzle-orm';
import { projects, testRuns } from './db/pg-schema';

const db = getDatabase();

// Find user's projects
const userProjects = await db
  .select()
  .from(projects)
  .where(eq(projects.userId, userId));

// Get recent test runs with pagination
const recentRuns = await db
  .select()
  .from(testRuns)
  .where(eq(testRuns.projectId, projectId))
  .orderBy(desc(testRuns.createdAt))
  .limit(20)
  .offset(0);

// Join projects and test runs
const runDetails = await db
  .select()
  .from(testRuns)
  .leftJoin(projects, eq(testRuns.projectId, projects.id))
  .where(eq(testRuns.projectId, projectId));

// Aggregate: count tests per status
const statusSummary = await db
  .select({
    status: testRuns.status,
    count: sql`COUNT(*)`.mapWith(Number),
  })
  .from(testRuns)
  .where(eq(testRuns.projectId, projectId))
  .groupBy(testRuns.status);
```

### Health Checks in API Routes

```typescript
import { checkDatabaseHealth } from './db/connection';

app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();
  res.json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});
```

### Connection Metrics

```typescript
import { getConnectionPoolMetrics } from './db/connection';

app.get('/metrics', (req, res) => {
  const metrics = getConnectionPoolMetrics();
  res.json({
    pool: metrics,
    timestamp: new Date().toISOString(),
  });
});
```

## Migration from SQLite

If migrating existing SQLite data:

1. **Dump SQLite data:**
   ```bash
   sqlite3 qestro.db ".dump" > dump.sql
   ```

2. **Transform to PostgreSQL format** (some adjustments needed for types)

3. **Restore to PostgreSQL:**
   ```bash
   psql qestro_prod < transformed_dump.sql
   ```

4. **Or use a data migration tool:**
   - pgLoader
   - dbt
   - Custom Node.js script with Drizzle ORM

## Production Deployment

### Kubernetes Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: qestro-db-config
data:
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "qestro_prod"
  DB_MIN_CONNECTIONS: "2"
  DB_MAX_CONNECTIONS: "10"
  DB_IDLE_TIMEOUT: "30000"

---
apiVersion: v1
kind: Secret
metadata:
  name: qestro-db-secret
type: Opaque
stringData:
  DB_USER: "qestro_user"
  DB_PASSWORD: "your_secure_password"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qestro-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: qestro:latest
        envFrom:
        - configMapRef:
            name: qestro-db-config
        - secretRef:
            name: qestro-db-secret
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: qestro_dev
      POSTGRES_USER: qestro_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U qestro_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://qestro_user:dev_password@postgres:5432/qestro_dev
      DB_MIN_CONNECTIONS: 2
      DB_MAX_CONNECTIONS: 5
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app/backend

volumes:
  postgres_data:
```

## Monitoring & Troubleshooting

### Enable Query Logging

```typescript
import { logger } from './utils/logger';

// In connection.ts, wrap queries:
const originalQuery = pool.query.bind(pool);
pool.query = async (text, values) => {
  const start = Date.now();
  try {
    const result = await originalQuery(text, values);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text, duration, rowCount: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query failed', { text, error });
    throw error;
  }
};
```

### Monitor Connection Pool

```bash
# Check active connections
psql qestro_prod -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'qestro_prod';"

# Check locks
psql qestro_prod -c "SELECT * FROM pg_locks JOIN pg_stat_activity USING (pid);"

# Check slow queries
psql qestro_prod -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### Connection Issues

```typescript
// Restart health monitoring
import { stopHealthMonitoring, startHealthMonitoring } from './db/connection';

stopHealthMonitoring();
startHealthMonitoring(30000); // Check every 30s

// Manual reconnect
import { reconnectDatabase } from './db/connection';
await reconnectDatabase(5, 2000); // 5 retries, 2s initial delay
```

## Performance Tuning

### Pool Configuration

```env
# For high concurrency (API server)
DB_MIN_CONNECTIONS=5
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=20000

# For moderate load (scheduled jobs)
DB_MIN_CONNECTIONS=2
DB_MAX_CONNECTIONS=10
DB_IDLE_TIMEOUT=30000

# For low load (development)
DB_MIN_CONNECTIONS=1
DB_MAX_CONNECTIONS=5
DB_IDLE_TIMEOUT=60000
```

### Index Optimization

All indexes are optimized by default. For custom queries:

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Analyze table statistics
ANALYZE test_runs;

-- Check query plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM test_runs WHERE project_id = 'abc' ORDER BY created_at DESC LIMIT 20;
```

## Next Steps

1. Run migrations: `npx drizzle-kit migrate`
2. Initialize database in your app: `await initializeDatabase()`
3. Update API routes to use new schema
4. Run integration tests
5. Deploy to staging
6. Monitor connection health and adjust pool settings based on load

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Node.js pg module](https://github.com/brianc/node-postgres)
- [Drizzle Kit Migrations](https://orm.drizzle.team/kit-docs/overview)
