# Rate Limiting & Database Optimization - Integration Guide

## Overview

This guide explains how to integrate the Rate Limiting and Database Optimization systems into your Qestro backend.

## Part 1: Rate Limiting & API Gateway Hardening

### Components

- **RateLimiter**: Sliding-window rate limiter with per-minute and per-hour limits
- **RateLimitMiddleware**: Express middleware for automatic rate limiting
- **IPReputationTracker**: Tracks IP abuse patterns and auto-blocks malicious IPs
- **routes**: Admin API for managing limits and viewing statistics

### Installation

1. Import the module in your Express app:

```typescript
import { rateLimitMiddleware, createRateLimiterRoutes } from './services/rate-limiter/index.js';
import { IPReputationTracker } from './services/rate-limiter/index.js';

const app = express();

// Apply rate limiting middleware to all routes
app.use(rateLimitMiddleware('free')); // default tier for unauthenticated users

// Mount admin routes
const ipTracker = new IPReputationTracker();
app.use('/api/rate-limit', createRateLimiterRoutes());
```

2. **Tier Configuration**:
   - **free**: 100 requests/min, 1000/hour
   - **starter**: 500 requests/min, 5000/hour
   - **pro**: 2000 requests/min, 20000/hour
   - **enterprise**: 10000 requests/min, 100000/hour

### API Endpoints

**User Endpoints** (Authenticated):
- `GET /api/rate-limit/status` - Current rate limit usage

**Admin Endpoints** (Admin role required):
- `GET /api/rate-limit/usage` - Usage across all tiers
- `GET /api/rate-limit/blocked-ips` - List blocked IPs
- `GET /api/rate-limit/reputation/:ip` - IP reputation details
- `POST /api/rate-limit/block/:ip` - Block an IP
- `DELETE /api/rate-limit/block/:ip` - Unblock an IP
- `GET /api/rate-limit/stats` - Aggregate statistics

### Response Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1704067200
```

When limited (429):

```
Retry-After: 60
Content-Type: application/json

{
  "error": "Too Many Requests",
  "message": "Minute rate limit exceeded",
  "retryAfter": 60,
  "resetAt": "2024-01-01T12:00:00Z"
}
```

### IP Reputation System

Auto-blocks IPs after:
- 5+ rate limit violations
- 10+ auth failures (brute force detection)
- High failure rate (>80% of requests)

Automatic unblocking after 15 minutes (configurable).

## Part 2: Database Optimization

### Components

- **QueryProfiler**: Tracks query performance, detects N+1 patterns, suggests indexes
- **ConnectionPoolOptimizer**: Monitors and optimizes database connection pool
- **QueryCache**: Query-level caching with automatic table-based invalidation

### Installation

1. Import and initialize in your database service:

```typescript
import { QueryProfiler, ConnectionPoolOptimizer, QueryCache, createDBOptimizerRoutes } from './services/db-optimizer/index.js';

// Initialize optimizers
const profiler = new QueryProfiler(1000); // 1s slow query threshold
const poolOptimizer = new ConnectionPoolOptimizer();
const queryCache = new QueryCache(10000, 300); // max 10k entries, 5min TTL

// Mount admin routes
app.use('/api/db', createDBOptimizerRoutes(profiler, poolOptimizer, queryCache));
```

### Query Profiling

Wrap database queries to profile them:

```typescript
import { QueryProfiler } from './services/db-optimizer/index.js';

const profiler = new QueryProfiler();

// Before executing query
const startTime = Date.now();

// ... execute query ...
const rows = await db.query('SELECT * FROM tests WHERE project_id = ?', [projectId]);

// After executing query
const duration = Date.now() - startTime;
profiler.profileQuery(sql, [projectId], duration, rows.length);
```

### Query Caching

Cache expensive read queries:

```typescript
import { QueryCache } from './services/db-optimizer/index.js';

const cache = new QueryCache();

// Cache a query for 5 minutes
const projects = await cache.cachedQuery(
  `user:${userId}:projects`,
  async () => {
    return await db.query('SELECT * FROM projects WHERE user_id = ?', [userId]);
  },
  300 // 5 minutes TTL
);

// Invalidate on write
app.post('/projects', async (req, res) => {
  // ... create project ...
  cache.invalidateByTable('projects');
  res.json({ success: true });
});
```

### Connection Pool Monitoring

Monitor pool health during application startup:

```typescript
import { ConnectionPoolOptimizer } from './services/db-optimizer/index.js';

const poolOptimizer = new ConnectionPoolOptimizer();

// Get optimal pool size for your system
const optimalSize = poolOptimizer.getOptimalPoolSize(); // e.g., 20

// Recommended config
const recommended = poolOptimizer.getRecommendedConfig();
// Apply to your DB config: {min: 10, max: 30, ...}

// Monitor periodically
setInterval(() => {
  const health = poolOptimizer.getPoolHealth();
  if (!health.isHealthy) {
    logger.warn('Pool health issues:', health.alerts);
  }
}, 60000);
```

### API Endpoints

All DB optimization endpoints require admin role.

**Query Performance**:
- `GET /api/db/slow-queries?threshold=1000` - List slow queries (default 1s threshold)
- `GET /api/db/stats` - Comprehensive query statistics

**Connection Pool**:
- `GET /api/db/pool` - Pool health and metrics

**Optimization**:
- `GET /api/db/suggestions` - Index suggestions

**Caching**:
- `GET /api/db/cache` - Cache statistics
- `POST /api/db/cache/invalidate` - Invalidate by key/table/pattern
- `POST /api/db/cache/clear` - Clear entire cache

**Maintenance**:
- `POST /api/db/profiler/reset` - Reset profiling data

## Performance Tuning

### Rate Limiting

1. **For high-traffic endpoints**: Use 'pro' or 'enterprise' tier
2. **For sensitive endpoints** (auth, payment): Create stricter custom middleware
3. **Monitor blocked IPs**: Check `/api/rate-limit/stats` regularly
4. **Whitelist health checks**: Requests to `/health` bypass rate limiting

### Query Optimization

1. **Monitor slow queries**: Check `/api/db/slow-queries` daily
2. **Apply suggested indexes**: Review `/api/db/suggestions` and execute
3. **Fix N+1 patterns**: Look for repeated queries in slow list
4. **Cache reads**: Use `QueryCache` for frequently accessed data
5. **Batch writes**: Reduce individual cache invalidations

### Connection Pool

1. **Start with optimal size**: Use `getOptimalPoolSize()`
2. **Monitor wait times**: If avgWait > 100ms, increase pool size
3. **Check utilization**: Should be 50-75% under normal load
4. **Reduce idle timeout**: If many idle connections, set lower timeout

## Monitoring Dashboard

Expected integration with your monitoring system:

```
Rate Limiting Metrics:
- Active keys (users/IPs)
- Blocked IPs count and reasons
- Tier distribution
- 429 error rate

Database Metrics:
- Slow query count and avg duration
- N+1 query patterns
- Cache hit rate
- Pool utilization and wait times
- Query execution trend
```

## Troubleshooting

### High 429 Rate

1. Check user tier: `GET /api/rate-limit/status`
2. Review IP reputation: `GET /api/rate-limit/reputation/:ip`
3. Increase tier or whitelist legitimate traffic
4. Check for bot attacks: elevated failure rates

### Slow Queries

1. Review slow queries: `GET /api/db/slow-queries`
2. Check index suggestions: `GET /api/db/suggestions`
3. Profile actual execution plans
4. Look for N+1 patterns in application code

### Pool Exhaustion

1. Check pool health: `GET /api/db/pool`
2. Review avgWaitTimeMs and utilization
3. Follow pool recommendations
4. Optimize slow queries to release connections faster
5. Increase pool max size if needed

## Best Practices

1. **Rate Limiting**:
   - Always authenticate users to get better tier info
   - Monitor blocked IPs for abuse patterns
   - Use Retry-After header in clients

2. **Query Profiling**:
   - Profile all database queries in production
   - Set slow query threshold based on SLA
   - Review suggestions weekly

3. **Caching**:
   - Cache read-heavy endpoints only
   - Set reasonable TTLs (5-15 min for user data)
   - Invalidate on related table writes
   - Monitor hit rate, aim for >80%

4. **Connection Pool**:
   - Never use pool size > 50 (connection overhead)
   - Monitor during peak load
   - Adjust based on actual usage patterns
   - Set idle timeout > 1 minute to avoid churn

## Configuration Examples

### Development

```typescript
// Lenient rate limiting
const limiter = new RateLimiter({
  tiers: {
    free: { ..., requestsPerMinute: 1000 },
    // ... etc
  }
});

// Aggressive profiling
const profiler = new QueryProfiler(100); // 100ms threshold
```

### Production

```typescript
// Strict rate limiting
const limiter = new RateLimiter({
  tiers: {
    free: { ..., requestsPerMinute: 100 },
    enterprise: { ..., requestsPerMinute: 10000 },
    // ... etc
  }
});

// Conservative profiling
const profiler = new QueryProfiler(1000); // 1s threshold
const cache = new QueryCache(10000, 600); // 10min TTL
```

## Testing

See test files in `__tests__/services/` for:
- Rate limiter unit tests
- IP reputation tracking
- Query profiling and detection
- Pool optimization recommendations
- Cache invalidation patterns
