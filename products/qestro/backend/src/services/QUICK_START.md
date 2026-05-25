# Rate Limiting & Database Optimization - Quick Start

## What Was Delivered

**2,263 lines of production TypeScript** across 12 files implementing:

### Rate Limiting Module (951 lines)
- Sliding-window rate limiter (100-10000 req/min by tier)
- Express middleware with tier detection
- IP reputation tracking with auto-blocking
- Admin API routes for management

### Database Optimization Module (1,312 lines)
- Query profiler (detects N+1, full table scans, slow queries)
- Connection pool optimizer with health monitoring
- Query-level cache with TTL and pattern-based invalidation
- Admin API routes for monitoring and optimization

## 5-Minute Integration

### 1. Add Rate Limiting to Express App

```typescript
import express from 'express';
import { rateLimitMiddleware } from './services/rate-limiter/index.js';

const app = express();

// Apply to all routes
app.use(rateLimitMiddleware('free'));

// Mount admin routes
import { createRateLimiterRoutes } from './services/rate-limiter/index.js';
app.use('/api/rate-limit', createRateLimiterRoutes());
```

### 2. Initialize Database Optimizers

```typescript
import {
  QueryProfiler,
  ConnectionPoolOptimizer,
  QueryCache,
  createDBOptimizerRoutes,
} from './services/db-optimizer/index.js';

const profiler = new QueryProfiler(1000); // 1s slow threshold
const poolOptimizer = new ConnectionPoolOptimizer();
const queryCache = new QueryCache(10000, 300); // 5-min TTL

// Mount routes
app.use('/api/db', createDBOptimizerRoutes(profiler, poolOptimizer, queryCache));
```

### 3. Profile Database Queries

```typescript
// Wrap all queries
const startTime = Date.now();
const result = await db.query(sql, params);
const duration = Date.now() - startTime;

profiler.profileQuery(sql, params, duration, result.rows.length);
```

### 4. Cache Expensive Queries

```typescript
const data = await queryCache.cachedQuery(
  `user:${userId}:projects`,
  () => db.query('SELECT * FROM projects WHERE user_id = ?', [userId]),
  300 // 5 minute TTL
);

// Invalidate on writes
app.post('/projects', (req, res) => {
  // ... create project ...
  queryCache.invalidateByTable('projects');
});
```

## Key Features at a Glance

### Rate Limiting
| Tier | Per Min | Per Hour | Auto-Block After |
|------|---------|----------|------------------|
| free | 100 | 1000 | 5 violations |
| starter | 500 | 5000 | 5 violations |
| pro | 2000 | 20000 | 5 violations |
| enterprise | 10000 | 100000 | Never |

**Abuse Prevention**:
- Brute force detection (10+ auth failures)
- Rapid request detection (500+ req/hour)
- High failure rate tracking (>80% errors)
- Auto IP blocking with manual override

### Database Optimization
**Query Profiling**:
- N+1 pattern detection (70% in 5-min window)
- Full table scan identification (SELECT * without WHERE)
- Slow query thresholds (configurable, default 1s)
- Index suggestions with CREATE statements

**Connection Pool**:
- Optimal size calculation (2-3x CPU cores)
- Health alerts: utilization, wait time, timeouts
- Reliability metrics: failure rate, timeout rate
- Scaling recommendations

**Query Cache**:
- Hash-based key management
- TTL-based expiration (configurable)
- Table-based invalidation on writes
- Hit rate tracking (80%+ target)

## API Endpoints

### User Endpoints (Authenticated)
```
GET  /api/rate-limit/status        → Current rate limit usage
GET  /api/db/cache                 → Cache statistics
```

### Admin Endpoints (Admin role required)
```
# Rate Limiting
GET  /api/rate-limit/usage         → Usage by tier
GET  /api/rate-limit/blocked-ips   → Currently blocked IPs
GET  /api/rate-limit/reputation/:ip → IP reputation details
POST /api/rate-limit/block/:ip     → Block an IP
DELETE /api/rate-limit/block/:ip   → Unblock an IP
GET  /api/rate-limit/stats         → Aggregate statistics

# Database
GET  /api/db/slow-queries          → Slow query list
GET  /api/db/stats                 → Query statistics
GET  /api/db/pool                  → Connection pool health
GET  /api/db/suggestions           → Index suggestions
POST /api/db/cache/invalidate      → Manual cache invalidation
POST /api/db/cache/clear           → Clear entire cache
POST /api/db/profiler/reset        → Reset profiler data
```

## Response Headers (Rate Limiting)

All API responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1704067200
```

When rate limited (429):
```json
{
  "error": "Too Many Requests",
  "message": "Minute rate limit exceeded",
  "retryAfter": 60,
  "resetAt": "2024-01-01T12:00:00Z"
}
```

## Monitoring Checklist

### Daily
- [ ] Review slow queries: `GET /api/db/slow-queries`
- [ ] Check blocked IPs: `GET /api/rate-limit/blocked-ips`

### Weekly
- [ ] Review index suggestions: `GET /api/db/suggestions`
- [ ] Check cache hit rate: `GET /api/db/cache`
- [ ] Monitor pool health: `GET /api/db/pool`

### Monthly
- [ ] Adjust rate limit tiers based on actual usage
- [ ] Implement suggested indexes
- [ ] Review and fix N+1 patterns

## Performance Targets

**Rate Limiting**:
- Response time overhead: <1ms
- Memory per 1000 keys: <5MB

**Database**:
- Query profiling overhead: <5% (async)
- Cache hit rate: >80% for reads
- Pool utilization: 50-75% under normal load

**Connection Pool**:
- Average wait time: <10ms
- Timeout rate: <1%
- Failure rate: <0.1%

## Troubleshooting

### High 429 Errors
1. Check user tier: `GET /api/rate-limit/status`
2. Review IP reputation: `GET /api/rate-limit/reputation/:ip`
3. Check for bot attacks: elevated failure rates
4. Increase tier or whitelist legitimate traffic

### Slow Queries
1. List slow queries: `GET /api/db/slow-queries`
2. Review suggestions: `GET /api/db/suggestions`
3. Apply indexes from suggestions
4. Fix N+1 patterns in application code

### Pool Exhaustion
1. Check pool health: `GET /api/db/pool`
2. Review average wait time and utilization
3. Optimize slow queries to release connections
4. Increase pool max size if needed

## File Structure

```
backend/src/services/
├── rate-limiter/
│   ├── types.ts                  (96 lines) - Type definitions
│   ├── RateLimiter.ts            (216 lines) - Sliding window implementation
│   ├── RateLimitMiddleware.ts     (123 lines) - Express middleware
│   ├── IPReputationTracker.ts     (255 lines) - IP abuse prevention
│   ├── routes.ts                 (242 lines) - Admin API routes
│   └── index.ts                  (19 lines) - Module exports
├── db-optimizer/
│   ├── types.ts                  (147 lines) - Type definitions
│   ├── QueryProfiler.ts          (300 lines) - Query analysis
│   ├── ConnectionPoolOptimizer.ts (284 lines) - Pool health
│   ├── QueryCache.ts             (278 lines) - Query caching
│   ├── routes.ts                 (282 lines) - Admin API routes
│   └── index.ts                  (21 lines) - Module exports
├── INTEGRATION_GUIDE.md           - Detailed integration instructions
├── HARDENING_SUMMARY.md           - Feature overview
└── QUICK_START.md                 - This file
```

## Next Steps

1. Copy the modules into your project
2. Follow the 5-minute integration steps above
3. Read INTEGRATION_GUIDE.md for detailed configuration
4. Add unit tests from __tests__/services/
5. Monitor endpoints on your dashboard
6. Tune rate limits based on actual usage

## TypeScript Compilation

All files compile with strict TypeScript (no `any` types):

```bash
npx tsc --noEmit backend/src/services/rate-limiter/*.ts backend/src/services/db-optimizer/*.ts
```

## Production Checklist

- [ ] Enable rate limiting middleware on all routes
- [ ] Configure rate limit tiers for your pricing
- [ ] Set slow query threshold based on SLA
- [ ] Enable query profiling in production
- [ ] Set up monitoring dashboard
- [ ] Configure alert thresholds
- [ ] Test rate limiting manually
- [ ] Document tier limits in API docs
- [ ] Add rate limit headers to client docs
- [ ] Train support team on admin endpoints

## Support & Maintenance

All components include:
- JSDoc comments on all public methods
- Automatic cleanup and garbage collection
- Error logging via logger utility
- Memory-safe with bounded data structures
- Thread-safe (suitable for cluster mode)
