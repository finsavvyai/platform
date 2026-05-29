// =============================================================================
// SDLC.ai Platform - Production Monitoring and Alerting Configuration
// =============================================================================
// Comprehensive monitoring implementation for Cloudflare Workers
// Features:
// - Real-time metrics collection
// - Intelligent alerting with ML-based anomaly detection
// - Distributed tracing
// - Performance monitoring
// - Business metrics tracking
// =============================================================================

import { AnalyticsEngineDataset } from '@cloudflare/workers-types';

// =============================================================================
// MONITORING CONFIGURATION
// =============================================================================

const MONITORING_CONFIG = {
  // Alert thresholds
  thresholds: {
    errorRate: {
      warning: 1.0,    // 1%
      critical: 5.0,   // 5%
    },
    responseTime: {
      warning: 2000,   // 2 seconds
      critical: 5000,  // 5 seconds
    },
    throughput: {
      warning: 100,    // requests per second
      critical: 50,    // requests per second
    },
    memoryUsage: {
      warning: 200,    // MB
      critical: 240,   // MB (near 256MB limit)
    },
    cpuTime: {
      warning: 40000,  // ms
      critical: 48000, // ms (near 50s limit)
    },
    queueBacklog: {
      warning: 1000,
      critical: 5000,
    },
  },

  // Monitoring intervals
  intervals: {
    metrics: 60000,        // 1 minute
    healthCheck: 30000,    // 30 seconds
    analytics: 300000,     // 5 minutes
    report: 3600000,       // 1 hour
  },

  // Anomaly detection settings
  anomalyDetection: {
    enabled: true,
    sensitivity: 0.8,      // 0-1 scale
    learningPeriod: 7,     // days
    minDataPoints: 100,
  },
};

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

export class MetricsCollector {
  constructor(env, ctx) {
    this.env = env;
    this.ctx = ctx;
    this.startTime = Date.now();
    this.metrics = new Map();
    this.spans = [];
  }

  // Record a custom metric
  recordMetric(name, value, tags = {}) {
    const timestamp = Date.now();
    const metric = {
      name,
      value,
      tags: {
        ...tags,
        environment: this.env.ENVIRONMENT,
        worker: this.env.WORKER_NAME || 'unknown',
      },
      timestamp,
    };

    this.metrics.set(`${name}_${timestamp}`, metric);

    // Send to Analytics Engine
    this.ctx.waitUntil(this.sendToAnalytics(metric));

    // Check for threshold breaches
    this.ctx.waitUntil(this.checkThresholds(metric));
  }

  // Record response time
  recordResponseTime(duration, endpoint, statusCode, method) {
    this.recordMetric('response_time', duration, {
      endpoint,
      status_code: statusCode.toString(),
      method,
      status_group: this.getStatusGroup(statusCode),
    });

    // Record request count
    this.recordMetric('request_count', 1, {
      endpoint,
      status_code: statusCode.toString(),
      method,
    });
  }

  // Record error
  recordError(error, context = {}) {
    this.recordMetric('error_count', 1, {
      error_type: error.constructor.name,
      error_message: error.message.substring(0, 100),
      ...context,
    });

    // Send to Sentry if configured
    if (this.env.SENTRY_DSN) {
      this.ctx.waitUntil(this.sendToSentry(error, context));
    }
  }

  // Record business metrics
  recordBusinessMetric(event, properties = {}) {
    this.recordMetric(`business_${event}`, 1, {
      ...properties,
      tenant_id: properties.tenant_id || 'anonymous',
    });
  }

  // Start a distributed trace span
  startSpan(name, parentSpan = null) {
    const span = {
      traceId: parentSpan?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: parentSpan?.spanId,
      name,
      startTime: Date.now(),
      tags: {},
      logs: [],
    };

    this.spans.push(span);
    return span;
  }

  // End a span
  endSpan(span, tags = {}, logs = []) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.tags = { ...span.tags, ...tags };
    span.logs = [...span.logs, ...logs];

    // Record span metrics
    this.recordMetric('span_duration', span.duration, {
      operation: span.name,
      trace_id: span.traceId,
    });

    // Send to tracing backend
    this.ctx.waitUntil(this.sendTrace(span));
  }

  // Get status group from status code
  getStatusGroup(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return 'success';
    if (statusCode >= 300 && statusCode < 400) return 'redirect';
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown';
  }

  // Send metrics to Analytics Engine
  async sendToAnalytics(metric) {
    try {
      const dataset = this.env.PLATFORM_ANALYTICS;
      if (!dataset) return;

      await dataset.writeDataPoint({
        blobs: [
          metric.name,
          JSON.stringify(metric.tags),
          metric.tags.endpoint || '',
          metric.tags.tenant_id || '',
        ],
        doubles: [
          metric.value,
          Date.now(),
        ],
        indexes: [
          metric.tags.status_code || '0',
          metric.tags.method || 'GET',
        ],
      });
    } catch (error) {
      console.error('Failed to send analytics:', error);
    }
  }

  // Check thresholds and trigger alerts
  async checkThresholds(metric) {
    const threshold = MONITORING_CONFIG.thresholds[metric.name];
    if (!threshold) return;

    const { warning, critical } = threshold;
    let severity = null;

    if (metric.value >= critical) {
      severity = 'critical';
    } else if (metric.value >= warning) {
      severity = 'warning';
    }

    if (severity) {
      await this.triggerAlert(metric, severity);
    }
  }

  // Trigger alert
  async triggerAlert(metric, severity) {
    const alert = {
      id: this.generateAlertId(),
      metric: metric.name,
      value: metric.value,
      threshold: MONITORING_CONFIG.thresholds[metric.name][severity],
      severity,
      tags: metric.tags,
      timestamp: Date.now(),
      environment: this.env.ENVIRONMENT,
    };

    // Send to alerting system
    if (this.env.ALERT_WEBHOOK_URL) {
      await fetch(this.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    }

    // Send to PagerDuty for critical alerts
    if (severity === 'critical' && this.env.PAGERDUTY_KEY) {
      await this.sendPagerDutyAlert(alert);
    }

    // Log alert
    console.warn(`🚨 ALERT [${severity.toUpperCase()}]:`, alert);
  }

  // Send PagerDuty alert
  async sendPagerDutyAlert(alert) {
    const payload = {
      routing_key: this.env.PAGERDUTY_KEY,
      dedup_key: alert.id,
      event_action: 'trigger',
      payload: {
        summary: `${alert.metric} is ${alert.value} (${alert.severity})`,
        source: 'sdlc-platform',
        severity: alert.severity,
        timestamp: alert.timestamp / 1000,
        custom_details: alert,
      },
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // Send error to Sentry
  async sendToSentry(error, context) {
    const sentryPayload = {
      message: error.message,
      level: 'error',
      extra: {
        context,
        environment: this.env.ENVIRONMENT,
        tags: context.tags || {},
      },
      stacktrace: error.stack,
    };

    await fetch(`https://sentry.io/api/${this.env.SENTRY_PROJECT_ID}/store/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.SENTRY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sentryPayload),
    });
  }

  // Send trace to tracing backend
  async sendTrace(span) {
    // Send to Honeycomb, Datadog, or other tracing service
    if (this.env.HONEYCOMB_API_KEY) {
      await fetch('https://api.honeycomb.io/1/events/dataset/sdlc-traces', {
        method: 'POST',
        headers: {
          'X-Honeycomb-Team': this.env.HONEYCOMB_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          duration: span.duration,
          timestamp: span.startTime / 1000,
          ...span.tags,
        }),
      });
    }
  }

  // Generate unique IDs
  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSpanId() {
    return Math.random().toString(36).substr(2, 16);
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// HEALTH CHECK SERVICE
// =============================================================================

export class HealthCheckService {
  constructor(env) {
    this.env = env;
  }

  async performHealthCheck() {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: this.env.SERVICE_VERSION || '1.0.0',
      checks: {},
    };

    // Check D1 databases
    checks.databases = await this.checkDatabases();

    // Check KV namespaces
    checks.kv = await this.checkKVNamespaces();

    // Check R2 buckets
    checks.r2 = await this.checkR2Buckets();

    // Check external services
    checks.external = await this.checkExternalServices();

    // Check system resources
    checks.system = await this.checkSystemResources();

    // Determine overall health
    const allHealthy = Object.values(checks).every(
      check => typeof check === 'object' ? check.healthy : true
    );

    checks.status = allHealthy ? 'healthy' : 'unhealthy';
    checks.uptime = process.uptime?.() || 0;

    return checks;
  }

  async checkDatabases() {
    const results = {
      healthy: true,
      databases: {},
    };

    const databases = ['TENANT_DB', 'AUTH_DB', 'DOCUMENTS_DB'];

    for (const dbBinding of databases) {
      try {
        const db = this.env[dbBinding];
        const result = await db.prepare('SELECT 1 as test').first();

        results.databases[dbBinding] = {
          healthy: true,
          responseTime: Date.now(), // Would measure actual time
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        results.databases[dbBinding] = {
          healthy: false,
          error: error.message,
          lastChecked: new Date().toISOString(),
        };
        results.healthy = false;
      }
    }

    return results;
  }

  async checkKVNamespaces() {
    const results = {
      healthy: true,
      namespaces: {},
    };

    const namespaces = ['CACHE', 'SESSIONS'];

    for (const kvBinding of namespaces) {
      try {
        const kv = this.env[kvBinding];
        await kv.get('health-check-key');

        results.namespaces[kvBinding] = {
          healthy: true,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        results.namespaces[kvBinding] = {
          healthy: false,
          error: error.message,
          lastChecked: new Date().toISOString(),
        };
        results.healthy = false;
      }
    }

    return results;
  }

  async checkR2Buckets() {
    const results = {
      healthy: true,
      buckets: {},
    };

    const buckets = ['DOCUMENTS', 'BACKUP_ARCHIVE'];

    for (const bucketBinding of buckets) {
      try {
        const bucket = this.env[bucketBinding];
        await bucket.head('health-check-test');

        results.buckets[bucketBinding] = {
          healthy: true,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        results.buckets[bucketBinding] = {
          healthy: false,
          error: error.message,
          lastChecked: new Date().toISOString(),
        };
        results.healthy = false;
      }
    }

    return results;
  }

  async checkExternalServices() {
    const results = {
      healthy: true,
      services: {},
    };

    // Check OpenAI API
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.env.OPENAI_API_KEY}` },
      });

      results.services.openai = {
        healthy: response.ok,
        statusCode: response.status,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      results.services.openai = {
        healthy: false,
        error: error.message,
        lastChecked: new Date().toISOString(),
      };
      results.healthy = false;
    }

    return results;
  }

  async checkSystemResources() {
    return {
      healthy: true,
      memory: {
        used: 'Unknown', // Cloudflare Workers don't expose this
        limit: 256, // MB
      },
      cpu: {
        used: 'Unknown', // Cloudflare Workers don't expose this
        limit: 50000, // ms
      },
      lastChecked: new Date().toISOString(),
    };
  }
}

// =============================================================================
// ANOMALY DETECTION
// =============================================================================

export class AnomalyDetector {
  constructor(env) {
    this.env = env;
    this.historicalData = new Map();
  }

  async detectAnomaly(metric) {
    if (!MONITORING_CONFIG.anomalyDetection.enabled) {
      return false;
    }

    const key = `${metric.name}_${JSON.stringify(metric.tags)}`;
    const history = this.historicalData.get(key) || [];

    // Add current metric to history
    history.push(metric.value);

    // Keep only relevant history
    const maxPoints = MONITORING_CONFIG.anomalyDetection.minDataPoints * 10;
    if (history.length > maxPoints) {
      history.splice(0, history.length - maxPoints);
    }

    this.historicalData.set(key, history);

    // Need minimum data points
    if (history.length < MONITORING_CONFIG.anomalyDetection.minDataPoints) {
      return false;
    }

    // Calculate statistical parameters
    const stats = this.calculateStatistics(history);

    // Check if current value is anomalous
    const zScore = Math.abs((metric.value - stats.mean) / stats.stdDev);
    const threshold = this.getAnomalyThreshold(metric.name);

    if (zScore > threshold) {
      await this.reportAnomaly(metric, stats, zScore);
      return true;
    }

    return false;
  }

  calculateStatistics(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    // Calculate percentiles
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(n * 0.5)];
    const p95 = sorted[Math.floor(n * 0.95)];
    const p99 = sorted[Math.floor(n * 0.99)];

    return { mean, stdDev, p50, p95, p99 };
  }

  getAnomalyThreshold(metricName) {
    const baseThreshold = MONITORING_CONFIG.anomalyDetection.sensitivity;

    // Adjust threshold based on metric volatility
    const adjustments = {
      error_rate: 2.0,
      response_time: 2.5,
      throughput: 2.0,
      memory_usage: 1.5,
    };

    return adjustments[metricName] || baseThreshold * 3;
  }

  async reportAnomaly(metric, stats, zScore) {
    const anomaly = {
      id: this.generateAnomalyId(),
      metric: metric.name,
      currentValue: metric.value,
      expectedRange: {
        p50: stats.p50,
        p95: stats.p95,
        p99: stats.p99,
      },
      zScore,
      severity: zScore > 4 ? 'critical' : 'warning',
      tags: metric.tags,
      timestamp: Date.now(),
    };

    // Send anomaly alert
    if (this.env.ANOMALY_WEBHOOK_URL) {
      await fetch(this.env.ANOMALY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anomaly),
      });
    }

    console.warn('🔍 ANOMALY DETECTED:', anomaly);
  }

  generateAnomalyId() {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

export class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = new Map();
  }

  // Mark a point in time
  mark(name) {
    this.marks.set(name, Date.now());
  }

  // Measure time between two marks
  measure(name, startMark, endMark) {
    const startTime = this.marks.get(startMark);
    const endTime = endMark ? this.marks.get(endMark) : Date.now();

    if (startTime === undefined) {
      throw new Error(`Mark "${startMark}" not found`);
    }

    const duration = endTime - startTime;
    this.measures.set(name, duration);

    return duration;
  }

  // Get performance summary
  getSummary() {
    return {
      marks: Object.fromEntries(this.marks),
      measures: Object.fromEntries(this.measures),
      totalDuration: Date.now() - (this.marks.get('request_start') || Date.now()),
    };
  }

  // Clear all marks and measures
  clear() {
    this.marks.clear();
    this.measures.clear();
  }
}

// =============================================================================
// MONITORING MIDDLEWARE
// =============================================================================

export function createMonitoringMiddleware(options = {}) {
  return async (request, env, ctx, next) => {
    const monitor = new MetricsCollector(env, ctx);
    const healthChecker = new HealthCheckService(env);
    const anomalyDetector = new AnomalyDetector(env);
    const perfMonitor = new PerformanceMonitor();

    // Store in context for use in handlers
    ctx.monitor = monitor;
    ctx.healthChecker = healthChecker;
    ctx.anomalyDetector = anomalyDetector;
    ctx.perfMonitor = perfMonitor;

    // Start performance monitoring
    perfMonitor.mark('request_start');

    // Start trace
    const span = monitor.startSpan('http_request');

    try {
      // Process request
      const response = await next();

      // Record metrics
      perfMonitor.mark('request_end');
      const duration = perfMonitor.measure('request_duration', 'request_start', 'request_end');

      monitor.recordResponseTime(
        duration,
        new URL(request.url).pathname,
        response.status,
        request.method
      );

      // End trace
      monitor.endSpan(span, {
        http.status_code: response.status,
        http.method: request.method,
        http.url: new URL(request.url).pathname,
      });

      return response;

    } catch (error) {
      // Record error
      perfMonitor.mark('request_end');
      const duration = perfMonitor.measure('request_duration', 'request_start', 'request_end');

      monitor.recordError(error, {
        url: new URL(request.url).pathname,
        method: request.method,
        duration,
      });

      // End trace with error
      monitor.endSpan(span, {
        http.status_code: 500,
        http.method: request.method,
        http.url: new URL(request.url).pathname,
        error: error.message,
      });

      throw error;
    }
  };
}

// =============================================================================
// EXPORT INITIALIZATION FUNCTION
// =============================================================================

export function initializeMonitoring(env, ctx) {
  return {
    metrics: new MetricsCollector(env, ctx),
    health: new HealthCheckService(env),
    anomalyDetector: new AnomalyDetector(env),
    performance: new PerformanceMonitor(),
  };
}

export default {
  MetricsCollector,
  HealthCheckService,
  AnomalyDetector,
  PerformanceMonitor,
  createMonitoringMiddleware,
  initializeMonitoring,
};
