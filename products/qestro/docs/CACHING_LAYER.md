# Multi-Tier Caching Layer

Qestro's intelligent caching system with LRU/LFU eviction, TTL support, and pattern-based invalidation.

## Architecture

### Cache Tiers

1. **L1 Cache** — In-memory (fast, limited size)
2. **L2 Cache** — Redis (warm, larger capacity)

### Data Flow

```
GET Request
    ↓
Check L1 (in-memory) — 0.1ms
    ✓ Found? Return
    ✗ Miss → Check L2
    ↓
Check L2 (Redis) — 1-5ms
    ✓ Found? Populate L1, return
    ✗ Miss → Query DB
    ↓
Database Query — 10-100ms
    ↓
Set L1 + L2
    ↓
Return Response
```

## Configuration

### Initialize Cache

```typescript
import { CacheManager, CacheIntegration } from '@qestro/cache';

// Manual initialization
const cache = new CacheManager({
  maxSizeBytes: 100 * 1024 * 1024, // 100MB L1
  maxEntriesL1: 10000,
  evictionPolicy: 'lru', // 'lru' | 'lfu' | 'ttl'
  defaultTtlSeconds: 3600, // 1 hour
  enableL2: true,
  l2Host: 'localhost',
  l2Port: 6379,
  l2Db: 0,
});

// Auto-integration
CacheIntegration.initialize();
```

## Usage

### Set & Get

```typescript
// Set with default TTL
await cache.set('user:123:profile', {
  id: 123,
  name: 'Alice',
  email: 'alice@example.com',
});

// Get
const user = await cache.get('user:123:profile');

// Set with custom TTL
await cache.set('session:abc123', sessionData, 1800); // 30 min

// Get latest value
const latest = await cache.getLatestValue('user:123:profile');
```

### Delete & Invalidate

```typescript
// Delete single entry
await cache.delete('user:123:profile');

// Invalidate by pattern (regex)
await cache.invalidatePattern('user:.*:profile'); // All user profiles

// Invalidate all tests in project
await cache.invalidatePattern(`project:${projectId}:.*`);

// Clear all caches
await cache.clear();
```

### Statistics

```typescript
const stats = cache.getStats();

// {
//   hitsL1: 450,
//   hitsL2: 85,
//   misses: 65,
//   totalSize: 5242880, // bytes
//   entriesL1: 150,
//   entriesL2: 250,
//   hitRate: 0.89
// }

console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### Event History

```typescript
const events = cache.getEventHistory(100);

// Each event: { type, key, layer, timestamp, hitRate }
// Types: 'hit', 'miss', 'set', 'delete', 'evict'
```

## Express Middleware

### Response Caching

```typescript
import { CacheIntegration } from '@qestro/cache';

CacheIntegration.initialize();

// Cache all GET /api/projects responses for 1 hour
app.get(
  '/api/projects',
  CacheIntegration.cacheResponse(3600),
  async (req, res) => {
    const projects = await db.project.findAll();
    res.json(projects);
  }
);

// With custom cache key generator
app.get(
  '/api/users/:id',
  CacheIntegration.cacheResponse(
    3600,
    (req) => `user:${req.params.id}:data`
  ),
  async (req, res) => {
    const user = await db.user.findById(req.params.id);
    res.json(user);
  }
);
```

### Cache Invalidation on Mutations

```typescript
// Invalidate related cache on POST/PUT/DELETE
app.post(
  '/api/projects',
  CacheIntegration.invalidateOnMutation([
    'GET:/api/projects', // Invalidate project list
    'GET:/api/dashboard', // Invalidate dashboard
  ]),
  async (req, res) => {
    const project = await db.project.create(req.body);
    res.json(project);
  }
);

// Update project
app.put(
  '/api/projects/:id',
  CacheIntegration.invalidateOnMutation([
    `GET:/api/projects/${req.params.id}`, // This project
    'GET:/api/projects', // Project list
  ]),
  async (req, res) => {
    const project = await db.project.update(req.params.id, req.body);
    res.json(project);
  }
);
```

### ETags & Conditional Requests

```typescript
// Automatic ETag generation
GET /api/projects/123
Response:
  ETag: "abc123def456"
  X-Cache: MISS

// Client sends conditional request
GET /api/projects/123
  If-None-Match: abc123def456

Response:
  304 Not Modified
  X-Cache: HIT
```

### Skip Caching for Specific Routes

```typescript
app.use(
  CacheIntegration.cacheMiddleware.skipCache((req) => {
    // Don't cache authenticated endpoints
    return req.user !== undefined;
  })
);
```

## Eviction Policies

### LRU (Least Recently Used)

```typescript
// Default: evicts least recently accessed
const cache = new CacheManager({
  evictionPolicy: 'lru',
  maxEntriesL1: 10000,
});

// Good for: General workloads, hot data access patterns
```

### LFU (Least Frequently Used)

```typescript
// Evicts least frequently accessed
const cache = new CacheManager({
  evictionPolicy: 'lfu',
  maxEntriesL1: 10000,
});

// Good for: Working set doesn't fit, some data accessed often
```

### TTL (Time-To-Live)

```typescript
// Evicts entries with shortest remaining TTL
const cache = new CacheManager({
  evictionPolicy: 'ttl',
  maxEntriesL1: 10000,
  defaultTtlSeconds: 3600,
});

// Good for: Time-sensitive data (sessions, temporary results)
```

## API Routes

### Cache Statistics

```
GET /api/cache/stats
  {
    "stats": {
      "hitsL1": 450,
      "hitsL2": 85,
      "misses": 65,
      "totalSize": 5242880,
      "entriesL1": 150,
      "entriesL2": 250,
      "hitRate": 0.89
    },
    "info": {
      "hitRatePercent": "89.00",
      "totalRequests": 600,
      "l1Efficiency": "75.00"
    }
  }
```

### Cache Events

```
GET /api/cache/events?limit=100
  Returns last 100 cache operations
  (hits, misses, sets, deletes, evictions)
```

### Invalidate Pattern

```
POST /api/cache/invalidate
  Body: { "pattern": "user:.*:profile" }
  Response: { "pattern": "...", "invalidated": 25 }
```

### Flush All Caches

```
POST /api/cache/flush
  Clears L1 and L2 caches
  Response: { "message": "All caches flushed", "timestamp": ... }
```

### Cache Health Check

```
GET /api/cache/health
  {
    "healthy": true,
    "hitRate": "89.50",
    "totalSize": 5242880,
    "entries": 400,
    "status": "good"
  }
```

## Examples

### Caching Test Results

```typescript
// Get or fetch test results
async function getTestResults(testId: string) {
  const cacheKey = `test:${testId}:results`;

  // Try cache first
  let results = await cache.get(cacheKey);

  if (results) {
    return results;
  }

  // Fetch from database
  results = await db.testResult.findByTestId(testId);

  // Cache for 1 hour
  await cache.set(cacheKey, results, 3600);

  return results;
}

// Invalidate when test runs
app.post('/api/tests/:id/run', async (req, res) => {
  const result = await runTest(req.params.id);

  // Invalidate test cache
  await cache.invalidatePattern(`test:${req.params.id}:.*`);

  res.json(result);
});
```

### Caching User Data

```typescript
async function getUserProfile(userId: string) {
  const key = `user:${userId}:profile`;

  let user = await cache.get(key);

  if (!user) {
    user = await db.user.findById(userId);
    await cache.set(key, user, 1800); // 30 min
  }

  return user;
}

// Invalidate on user update
app.put('/api/users/:id', async (req, res) => {
  const updated = await db.user.update(req.params.id, req.body);

  // Invalidate all user cache entries
  await cache.invalidatePattern(`user:${req.params.id}:.*`);

  res.json(updated);
});
```

### Caching Project Metadata

```typescript
async function getProjectTests(projectId: string) {
  const key = `project:${projectId}:tests`;

  let tests = await cache.get(key);

  if (!tests) {
    tests = await db.test.findByProjectId(projectId);
    await cache.set(key, tests, 3600); // 1 hour
  }

  return tests;
}

// Invalidate when creating/updating tests
app.post('/api/projects/:id/tests', async (req, res) => {
  const test = await db.test.create({
    projectId: req.params.id,
    ...req.body,
  });

  // Invalidate project cache
  await cache.invalidatePattern(`project:${req.params.id}:.*`);

  res.json(test);
});
```

## Performance Tips

1. **Use appropriate TTLs**
   - Hot data: 30 min
   - Moderate: 1 hour
   - Cold data: 24 hours

2. **Cache strategically**
   - Heavy queries → cache
   - Frequently accessed → cache
   - Frequently changing → shorter TTL

3. **Invalidate efficiently**
   - Use patterns: `user:.*:profile`
   - Invalidate on mutations, not time
   - Group related data with prefix

4. **Monitor hit rate**
   - Good: > 80%
   - Acceptable: 60-80%
   - Poor: < 60% (need to optimize)

5. **Set appropriate limits**
   - L1: Balance between hits and memory
   - L2: Larger capacity for warm data
   - Default: 100MB L1, 1GB L2

## Troubleshooting

### Low Hit Rate

```typescript
// Check if entries are expiring too fast
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);

// Increase TTL
await cache.set(key, value, 7200); // 2 hours instead of 1
```

### Memory Usage High

```typescript
// Check cache stats
const stats = cache.getStats();
console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(1)}MB`);

// Reduce max size or entries
const cache = new CacheManager({
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxEntriesL1: 5000,
});
```

### L2 Not Working

```typescript
// Verify Redis is running
// Check L2 configuration
const cache = new CacheManager({
  enableL2: true,
  l2Host: 'localhost', // Correct host
  l2Port: 6379,
});

// Will silently fall back to L1 if L2 unavailable
```
