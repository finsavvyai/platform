# APM & Caching Integration Guide

Complete guide to integrating Performance Monitoring and Caching systems into Qestro backend.

## Quick Start

### 1. Initialize Both Systems

```typescript
// backend/src/index.ts
import express from 'express';
import { APMIntegration } from '@qestro/apm';
import { CacheIntegration } from '@qestro/cache';

const app = express();

// Initialize APM
APMIntegration.initialize();
APMIntegration.registerMiddleware(app);
APMIntegration.registerRoutes(app);
APMIntegration.startAlertEvaluation(30000); // Every 30s

// Initialize Cache
CacheIntegration.initialize();
CacheIntegration.registerRoutes(app);
```

### 2. Add Cache to Existing Routes

```typescript
// Example: GET /api/projects
app.get(
  '/api/projects',
  CacheIntegration.cacheResponse(3600), // Cache for 1 hour
  async (req, res) => {
    const projects = await db.project.findAll();
    res.json(projects);
  }
);

// Example: Create project (invalidates cache)
app.post(
  '/api/projects',
  CacheIntegration.invalidateOnMutation([
    'GET:/api/projects',
    'GET:/api/dashboard',
  ]),
  async (req, res) => {
    const project = await db.project.create(req.body);
    res.json(project);
  }
);
```

### 3. Add Custom Tracing to Services

```typescript
// backend/src/services/TestExecutor.ts
import { APMIntegration } from '@qestro/apm';

export class TestExecutor {
  async executeTest(testId: string) {
    const trace = APMIntegration.traceCollector.startTrace(
      `execute-test-${testId}`,
      { testId }
    );

    try {
      const setupSpan = APMIntegration.traceCollector.startSpan(
        trace.traceId,
        'browser-setup',
        trace.rootSpanId
      );

      const browser = await this.setupBrowser();

      APMIntegration.traceCollector.endSpan(setupSpan.spanId, 'ok');

      const runSpan = APMIntegration.traceCollector.startSpan(
        trace.traceId,
        'test-run',
        trace.rootSpanId
      );

      const startTime = Date.now();
      const result = await this.runTest(browser, testId);
      const duration = Date.now() - startTime;

      APMIntegration.traceCollector.endSpan(
        runSpan.spanId,
        result.passed ? 'ok' : 'error'
      );

      APMIntegration.metricsEngine.recordMetric(
        'test_execution_time',
        duration,
        { testId, browser: 'chromium', status: result.passed ? 'pass' : 'fail' }
      );

      return APMIntegration.traceCollector.endTrace(trace.traceId);
    } catch (error) {
      APMIntegration.traceCollector.endTrace(trace.traceId);
      throw error;
    }
  }
}
```

## Environment Configuration

### .env

```bash
# APM Configuration
APM_ENABLED=true
APM_MAX_TRACES=1000
APM_FLUSH_INTERVAL_MS=60000
APM_RETENTION_MS=86400000

# Cache Configuration
CACHE_ENABLED=true
CACHE_MAX_SIZE_MB=100
CACHE_MAX_ENTRIES=10000
CACHE_EVICTION_POLICY=lru
CACHE_DEFAULT_TTL_SECONDS=3600

# Redis (L2 Cache)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### Load from Environment

```typescript
// backend/src/config/apm.config.ts
export const apmConfig = {
  enabled: process.env.APM_ENABLED === 'true',
  maxTraces: parseInt(process.env.APM_MAX_TRACES ?? '1000'),
  flushIntervalMs: parseInt(
    process.env.APM_FLUSH_INTERVAL_MS ?? '60000'
  ),
  retentionMs: parseInt(
    process.env.APM_RETENTION_MS ?? '86400000'
  ),
};

// backend/src/config/cache.config.ts
export const cacheConfig = {
  enabled: process.env.CACHE_ENABLED === 'true',
  maxSizeBytes:
    parseInt(process.env.CACHE_MAX_SIZE_MB ?? '100') * 1024 * 1024,
  maxEntriesL1: parseInt(process.env.CACHE_MAX_ENTRIES ?? '10000'),
  evictionPolicy: process.env.CACHE_EVICTION_POLICY ?? 'lru',
  defaultTtlSeconds: parseInt(
    process.env.CACHE_DEFAULT_TTL_SECONDS ?? '3600'
  ),
  enableL2: process.env.REDIS_ENABLED === 'true',
  l2Host: process.env.REDIS_HOST ?? 'localhost',
  l2Port: parseInt(process.env.REDIS_PORT ?? '6379'),
  l2Db: parseInt(process.env.REDIS_DB ?? '0'),
};
```

## Monitoring Dashboard Data

### Key Metrics to Display

```typescript
// frontend/src/hooks/useAPMMetrics.ts
export function useAPMMetrics() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch('/api/apm/summary');
      setMetrics(await response.json());
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Every 10s

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

// frontend/src/components/APMDashboard.tsx
export function APMDashboard() {
  const metrics = useAPMMetrics();

  if (!metrics) return <Loading />;

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard
        title="Avg Request Latency"
        value={`${metrics.metrics.request_duration.avg.toFixed(0)}ms`}
        trend="down"
      />

      <MetricCard
        title="Error Rate"
        value={`${(
          (metrics.metrics.error_rate.count / 1000) *
          100
        ).toFixed(2)}%`}
        trend="down"
      />

      <MetricCard
        title="Memory Usage"
        value={`${(
          metrics.metrics.memory_usage_mb.latest / 1024
        ).toFixed(1)}GB`}
        trend="stable"
      />

      <MetricCard
        title="Active Traces"
        value={metrics.traces.totalTraces}
        trend="up"
      />
    </div>
  );
}
```

### Cache Statistics Dashboard

```typescript
// frontend/src/hooks/useCacheStats.ts
export function useCacheStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      const response = await fetch('/api/cache/stats');
      setStats(await response.json());
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}

// frontend/src/components/CacheDashboard.tsx
export function CacheDashboard() {
  const data = useCacheStats();

  if (!data) return <Loading />;

  return (
    <div>
      <ProgressBar
        label="Hit Rate"
        value={data.stats.hitRate * 100}
        color={data.stats.hitRate > 0.8 ? 'green' : 'yellow'}
      />

      <StatsGrid
        stats={[
          {
            label: 'L1 Hits',
            value: data.stats.hitsL1,
          },
          {
            label: 'L2 Hits',
            value: data.stats.hitsL2,
          },
          {
            label: 'Misses',
            value: data.stats.misses,
          },
          {
            label: 'Cache Size',
            value: `${(data.stats.totalSize / 1024 / 1024).toFixed(1)}MB`,
          },
          {
            label: 'Entries (L1)',
            value: data.stats.entriesL1,
          },
        ]}
      />
    </div>
  );
}
```

## Alert Configuration

### Example Alert Rules

```typescript
// backend/src/config/alerts.config.ts
import { AlertRule } from '@qestro/apm';

export const defaultAlertRules: AlertRule[] = [
  {
    ruleId: 'high-latency',
    name: 'High Request Latency',
    metricName: 'request_duration',
    condition: 'gt',
    threshold: 2000, // 2 seconds
    duration: 30000, // Alert after 30s
    enabled: true,
    channels: ['webhook'],
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  },
  {
    ruleId: 'high-error-rate',
    name: 'High Error Rate',
    metricName: 'errors_total',
    condition: 'gt',
    threshold: 50, // 50 errors
    duration: 60000, // Alert after 1 min
    enabled: true,
    channels: ['webhook'],
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  },
  {
    ruleId: 'memory-pressure',
    name: 'Memory Pressure',
    metricName: 'memory_usage_mb',
    condition: 'gt',
    threshold: 1024, // 1GB
    duration: 0,
    enabled: true,
    channels: ['webhook'],
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  },
];

// Initialize alerts on startup
APMIntegration.alertManager.getRules().forEach((rule) => {
  alertManager.removeRule(rule.ruleId);
});

defaultAlertRules.forEach((rule) => {
  APMIntegration.alertManager.addRule(rule);
});
```

## Testing

### Test APM in Jest

```typescript
// backend/tests/apm/integration.test.ts
import { APMIntegration } from '@qestro/apm';

describe('APM Integration', () => {
  beforeEach(() => {
    APMIntegration.initialize();
  });

  it('should trace request lifecycle', async () => {
    const trace = APMIntegration.traceCollector.startTrace(
      'test-request'
    );

    const span = APMIntegration.traceCollector.startSpan(
      trace.traceId,
      'handler',
      trace.rootSpanId
    );

    await new Promise((r) => setTimeout(r, 50));

    APMIntegration.traceCollector.endSpan(span.spanId, 'ok');
    APMIntegration.traceCollector.endTrace(trace.traceId);

    const retrieved = APMIntegration.traceCollector.getTrace(
      trace.traceId
    );

    expect(retrieved).toBeDefined();
    expect(retrieved?.duration).toBeGreaterThan(50);
  });

  it('should record and aggregate metrics', () => {
    APMIntegration.metricsEngine.recordMetric(
      'test_metric',
      100
    );

    APMIntegration.metricsEngine.aggregateMetrics(
      'test_metric',
      'minute'
    );

    const aggregated =
      APMIntegration.metricsEngine.getAggregated(
        'test_metric',
        'minute'
      );

    expect(aggregated.length).toBeGreaterThan(0);
  });
});
```

### Test Cache in Jest

```typescript
// backend/tests/cache/integration.test.ts
import { CacheIntegration } from '@qestro/cache';

describe('Cache Integration', () => {
  beforeEach(async () => {
    CacheIntegration.initialize();
    await CacheIntegration.clear();
  });

  it('should cache and retrieve data', async () => {
    const cache = CacheIntegration.getManager();

    await cache.set('test-key', { value: 123 });

    const retrieved = await cache.get('test-key');

    expect(retrieved).toEqual({ value: 123 });
  });

  it('should invalidate patterns', async () => {
    const cache = CacheIntegration.getManager();

    await cache.set('user:1:profile', { id: 1 });
    await cache.set('user:2:profile', { id: 2 });

    const count = await cache.invalidatePattern('user:.*:profile');

    expect(count).toBe(2);
  });
});
```

## Deployment Checklist

- [ ] APM and Cache modules imported
- [ ] Middleware registered in Express app
- [ ] Routes registered at `/api/apm` and `/api/cache`
- [ ] Alert rules configured
- [ ] Environment variables set
- [ ] Redis configured (if using L2 cache)
- [ ] Monitoring dashboard created
- [ ] Alert webhooks configured
- [ ] Tests passing for both modules
- [ ] Documentation updated

## Performance Targets

### APM Impact

- Trace collection: <5% latency overhead
- Metrics recording: <1ms per operation
- Alert evaluation: 30-100ms per evaluation cycle

### Cache Performance

- L1 hit: <1ms
- L2 hit: 5-10ms
- Cache overhead: <2% on hit paths

### Monitoring

- Check APM status: `GET /api/apm/summary`
- Check cache health: `GET /api/cache/health`
- View active alerts: `GET /api/apm/alerts`
- View cache efficiency: `GET /api/cache/stats`

## Troubleshooting

### APM Not Collecting Traces

```typescript
// Verify middleware is registered
console.log('APM Status:', APMIntegration.getStatus());

// Check trace buffer
const stats = APMIntegration.traceCollector.getStats();
console.log('Traces:', stats);
```

### Cache Not Working

```typescript
// Verify cache is initialized
const stats = CacheIntegration.getStats();
console.log('Cache Stats:', stats);

// Check hit rate
if (stats.hitRate < 0.6) {
  console.warn('Low cache hit rate - review TTLs');
}
```

### Alerts Not Firing

```typescript
// Check alert rules
const rules = APMIntegration.alertManager.getRules();
console.log('Alert Rules:', rules.map(r => r.name));

// Manually trigger evaluation
await APMIntegration.alertManager.evaluate();
console.log('Active Alerts:', APMIntegration.alertManager.getActiveAlerts());
```
