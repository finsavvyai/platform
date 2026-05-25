# F7 Cloudflare Stack - Quick Start Guide

## Installation

Each package is located in `/packages/`:

```bash
# Install dependencies for each package
cd packages/cf-stack && npm install
cd packages/cf-deploy && npm install
cd packages/cf-templates && npm install
```

---

## Package 1: cf-stack (Core Framework)

### Usage Example

```typescript
import { createApp, getD1, getKV, queryOne, kvGet } from '@finsavvyai/cf-stack';

// Create app with middleware
const app = createApp({
  corsOrigins: ['https://example.com'],
  rateLimit: { maxRequests: 100, windowMs: 60000 },
  enableErrorHandler: true,
});

// Define routes
app.get('/api/users/:id', async (c) => {
  const db = getD1(c, 'DB');
  const user = await queryOne<User>(
    db,
    'SELECT * FROM users WHERE id = ?',
    [c.req.param('id')],
  );
  return c.json(user || { error: 'Not found' }, user ? 200 : 404);
});

app.get('/api/cache/:key', async (c) => {
  const kv = getKV(c, 'CACHE');
  const cached = await kvGet<any>(kv, c.req.param('key'));
  return c.json(cached);
});

export default app;
```

### API Reference

**Bindings**
- `getD1(c, name)` - Get D1 database
- `getKV(c, name)` - Get KV namespace
- `getR2(c, name)` - Get R2 bucket

**Database**
- `queryOne<T>(db, sql, params)` - Get single row
- `queryAll<T>(db, sql, params)` - Get all rows
- `execute(db, sql, params)` - Execute query

**KV Helpers**
- `kvGet<T>(kv, key)` - Get and parse value
- `kvSet<T>(kv, key, value, ttl)` - Store value
- `kvDelete(kv, key)` - Delete key
- `kvList(kv, prefix)` - List keys with prefix

**R2 Helpers**
- `r2Put(bucket, key, body, contentType)` - Upload file
- `r2Get(bucket, key)` - Download file
- `r2Delete(bucket, key)` - Delete file
- `r2List(bucket, prefix)` - List files

**Middleware**
- `createRateLimiter(config)` - Rate limiting
- `createErrorHandler()` - Error responses
- `createCors(config)` - CORS headers

---

## Package 2: cf-deploy (Deployment)

### Generate Wrangler Config

```typescript
import { generateWranglerConfig } from '@finsavvyai/cf-deploy';

const config = generateWranglerConfig({
  accountId: '12345',
  projectName: 'my-project',
  environment: 'production',
  d1Databases: [
    { name: 'DB', databaseId: 'prod-db-123' },
  ],
  kvNamespaces: [
    { name: 'CACHE', id: 'kv-123' },
    { name: 'SESSIONS', id: 'kv-456', preview: 'preview-456' },
  ],
  r2Buckets: [
    { name: 'UPLOADS', bucketName: 'my-uploads-bucket' },
  ],
  vars: {
    API_URL: 'https://api.example.com',
    ENVIRONMENT: 'production',
  },
  queues: [
    { name: 'TASKS', queue: 'task-queue' },
  ],
});

console.log(config); // Valid wrangler.toml content
```

### Queue Producer/Consumer

```typescript
import { createQueueProducer, createQueueConsumer } from '@finsavvyai/cf-deploy';

// Producer
const producer = createQueueProducer(queue);
await producer.publish({ userId: 123, action: 'signup' });
await producer.publishBatch([
  { type: 'email', to: 'user@example.com' },
  { type: 'notification', userId: 456 },
]);

// Consumer
const consumer = createQueueConsumer(async (message) => {
  console.log('Processing:', message);
  // Your handler logic
});

await consumer.handleMessage(queueMessage);
```

### Durable Objects

```typescript
import { DurableObjectBase } from '@finsavvyai/cf-deploy';

class Counter extends DurableObjectBase {
  async increment() {
    const current = await this.getState<number>('count');
    const next = (current || 0) + 1;
    await this.setState('count', next);
    return next;
  }

  async get() {
    return this.getState<number>('count');
  }
}
```

---

## Package 3: cf-templates (Project Templates)

### Generate Project Code

```typescript
import {
  getApiTemplate,
  getWebhookTemplate,
  getCronTemplate,
  scaffoldProject,
} from '@finsavvyai/cf-templates';

// Get template code
const apiCode = getApiTemplate();
const webhookCode = getWebhookTemplate();
const cronCode = getCronTemplate();

// Scaffold project
const result = await scaffoldProject({
  template: 'api',
  name: 'my-api-project',
  outputDir: './projects',
});

console.log(result.files); // Generated file paths
```

### Template Features

**API Template**
- `/api/health` health check
- `/api/users` database queries
- `/api/subscriptions/:id` KV caching example

**Webhook Template**
- Stripe webhook validation
- Event handling (charge.succeeded, charge.refunded)
- Database and KV integration

**Cron Template**
- Scheduled job execution
- Database operations
- Task status updates
- Error handling

---

## Testing

```bash
# Run tests for a package
cd packages/cf-stack
npm test                    # Run all tests
npm run test:coverage       # Generate coverage report

# All packages pass 95%+ coverage requirement
# cf-stack:      99.51% coverage (70 tests)
# cf-deploy:     99.05% coverage (35 tests)
# cf-templates:  100% coverage (29 tests)
```

---

## File Size Constraints

All files are optimized to be ≤200 lines:

```
cf-stack/src:
  - bindings.ts (103 lines)
  - app.ts (48 lines)
  - middleware/rate-limiter.ts (58 lines)
  - middleware/cors.ts (46 lines)
  - middleware/error-handler.ts (32 lines)
  - db/helpers.ts (33 lines)
  - kv/helpers.ts (48 lines)
  - r2/helpers.ts (36 lines)

cf-deploy/src:
  - wrangler-config.ts (89 lines)
  - types.ts (52 lines)
  - queue/producer.ts (31 lines)
  - queue/consumer.ts (36 lines)
  - durable-object/base.ts (43 lines)

cf-templates/src:
  - templates/api.ts (58 lines)
  - templates/webhook.ts (68 lines)
  - templates/cron.ts (52 lines)
  - scaffold.ts (54 lines)
```

---

## Secure Coding Practices

### No Secrets in Code
- Credentials passed via environment variables
- Configuration through function parameters
- All inputs validated with TypeScript

### Parameterized Queries
```typescript
// Safe - parameters bound at DB level
await queryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]);

// Unsafe - never do this
await queryOne(db, `SELECT * FROM users WHERE id = ${userId}`, []);
```

### Type Safety
- Strict TypeScript mode enabled
- All functions have explicit types
- No `any` types except where necessary

---

## Common Patterns

### API Endpoint with Caching

```typescript
app.get('/api/data/:id', async (c) => {
  const kv = getKV(c, 'CACHE');
  const cacheKey = `data:${c.req.param('id')}`;

  // Try cache first
  const cached = await kvGet(kv, cacheKey);
  if (cached) return c.json(cached);

  // Query database
  const db = getD1(c, 'DB');
  const data = await queryOne(db, 'SELECT * FROM data WHERE id = ?', [
    c.req.param('id'),
  ]);

  // Cache result for 1 hour
  if (data) {
    await kvSet(kv, cacheKey, data, 3600);
  }

  return c.json(data || { error: 'Not found' }, data ? 200 : 404);
});
```

### Webhook Handler

```typescript
app.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 401);
  }

  const event = await c.req.json();
  const db = getD1(c, 'DB');

  switch (event.type) {
    case 'charge.succeeded':
      await execute(db, 'INSERT INTO payments (stripe_id, status) VALUES (?, ?)', [
        event.data.object.id,
        'completed',
      ]);
      break;
  }

  return c.json({ received: true });
});
```

---

## Build & Deploy

```bash
# Build all packages
npm run build  # In each package directory

# Deploy to Cloudflare
wrangler publish

# Environment-specific deployment
wrangler publish --env production
```

---

## Architecture Overview

```
Application Layer
  ↓
  @finsavvyai/cf-stack (Hono + Middleware)
  ├─ Error Handling
  ├─ CORS
  ├─ Rate Limiting
  └─ Binding Helpers
  ↓
Cloudflare Workers Platform
  ├─ D1 (Database)
  ├─ KV (Cache)
  ├─ R2 (Storage)
  ├─ Queues
  └─ Durable Objects
  ↓
  @finsavvyai/cf-deploy (Config + Abstractions)
  ├─ Wrangler Config Generation
  ├─ Queue Management
  └─ Durable Object Patterns
  ↓
  @finsavvyai/cf-templates (Project Scaffolds)
  ├─ API Template
  ├─ Webhook Template
  └─ Cron Template
```

---

## Deployment Checklist

- [ ] All tests passing (npm test)
- [ ] Coverage at 95%+ (npm run test:coverage)
- [ ] Build succeeds (npm run build)
- [ ] No TypeScript errors (npm run build)
- [ ] Environment variables configured
- [ ] wrangler.toml generated from cf-deploy
- [ ] Cloudflare bindings configured
- [ ] Database migrations applied
- [ ] Deploy to production (wrangler publish)

---

## Support & Resources

- **TypeScript:** Strict mode enabled
- **Testing:** Vitest with 134+ tests
- **Coverage:** 99.52% average
- **Code Style:** All files ≤200 lines

For more details, see CF_STACK_BUILD_SUMMARY.md
