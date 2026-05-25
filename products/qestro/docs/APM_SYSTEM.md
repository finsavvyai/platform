# Performance Monitoring & APM System

Qestro's distributed tracing and metrics collection system for comprehensive application performance monitoring.

## Architecture

### Components

1. **TraceCollector** — Distributed tracing with span hierarchy
2. **MetricsEngine** — Time-series metrics with aggregation
3. **AlertManager** — Threshold-based alerting with webhooks
4. **APMMiddleware** — Express middleware for auto-instrumentation

### Data Flow

```
HTTP Request
    ↓
APMMiddleware (start trace)
    ↓
Route Handler (create spans)
    ↓
APMMiddleware (end span, record metrics)
    ↓
HTTP Response
    ↓
MetricsEngine (store metrics)
    ↓
AlertManager (evaluate rules)
```

## Tracing (Distributed)

### Start a Trace

```typescript
import { TraceCollector } from '@qestro/apm';

const collector = new TraceCollector();
const trace = collector.startTrace('test-execution', {
  testId: '123',
  userId: 'user-456',
});
```

### Create Spans

```typescript
// Parent span
const parentSpan = collector.startSpan(
  trace.traceId,
  'navigate-to-url',
  trace.rootSpanId
);

await navigateToUrl(url);

collector.endSpan(parentSpan.spanId, 'ok', {
  finalUrl: page.url(),
});

// Child span
const clickSpan = collector.startSpan(
  trace.traceId,
  'click-button',
  parentSpan.spanId
);

await page.click('button');

collector.endSpan(clickSpan.spanId, 'ok');
```

### End Trace

```typescript
const endedTrace = collector.endTrace(trace.traceId);

console.log({
  duration: endedTrace.duration,
  spanCount: endedTrace.spans.length,
  status: endedTrace.status,
});
```

### Analyze Bottlenecks

```typescript
// Get slowest spans
const slowest = collector.getSlowestSpans(trace.traceId, 10);

// Identify bottlenecks (>10% of total duration)
const bottlenecks = collector.getBottlenecks(trace.traceId);
```

## Metrics

### Record Metrics

```typescript
import { MetricsEngine } from '@qestro/apm';

const engine = new MetricsEngine();

// Request duration
engine.recordMetric('request_duration', 150, {
  endpoint: '/api/tests',
  method: 'GET',
});

// Custom metrics
engine.recordMetric('test_execution_time', 5000, {
  testId: '123',
  browser: 'chrome',
});
```

### Built-in Metrics

- `request_duration` — HTTP request latency (ms)
- `test_execution_time` — Test execution time (ms)
- `queue_depth` — Bull job queue size
- `error_rate` — Errors per minute
- `memory_usage_mb` — Memory usage (MB)
- `cpu_usage_percent` — CPU utilization (%)

### Query Metrics

```typescript
// Get raw metrics
const metrics = engine.getMetrics('request_duration', {
  start: Date.now() - 3600000,
  end: Date.now(),
});

// Get statistics
const stats = engine.getStats('request_duration');
// { count, latest, min, max, avg }

// Get latest value
const latest = engine.getLatestValue('request_duration');
```

### Aggregation

```typescript
// Aggregate by minute
engine.aggregateMetrics('request_duration', 'minute');

const aggregated = engine.getAggregated(
  'request_duration',
  'minute'
);

// Each point includes: min, max, avg, p95, p99, count
```

## Alerting

### Define Alert Rules

```typescript
import { AlertManager } from '@qestro/apm';

const alertManager = new AlertManager(metricsEngine);

alertManager.addRule({
  ruleId: 'high-latency-alert',
  name: 'High Request Latency',
  metricName: 'request_duration',
  condition: 'gt', // greater than
  threshold: 2000, // milliseconds
  duration: 30000, // alert after 30s of condition
  enabled: true,
  channels: ['webhook'],
  webhookUrl: 'https://your-webhook.com/alerts',
});
```

### Conditions

- `'gt'` — Greater than threshold
- `'lt'` — Less than threshold
- `'eq'` — Equals threshold

### Evaluate Alerts

```typescript
// Manual evaluation
const newAlerts = await alertManager.evaluate();

// Automatic evaluation (recommended)
setInterval(async () => {
  await alertManager.evaluate();
}, 30000); // Every 30 seconds
```

### Get Alerts

```typescript
// Active alerts
const active = alertManager.getActiveAlerts();

// Alert history
const history = alertManager.getAlertHistory(100);
```

### Notification Channels

- **Webhook** — HTTP POST with alert data
- **Email** — (Placeholder, requires email service integration)

## Express Middleware

### Setup

```typescript
import { APMMiddleware } from '@qestro/apm';

const apmMiddleware = new APMMiddleware(collector, metricsEngine);

app.use(apmMiddleware.middleware());
app.use(apmMiddleware.errorMiddleware());
```

### Auto-Instrumentation

The middleware automatically:
- Traces each HTTP request
- Records request duration
- Captures response status codes
- Logs resource usage
- Marks errors in traces

### Custom Trace IDs

```typescript
// Pass trace ID via header
fetch('/api/test', {
  headers: { 'X-Trace-ID': 'my-trace-123' },
});
```

## API Routes

### Traces

```
GET /api/apm/traces
  Returns recent traces (paginated)

GET /api/apm/traces/:id
  Returns trace details with bottlenecks
```

### Metrics

```
GET /api/apm/metrics/:name
  Returns metric data for time range

GET /api/apm/summary
  System health summary (all metrics)

GET /api/apm/aggregated/:name
  Aggregated metrics (minute/hour/day)
```

### Alerts

```
GET /api/apm/alerts
  Active alerts and history

POST /api/apm/alerts/rules
  Create alert rule

GET /api/apm/alerts/rules
  List all rules

DELETE /api/apm/alerts/rules/:id
  Remove rule

POST /api/apm/alerts/evaluate
  Manually trigger evaluation
```

## Example: Test Execution Monitoring

```typescript
import { APMIntegration } from '@qestro/apm';

// Initialize
APMIntegration.initialize();

// Start trace for test
const trace = APMIntegration.traceCollector.startTrace(
  `test-run-${testId}`,
  { testId, projectId, userId }
);

try {
  // Browser setup
  const setupSpan = APMIntegration.traceCollector.startSpan(
    trace.traceId,
    'browser-setup',
    trace.rootSpanId
  );

  const browser = await playwright.chromium.launch();

  APMIntegration.traceCollector.endSpan(setupSpan.spanId, 'ok');

  // Test execution
  const runSpan = APMIntegration.traceCollector.startSpan(
    trace.traceId,
    'test-execution',
    trace.rootSpanId
  );

  const startTime = Date.now();
  const result = await runTest(browser, testCase);
  const duration = Date.now() - startTime;

  APMIntegration.traceCollector.endSpan(
    runSpan.spanId,
    result.passed ? 'ok' : 'error'
  );

  APMIntegration.metricsEngine.recordMetric(
    'test_execution_time',
    duration,
    {
      testId,
      browser: 'chromium',
      status: result.passed ? 'pass' : 'fail',
    }
  );

  // End trace
  const endedTrace = APMIntegration.traceCollector.endTrace(
    trace.traceId
  );

  // Store in database
  await db.testRun.create({
    traceId: endedTrace.traceId,
    duration: endedTrace.duration,
    bottlenecks: APMIntegration.traceCollector.getBottlenecks(
      trace.traceId
    ),
  });

  return result;
} catch (error) {
  const failSpan = APMIntegration.traceCollector.startSpan(
    trace.traceId,
    'error-handler',
    trace.rootSpanId
  );

  APMIntegration.traceCollector.endSpan(
    failSpan.spanId,
    'error',
    { error: error.message }
  );

  APMIntegration.traceCollector.endTrace(trace.traceId);

  throw error;
}
```

## Dashboards & Observability

### Metrics to Monitor

1. **Request Performance**
   - p95, p99 latency
   - Error rate (%)
   - Throughput (req/s)

2. **Test Execution**
   - Average test duration
   - Flaky tests (var in duration)
   - Browser performance breakdown

3. **System Health**
   - Memory usage
   - Queue depth
   - Error count

### Alerting Strategy

- **Critical**: Error rate > 5%
- **Warning**: p95 latency > 2s
- **Info**: Queue depth > 100

## Configuration

```typescript
const config = {
  // Trace collector
  maxTracesInBuffer: 1000,
  enableAutoFlush: true,
  flushIntervalMs: 60000,

  // Metrics engine
  retentionMs: 86400000, // 24 hours
  aggregationIntervals: ['minute', 'hour', 'day'],
};
```

## Performance Impact

- **Tracing overhead**: ~5-10% latency
- **Memory per trace**: ~1-5KB
- **Metrics overhead**: Negligible
- **Alerting**: Runs every 30s asynchronously

## Best Practices

1. **Name spans consistently** — use verb-noun: `navigate-to-url`
2. **Add metadata** — trace IDs, user IDs, test IDs
3. **Monitor baselines** — understand normal ranges
4. **Alert on anomalies** — not just thresholds
5. **Clean up traces** — auto-flush old traces to prevent memory leaks
