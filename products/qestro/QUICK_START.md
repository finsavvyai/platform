# Webhook & Audit System - Quick Start Guide

## Installation & Setup (5 minutes)

### Step 1: Review Files
All files are ready in:
- `backend/src/services/webhooks/` - Webhook system
- `backend/src/services/audit/` - Audit system

### Step 2: Update Express App

```typescript
import express from 'express';
import { webhookRouter } from './services/webhooks/index.js';
import { auditRouter, createAuditMiddleware, AuditLogger } from './services/audit/index.js';

const app = express();
const auditLogger = new AuditLogger();

// Middleware
app.use(express.json());
app.use(createAuditMiddleware(auditLogger));

// Routes
app.use('/api/webhooks', webhookRouter);
app.use('/api/audit', auditRouter);

app.listen(3000);
```

### Step 3: Create Services Instance

```typescript
import { WebhookManager } from './services/webhooks/index.js';

// Initialize services
const webhookManager = new WebhookManager();
const auditLogger = new AuditLogger();

// Export for use in other modules
export { webhookManager, auditLogger };
```

## Usage Examples (2 minutes each)

### Register a Webhook

```typescript
import { webhookManager } from './services.js';

const webhookId = await webhookManager.registerWebhook(
  'proj-123',
  'https://api.slack.com/webhooks/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX',
  ['test.failed', 'alert.triggered'],
  userId,
  { maxRetries: 3, timeout: 30000 }
);

console.log(`Webhook registered: ${webhookId}`);
```

### Emit a Webhook Event

```typescript
import { webhookManager } from './services.js';
import crypto from 'crypto';

await webhookManager.emit({
  id: crypto.randomUUID(),
  type: 'test.completed',
  projectId: 'proj-123',
  timestamp: new Date(),
  data: {
    testId: 'test-1',
    testName: 'Login Flow',
    status: 'passed',
    duration: 2500,
  },
});
```

### Log an Action

```typescript
import { auditLogger } from './services.js';

await auditLogger.log({
  userId: 'user-123',
  userEmail: 'user@example.com',
  action: 'test.executed',
  category: 'test_execution',
  projectId: 'proj-123',
  description: 'Test executed: Login Flow',
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  status: 'success',
  metadata: { duration: 2500, passed: true },
});
```

### Query Audit Logs

```typescript
import { auditLogger } from './services.js';

const result = await auditLogger.query({
  userId: 'user-123',
  category: 'test_execution',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  limit: 50,
});

console.log(`Found ${result.entries.length} audit entries`);
```

### Generate Compliance Report

```typescript
import { auditLogger } from './services.js';

const report = await auditLogger.generateComplianceReport(
  'org-123',
  new Date('2026-01-01'),
  new Date('2026-03-31'),
  userId
);

console.log(`Report: ${report.summary.totalActions} actions`);
console.log(`Success rate: ${report.summary.successfulActions / report.summary.totalActions * 100}%`);
```

## API Endpoints (Ready Now)

### Webhooks
```
POST   /api/webhooks?projectId=proj-123          Register webhook
GET    /api/webhooks?projectId=proj-123          List webhooks
GET    /api/webhooks/:id                         Get webhook details
DELETE /api/webhooks/:id                         Remove webhook
PATCH  /api/webhooks/:id                         Update webhook
GET    /api/webhooks/:id/deliveries              Delivery history
POST   /api/webhooks/:id/test                    Send test event
```

### Audit
```
GET    /api/audit/logs?limit=100&offset=0        Query logs (admin)
GET    /api/audit/users/:userId/activity         User activity
GET    /api/audit/compliance-report              Compliance report (admin)
GET    /api/audit/export                         CSV export (admin)
POST   /api/audit/log                            Manual logging
GET    /api/audit/stats?userId=user-123          User stats (admin)
```

## Integration Checklist

- [ ] Copy webhook and audit system files
- [ ] Install dependencies (crypto is built-in)
- [ ] Add routes to Express app
- [ ] Initialize services
- [ ] Update test execution to emit webhooks
- [ ] Connect to database (schema provided)
- [ ] Test webhook delivery
- [ ] Test audit logging
- [ ] Run unit tests: `npm test`

## Documentation Files

| File | Purpose |
|------|---------|
| `WEBHOOK_AUDIT_README.md` | Complete system overview (500+ lines) |
| `IMPLEMENTATION_EXAMPLE.ts` | Working code examples (250+ lines) |
| `webhooks/INTEGRATION.md` | Webhook integration guide |
| `audit/INTEGRATION.md` | Audit integration guide |
| `WEBHOOK_AUDIT_SUMMARY.md` | Executive summary |
| `FILE_MANIFEST.txt` | Complete file listing |

## Key Features Ready

### Webhook System
- 6 event types (test.completed, test.failed, run.started, run.completed, alert.triggered, deployment.status)
- HMAC-SHA256 signing for security
- Automatic retry with exponential backoff
- Delivery history and statistics
- REST API for management

### Audit System
- 25+ trackable actions
- 9 audit categories
- Flexible querying (user, project, action, date, status, IP)
- Compliance reporting
- CSV export
- User activity tracking
- Automatic request logging

## Next Steps

1. **Database Integration**
   - Use provided schema for PostgreSQL/MySQL
   - Implement persistence layer with Drizzle ORM

2. **Start Event Emission**
   - Emit webhooks from test execution service
   - Log actions from test controllers

3. **Build UI Dashboard**
   - Webhook management interface
   - Audit log viewer
   - Compliance report viewer

4. **Advanced Features**
   - Webhook payload compression
   - Webhook analytics
   - Alert rules on audit events
   - Data retention policies

## Support Files

All files include:
- JSDoc comments on public methods
- Type definitions (strict TypeScript)
- Error handling (explicit errors)
- Unit tests (comprehensive coverage)
- Integration guides (detailed steps)

## Production Notes

- All endpoints require authentication
- Admin-only operations are marked
- HMAC signatures prevent tampering
- Retries prevent transient failures
- Exponential backoff prevents hammering
- Indexed queries for performance
- Paginated results for large datasets

## Testing

```bash
# Run all tests
npm test

# Run specific tests
npm test -- WebhookManager.test.ts
npm test -- AuditLogger.test.ts

# Run with coverage
npm test -- --coverage
```

## Troubleshooting

### Webhooks not delivering
- Check webhook URL is accessible
- Verify network timeout (default 30s)
- Check delivery history: `GET /api/webhooks/:id/deliveries`
- Verify HMAC signature with provided method

### Audit logs empty
- Ensure middleware is mounted before routes
- Verify user authentication is working
- Check log levels in logger config
- Verify database persistence (if using)

### Import errors
- All imports use `.js` extensions (ES modules)
- Ensure `"type": "module"` in package.json
- Check TypeScript strict mode enabled

## Performance Tips

- Webhook delivery is asynchronous (non-blocking)
- Audit logging uses in-memory indexing (fast)
- All queries support pagination
- Database queries have indexes on key columns
- Retry logic uses exponential backoff

## Security Tips

- All endpoints require authentication
- HMAC signatures prevent payload tampering
- Timeouts prevent hanging requests
- IP and user agent logged for audit
- Admin-only endpoints are protected

That's it! You're ready to go.

For detailed information, see:
- `WEBHOOK_AUDIT_README.md` - Complete documentation
- `IMPLEMENTATION_EXAMPLE.ts` - Working examples
- Integration guides in each module
