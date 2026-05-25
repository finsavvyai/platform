# Webhook System Integration Guide

## Overview
The Webhook System provides event-driven integration capabilities for Qestro, allowing external systems to subscribe to test execution events, deployments, and alerts.

## Components

### WebhookManager
Central service for managing webhook lifecycle:
- Register/remove webhooks
- List webhooks by project
- Emit events to matching webhooks
- Track delivery history
- Manage retry logic with exponential backoff

### WebhookDeliveryService
Handles HTTP delivery of webhook payloads:
- POST requests with configurable timeouts
- HMAC-SHA256 signing for payload verification
- Automatic retry with exponential backoff (default: 3 retries)
- Delivery status tracking

## Quick Start

### 1. Initialize WebhookManager
```typescript
import { WebhookManager } from './services/webhooks/index.js';

const webhookManager = new WebhookManager();
```

### 2. Register a Webhook
```typescript
const webhookId = await webhookManager.registerWebhook(
  projectId,
  'https://example.com/webhooks/test-events',
  ['test.completed', 'test.failed'],
  userId,
  {
    secret: 'your-secret-key',
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 30000,
  }
);
```

### 3. Emit Events
```typescript
const event = {
  id: crypto.randomUUID(),
  type: 'test.completed',
  projectId: 'proj-123',
  timestamp: new Date(),
  data: {
    testId: 'test-456',
    testName: 'Login Flow',
    status: 'passed',
    duration: 2345,
  },
};

await webhookManager.emit(event);
```

### 4. Verify Webhook Signatures
```typescript
import { WebhookDeliveryService } from './services/webhooks/index.js';

const isValid = WebhookDeliveryService.verifySignature(
  payloadBody,
  req.headers['x-qestro-signature'],
  webhookSecret
);
```

## Webhook Events

All events include:
- `id`: Unique event identifier
- `type`: Event type (see WebhookEventType)
- `projectId`: Associated project
- `timestamp`: Event creation time
- `data`: Event-specific payload

### Event Types
- `test.completed` - Test execution completed successfully
- `test.failed` - Test execution failed
- `run.started` - Test run initiated
- `run.completed` - Test run finished
- `alert.triggered` - Alert condition met
- `deployment.status` - Deployment status changed

## Delivery Headers

Every webhook request includes:
- `X-Qestro-Signature`: HMAC-SHA256 signature of payload
- `X-Qestro-Delivery-ID`: Unique delivery identifier
- `X-Qestro-Event-Type`: Type of event
- `X-Qestro-Timestamp`: Event timestamp

## Retry Logic

Failed deliveries are retried with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: After `retryDelay` ms
- Attempt 3: After `retryDelay * 2` ms
- Attempt 4: After `retryDelay * 4` ms (if maxRetries >= 4)

## Database Considerations

For production use, implement database persistence:

```sql
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array
  active BOOLEAN NOT NULL DEFAULT true,
  max_retries INT NOT NULL DEFAULT 3,
  retry_delay INT NOT NULL DEFAULT 5000,
  timeout INT NOT NULL DEFAULT 30000,
  headers TEXT, -- JSON object
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id),
  event_id TEXT NOT NULL,
  attempt INT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed', 'retrying'
  status_code INT,
  response_body TEXT,
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL,
  delivery_time INT NOT NULL,
  signature TEXT NOT NULL
);

CREATE INDEX idx_webhooks_project ON webhooks(project_id);
CREATE INDEX idx_webhooks_active ON webhooks(active);
CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id);
```

## Express Integration

Add webhook routes to your Express app:

```typescript
import express from 'express';
import { webhookRouter } from './services/webhooks/index.js';

const app = express();

// Mount webhook routes
app.use('/api/webhooks', webhookRouter);
```

## Error Handling

The system gracefully handles:
- Invalid URLs
- Network timeouts
- HTTP error responses
- Malformed payloads
- Concurrent delivery requests

All errors are logged and delivery failures are tracked in history.
