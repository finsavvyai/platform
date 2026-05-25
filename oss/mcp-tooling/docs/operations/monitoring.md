# Monitoring and Alerting Guide

This guide covers the complete monitoring and alerting setup for MCPOverflow, including application performance, database health, security monitoring, and user experience tracking.

## 🎯 Monitoring Overview

MCPOverflow monitoring covers multiple layers:

- **Application Performance** - Response times, error rates, throughput
- **Infrastructure Health** - Server status, resource utilization
- **Database Performance** - Query performance, connection health
- **Security Monitoring** - Authentication, API abuse, rate limiting
- **User Experience** - Real user monitoring, error tracking
- **Business Metrics** - User engagement, conversion rates, usage patterns

## 📊 Key Performance Indicators (KPIs)

### Application Metrics

#### Response Time Targets

- **API Response Time**: < 200ms (95th percentile)
- **Page Load Time**: < 3 seconds
- **Connector Generation**: < 60 seconds
- **Database Queries**: < 100ms average

#### Availability Targets

- **Uptime**: 99.9% (monthly)
- **Error Rate**: < 1% (4xx/5xx errors)
- **Successful Generation Rate**: > 95%

#### Throughput Metrics

- **Concurrent Users**: 1,000+
- **API Requests**: 100,000+ per day
- **Connectors Generated**: 10,000+ per month

### Business Metrics

#### User Engagement

- **Daily Active Users (DAU)**
- **Monthly Active Users (MAU)**
- **User Retention Rate** (7-day, 30-day)
- **Conversion Rate** (sign-up to first connector)

#### Platform Usage

- **Total Connectors Created**
- **Successful Generation Rate**
- **Average Connector Tools**
- **Popular API Integrations**

## 🏗️ Monitoring Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend       │    │   Backend        │    │   Database       │
│   Monitoring     │    │   Monitoring     │    │   Monitoring     │
│                 │    │                 │    │                 │
│ • Browser       │    │ • API Metrics   │    │ • Query Stats    │
│ • User Sessions │◄──►│ • Job Queue     │◄──►│ • Connections   │
│ • Error Tracking│    │ • Auth Events   │    │ • Index Usage   │
│ • Performance   │    │ • Rate Limits    │    │ • Storage       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │  Central        │
                    │  Monitoring     │
                    │  Platform       │
                    │                 │
                    │ • Grafana       │
                    │ • Alertmanager  │
                    │ • Prometheus    │
                    │ • Dashboards    │
                    └─────────────────┘
```

## 🔧 Implementation Setup

### 1. Frontend Monitoring

#### Real User Monitoring (RUM)

```typescript
// monitoring/rum.ts
interface PerformanceMetrics {
  pageLoad: number
  apiResponse: number
  errorRate: number
  userSatisfaction: number
}

class RUMMonitoring {
  private metrics: PerformanceMetrics = {
    pageLoad: 0,
    apiResponse: 0,
    errorRate: 0,
    userSatisfaction: 0,
  }

  constructor() {
    this.initializeObservers()
    this.trackPageLoad()
  }

  private initializeObservers() {
    // Performance Observer
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry)
        }
      })

      observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] })
    }

    // Error Handler
    window.addEventListener('error', this.handleError.bind(this))
    window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this))
  }

  private trackPageLoad() {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as any
      this.metrics.pageLoad = navigation.loadEventEnd - navigation.fetchStart

      this.sendMetrics('page_load', {
        duration: this.metrics.pageLoad,
        url: window.location.href,
        userAgent: navigator.userAgent,
      })
    })
  }

  private trackAPICall(url: string, duration: number, success: boolean) {
    this.sendMetrics('api_call', {
      url,
      duration,
      success,
      timestamp: Date.now(),
    })
  }

  private sendMetrics(type: string, data: any) {
    // Send to monitoring service
    fetch('/api/monitoring/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    }).catch(err => console.warn('Failed to send metrics:', err))
  }

  private handleError(event: ErrorEvent) {
    this.sendMetrics('error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    })
  }

  private handlePromiseRejection(event: PromiseRejectionEvent) {
    this.sendMetrics('promise_rejection', {
      reason: event.reason,
      stack: event.reason?.stack,
    })
  }
}

export const rumMonitoring = new RUMMonitoring()
```

#### API Client Monitoring

```typescript
// lib/monitored-api.ts
import { secureAPI } from './api-security'

class MonitoredAPI extends secureAPI {
  async request<T>(endpoint: string, options: any = {}) {
    const startTime = performance.now()
    let success = false
    let error: Error | null = null

    try {
      const result = await super.request<T>(endpoint, options)
      success = result.success

      if (!result.success && result.error) {
        error = new Error(result.error)
      }

      // Track performance
      const duration = performance.now() - startTime
      rumMonitoring.trackAPICall(endpoint, duration, success)

      return result
    } catch (err) {
      const duration = performance.now() - startTime
      error = err as Error

      rumMonitoring.trackAPICall(endpoint, duration, false)
      throw err
    }
  }
}

export const monitoredAPI = new MonitoredAPI()
```

### 2. Backend Monitoring

#### Health Check Endpoint

```typescript
// supabase/functions/health-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async req => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      storage: await checkStorage(),
      jobs: await checkJobs(),
      memory: checkMemory(),
      uptime: Deno.env.get('UPTIME') || 'unknown',
    },
  }

  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy')

  return new Response(JSON.stringify(health), {
    status: isHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  })
})

async function checkDatabase() {
  try {
    const startTime = performance.now()
    const result = await performDatabaseQuery('SELECT 1')
    const duration = performance.now() - startTime

    return {
      status: 'healthy',
      latency: Math.round(duration),
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    }
  }
}
```

#### Metrics Collection

```typescript
// supabase/functions/collect-metrics/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async req => {
  const metrics = {
    jobs: await collectJobMetrics(),
    connectors: await collectConnectorMetrics(),
    users: await collectUserMetrics(),
    performance: await collectPerformanceMetrics(),
    timestamp: new Date().toISOString(),
  }

  // Store in metrics table
  await storeMetrics(metrics)

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function collectJobMetrics() {
  // Query job statistics
  return {
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    avg_duration: 0,
  }
}
```

### 3. Database Monitoring

#### Performance Views

```sql
-- Create monitoring views
CREATE OR REPLACE VIEW public.system_health AS
SELECT
  'database_connections' as metric_name,
  COUNT(*) as metric_value,
  CASE
    WHEN COUNT(*) < 80 THEN 'healthy'
    WHEN COUNT(*) < 90 THEN 'warning'
    ELSE 'critical'
  END as metric_status,
  NOW() as last_updated
FROM pg_stat_activity
WHERE state = 'active'

UNION ALL

SELECT
  'slow_queries' as metric_name,
  COUNT(*) as metric_value,
  CASE
    WHEN COUNT(*) = 0 THEN 'healthy'
    WHEN COUNT(*) < 5 THEN 'warning'
    ELSE 'critical'
  END as metric_status,
  NOW() as last_updated
FROM pg_stat_statements
WHERE mean_time > 1000

UNION ALL

SELECT
  'failed_jobs_24h' as metric_name,
  COUNT(*) as metric_value,
  CASE
    WHEN COUNT(*) = 0 THEN 'healthy'
    WHEN COUNT(*) < 10 THEN 'warning'
    ELSE 'critical'
  END as metric_status,
  NOW() as last_updated
FROM public.jobs
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

#### Automated Cleanup

```sql
-- Function to collect hourly statistics
CREATE OR REPLACE FUNCTION public.collect_hourly_stats()
RETURNS void AS $$
BEGIN
  -- Insert aggregated metrics
  INSERT INTO public.hourly_metrics (
    timestamp, metric_name, metric_value
  )
  SELECT
    NOW() as timestamp,
    'active_users' as metric_name,
    COUNT(DISTINCT user_id) as metric_value
  FROM public.user_profiles
  WHERE last_sign_in_at >= NOW() - INTERVAL '1 hour';

  -- Clean up old logs
  DELETE FROM public.job_logs
  WHERE timestamp < NOW() - INTERVAL '7 days';

  -- Update materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.connector_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (using pg_cron extension)
SELECT cron.schedule('hourly-metrics', '0 * * * *', 'SELECT collect_hourly_stats();');
```

## 🚨 Alerting Configuration

### Alert Types

#### Critical Alerts (Immediate)

- **Service Down**: Application completely unavailable
- **Database Down**: Database connection failures
- **High Error Rate**: Error rate > 10%
- **Security Breach**: Authentication attacks detected

#### Warning Alerts (Within 1 hour)

- **Performance Degradation**: Response time > 500ms
- **Resource Exhaustion**: Memory > 80%, CPU > 80%
- **Job Queue Backup**: Pending jobs > 100
- **Rate Limit Breach**: Excessive API usage

#### Info Alerts (Daily)

- **Usage Statistics**: Daily active users, requests
- **Performance Reports**: Response time trends
- **Health Summary**: Overall system health

### Alert Implementation

#### Webhook Alerting

```typescript
// monitoring/alerting.ts
interface Alert {
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  source: string
  metadata: Record<string, any>
}

class AlertManager {
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async sendAlert(alert: Alert) {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      })

      if (!response.ok) {
        console.error('Failed to send alert:', await response.text())
      }
    } catch (error) {
      console.error('Alert sending failed:', error)
    }
  }

  checkAlertConditions(metrics: any) {
    // Service down check
    if (metrics.uptime < 95) {
      this.sendAlert({
        type: 'critical',
        title: 'Service Downtime Detected',
        message: `Service uptime dropped to ${metrics.uptime}%`,
        timestamp: new Date().toISOString(),
        source: 'system',
        metadata: { uptime: metrics.uptime },
      })
    }

    // High error rate check
    if (metrics.errorRate > 10) {
      this.sendAlert({
        type: 'critical',
        title: 'High Error Rate Detected',
        message: `Error rate is ${metrics.errorRate}%`,
        timestamp: new Date().toISOString(),
        source: 'application',
        metadata: { errorRate: metrics.errorRate },
      })
    }

    // Performance degradation check
    if (metrics.avgResponseTime > 500) {
      this.sendAlert({
        type: 'warning',
        title: 'Performance Degradation',
        message: `Average response time is ${metrics.avgResponseTime}ms`,
        timestamp: new Date().toISOString(),
        source: 'application',
        metadata: { responseTime: metrics.avgResponseTime },
      })
    }
  }
}

export const alertManager = new AlertManager(process.env.ALERT_WEBHOOK_URL || '')
```

#### Database Alerting

```sql
-- Create alerting function
CREATE OR REPLACE FUNCTION public.check_system_alerts()
RETURNS TABLE (
  alert_type TEXT,
  alert_title TEXT,
  alert_message TEXT,
  alert_severity TEXT
) AS $$
DECLARE
  v_down_connections INTEGER;
  v_slow_queries INTEGER;
  v_failed_jobs INTEGER;
BEGIN
  -- Check database connections
  SELECT COUNT(*) INTO v_down_connections
  FROM pg_stat_activity
  WHERE state = 'active';

  IF v_down_connections > 100 THEN
    RETURN QUERY
    SELECT 'critical'::TEXT, 'High Database Load',
           format('%s active database connections', v_down_connections),
           'critical'::TEXT;
  END IF;

  -- Check slow queries
  SELECT COUNT(*) INTO v_slow_queries
  FROM pg_stat_statements
  WHERE mean_time > 1000;

  IF v_slow_queries > 5 THEN
    RETURN QUERY
    SELECT 'warning'::TEXT, 'Slow Queries Detected',
           format('%s slow queries detected', v_slow_queries),
           'warning'::TEXT;
  END IF;

  -- Check failed jobs
  SELECT COUNT(*) INTO v_failed_jobs
  FROM public.jobs
  WHERE status = 'failed'
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF v_failed_jobs > 10 THEN
    RETURN QUERY
    SELECT 'warning'::TEXT, 'High Job Failure Rate',
           format('%s jobs failed in the last hour', v_failed_jobs),
           'warning'::TEXT;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📈 Dashboards

### Grafana Dashboard Configuration

#### System Overview Dashboard

```json
{
  "dashboard": {
    "title": "MCPOverflow System Overview",
    "panels": [
      {
        "title": "Uptime",
        "type": "stat",
        "targets": [
          {
            "expr": "uptime_percentage",
            "legendFormat": "Uptime"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "avg_response_time_seconds",
            "legendFormat": "Avg Response Time"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "error_rate_percentage",
            "legendFormat": "Error Rate"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_users_count",
            "legendFormat": "Active Users"
          }
        ]
      }
    ]
  }
}
```

#### Business Metrics Dashboard

```json
{
  "dashboard": {
    "title": "MCPOverflow Business Metrics",
    "panels": [
      {
        "title": "Total Connectors",
        "type": "stat",
        "targets": [
          {
            "expr": "total_connectors_count",
            "legendFormat": "Total Connectors"
          }
        ]
      },
      {
        "title": "Generation Success Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "generation_success_rate",
            "legendFormat": "Success Rate"
          }
        ]
      },
      {
        "title": "User Signups",
        "type": "graph",
        "targets": [
          {
            "expr": "daily_signups",
            "legendFormat": "Daily Signups"
          }
        ]
      },
      {
        "title": "Popular API Types",
        "type": "piechart",
        "targets": [
          {
            "expr": "api_types_distribution",
            "legendFormat": "API Types"
          }
        ]
      }
    ]
  }
}
```

## 🔍 Log Management

### Structured Logging

```typescript
// logging/logger.ts
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: string
  context: Record<string, any>
  userId?: string
  requestId?: string
}

class Logger {
  private context: Record<string, any> = {}

  constructor(context: Record<string, any> = {}) {
    this.context = context
  }

  debug(message: string, context: Record<string, any> = {}) {
    this.log('debug', message, context)
  }

  info(message: string, context: Record<string, any> = {}) {
    this.log('info', message, context)
  }

  warn(message: string, context: Record<string, any> = {}) {
    this.log('warn', message, context)
  }

  error(message: string, context: Record<string, any> = {}) {
    this.log('error', message, context)
  }

  private async log(level: string, message: string, context: Record<string, any>) {
    const logEntry: LogEntry = {
      level: level as any,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context },
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[${level.toUpperCase()}] ${message}`, logEntry)
    }

    // Send to log aggregation service
    await this.sendToService(logEntry)
  }

  private async sendToService(logEntry: LogEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      })
    } catch (error) {
      console.warn('Failed to send log to service:', error)
    }
  }

  withContext(context: Record<string, any>): Logger {
    return new Logger({ ...this.context, ...context })
  }
}

export const logger = new Logger()
```

### Log Aggregation

```sql
-- Create log aggregation table
CREATE TABLE public.application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  user_id UUID,
  request_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

-- Create index for queries
CREATE INDEX idx_application_logs_timestamp ON public.application_logs(timestamp);
CREATE INDEX idx_application_logs_level ON public.application_logs(level);
CREATE INDEX idx_application_logs_user_id ON public.application_logs(user_id);
```

## 📱 User Experience Monitoring

### Real User Monitoring

```typescript
// monitoring/user-experience.ts
interface UXMetrics {
  pageLoadTime: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay: number
}

class UserExperienceMonitor {
  private metrics: Partial<UXMetrics> = {}

  constructor() {
    this.initializeWebVitals()
  }

  private initializeWebVitals() {
    // First Contentful Paint
    new PerformanceObserver(entryList => {
      const entries = entryList.getEntries()
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.firstContentfulPaint = entry.startTime
          this.reportMetric('FCP', entry.startTime)
        }
      })
    }).observe({ entryTypes: ['paint'] })

    // Largest Contentful Paint
    new PerformanceObserver(entryList => {
      const entries = entryList.getEntries()
      entries.forEach(entry => {
        if (entry.entryType === 'largest-contentful-paint') {
          this.metrics.largestContentfulPaint = entry.startTime
          this.reportMetric('LCP', entry.startTime)
        }
      })
    }).observe({ entryTypes: ['largest-contentful-paint'] })

    // Cumulative Layout Shift
    new PerformanceObserver(entryList => {
      let clsValue = 0
      entryList.getEntries().forEach(entry => {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      })
      this.metrics.cumulativeLayoutShift = clsValue
      this.reportMetric('CLS', clsValue)
    }).observe({ entryTypes: ['layout-shift'] })

    // First Input Delay
    new PerformanceObserver(entryList => {
      const entries = entryList.getEntries()
      entries.forEach(entry => {
        if (entry.entryType === 'first-input') {
          this.metrics.firstInputDelay = (entry as any).processingStart - entry.startTime
          this.reportMetric('FID', this.metrics.firstInputDelay)
        }
      })
    }).observe({ entryTypes: ['first-input'] })
  }

  private reportMetric(name: string, value: number) {
    // Send to analytics service
    this.sendMetric({
      name,
      value,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    })
  }

  private async sendMetric(metric: any) {
    try {
      await fetch('/api/analytics/web-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
      })
    } catch (error) {
      console.warn('Failed to send Web Vitals metric:', error)
    }
  }
}

export const uxMonitor = new UserExperienceMonitor()
```

## 🔧 Troubleshooting

### Common Monitoring Issues

#### Missing Metrics

```bash
# Check if monitoring scripts are loaded
# Look for browser console errors
# Verify network requests are being sent
```

#### High Resource Usage

```bash
# Check Node.js process memory
node --inspect --max-old-space-size=4096

# Monitor database connections
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;

# Check for long-running queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC;
```

#### Alert Fatigue

```bash
# Review alert thresholds
# Adjust sensitivity levels
# Implement alert grouping
# Add hysteresis to prevent flapping
```

### Performance Debugging

#### Slow Queries

```sql
-- Identify slow queries
EXPLAIN ANALYZE SELECT * FROM public.connectors WHERE status = 'active';

-- Check index usage
EXPLAIN SELECT * FROM public.connectors WHERE name = 'test';

-- Analyze table statistics
ANALYZE public.connectors;
```

#### Frontend Performance

```typescript
// Performance profiling
const startTime = performance.now()

// Code to measure
const result = await someOperation()

const duration = performance.now() - startTime
console.log(`Operation took ${duration}ms`)
```

---

For security monitoring procedures, see the [Security Guide](./security.md).
