// =============================================================================
// SDLC.ai Platform - Worker Analytics and Monitoring
// =============================================================================
// This worker collects analytics data from all platform services
// and forwards to analytics engines for processing and alerting
// =============================================================================

import { AnalyticsEngineDataset } from '@cloudflare/workers-types';

interface AnalyticsEvent {
  timestamp: number;
  environment: string;
  service: string;
  event_type: string;
  user_id?: string;
  tenant_id?: string;
  api_key_id?: string;
  session_id?: string;
  request_id: string;
  duration_ms?: number;
  status_code?: number;
  error_message?: string;
  endpoint?: string;
  method?: string;
  user_agent?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
}

interface MetricEvent {
  timestamp: number;
  environment: string;
  service: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  tags?: Record<string, string>;
}

interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  time_window_minutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

// Analytics Engine datasets
const DATASETS = {
  PLATFORM_ANALYTICS: 'sdlc_platform_analytics' as any,
  BILLING_ANALYTICS: 'sdlc_billing_analytics' as any,
  USAGE_ANALYTICS: 'sdlc_usage_analytics' as any,
} as const;

// Alert rules for monitoring
const ALERT_RULES: AlertRule[] = [
  {
    name: 'high_error_rate',
    condition: 'error_rate',
    threshold: 0.05, // 5%
    time_window_minutes: 5,
    severity: 'high',
    enabled: true,
  },
  {
    name: 'slow_response_time',
    condition: 'p95_response_time',
    threshold: 2000, // 2 seconds
    time_window_minutes: 5,
    severity: 'medium',
    enabled: true,
  },
  {
    name: 'high_authentication_failure_rate',
    condition: 'auth_failure_rate',
    threshold: 0.1, // 10%
    time_window_minutes: 5,
    severity: 'high',
    enabled: true,
  },
  {
    name: 'queue_backlog',
    condition: 'queue_depth',
    threshold: 1000,
    time_window_minutes: 1,
    severity: 'medium',
    enabled: true,
  },
  {
    name: 'memory_usage_high',
    condition: 'memory_usage_percent',
    threshold: 0.8, // 80%
    time_window_minutes: 2,
    severity: 'high',
    enabled: true,
  },
  {
    name: 'cpu_usage_high',
    condition: 'cpu_usage_percent',
    threshold: 0.9, // 90%
    time_window_minutes: 2,
    severity: 'critical',
    enabled: true,
  },
];

// Service health status tracking
interface ServiceHealth {
  service: string;
  environment: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_check: number;
  uptime_percentage: number;
  response_time_p95: number;
  error_rate: number;
  last_error?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/analytics/event':
          return await handleAnalyticsEvent(request, env);
        case '/analytics/metric':
          return await handleMetricEvent(request, env);
        case '/analytics/health':
          return await handleHealthCheck(request, env);
        case '/analytics/alerts':
          return await handleAlerts(request, env);
        case '/analytics/dashboard':
          return await handleDashboard(request, env);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('Analytics worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Run scheduled monitoring tasks
    ctx.waitUntil(runScheduledTasks(env));
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    // Process analytics events from queues
    for (const message of batch.messages) {
      ctx.waitUntil(processAnalyticsMessage(message, env));
    }
  },
};

// Handle analytics events from services
async function handleAnalyticsEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const event: AnalyticsEvent = await request.json();

  // Validate event structure
  if (!event.timestamp || !event.service || !event.event_type) {
    return new Response('Invalid event structure', { status: 400 });
  }

  // Write to appropriate analytics dataset
  await writeAnalyticsEvent(event, env);

  // Check for alert conditions
  await checkAlertConditions(event, env);

  return new Response('Event recorded', { status: 200 });
}

// Handle metric events
async function handleMetricEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const metric: MetricEvent = await request.json();

  // Validate metric structure
  if (!metric.timestamp || !metric.service || !metric.metric_name || metric.metric_value === undefined) {
    return new Response('Invalid metric structure', { status: 400 });
  }

  // Write to analytics engine
  await writeMetricEvent(metric, env);

  return new Response('Metric recorded', { status: 200 });
}

// Handle health check requests
async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  const health = await getServiceHealth(env);

  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: Date.now(),
    services: health,
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle alert management
async function handleAlerts(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    const alerts = await getActiveAlerts(env);
    return new Response(JSON.stringify(alerts), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else if (request.method === 'POST') {
    // Create manual alert or acknowledge existing alert
    const alertData = await request.json();
    await createAlert(alertData, env);
    return new Response('Alert created', { status: 201 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}

// Handle dashboard data requests
async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const timeRange = url.searchParams.get('timeRange') || '24h';
  const service = url.searchParams.get('service');

  const dashboardData = await getDashboardData(timeRange, service, env);

  return new Response(JSON.stringify(dashboardData), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Write analytics event to appropriate dataset
async function writeAnalyticsEvent(event: AnalyticsEvent, env: Env): Promise<void> {
  const { environment, service, event_type } = event;

  // Route to appropriate dataset based on event type
  let dataset: AnalyticsEngineDataset;

  switch (event_type) {
    case 'api_request':
    case 'authentication':
    case 'authorization':
      dataset = env.PLATFORM_ANALYTICS;
      break;
    case 'document_processing':
    case 'embedding_generation':
    case 'vector_search':
      dataset = env.USAGE_ANALYTICS;
      break;
    case 'billing_event':
    case 'usage_quota':
      dataset = env.BILLING_ANALYTICS;
      break;
    default:
      dataset = env.PLATFORM_ANALYTICS;
  }

  await dataset.writeDataPoint({
    blobs: [JSON.stringify(event)],
    doubles: [
      event.duration_ms || 0,
      event.status_code || 0,
    ],
    indexes: [
      environment,
      service,
      event_type,
      event.tenant_id || 'anonymous',
      event.user_id || 'anonymous',
    ],
  });
}

// Write metric event to analytics engine
async function writeMetricEvent(metric: MetricEvent, env: Env): Promise<void> {
  await env.PLATFORM_ANALYTICS.writeDataPoint({
    blobs: [JSON.stringify(metric)],
    doubles: [metric.metric_value],
    indexes: [
      metric.environment,
      metric.service,
      'metric',
      metric.metric_name,
    ],
  });
}

// Check alert conditions and trigger alerts if needed
async function checkAlertConditions(event: AnalyticsEvent, env: Env): Promise<void> {
  const environment = event.environment;
  const service = event.service;

  for (const rule of ALERT_RULES.filter(r => r.enabled)) {
    const shouldAlert = await evaluateAlertRule(rule, event, env);

    if (shouldAlert) {
      await triggerAlert(rule, event, env);
    }
  }
}

// Evaluate alert rule against current event
async function evaluateAlertRule(rule: AlertRule, event: AnalyticsEvent, env: Env): Promise<boolean> {
  // This is a simplified implementation
  // In production, you'd query the analytics engine for time-windowed aggregates

  switch (rule.condition) {
    case 'error_rate':
      return event.event_type === 'api_request' && (event.status_code || 0) >= 400;

    case 'slow_response_time':
      return event.event_type === 'api_request' && (event.duration_ms || 0) > rule.threshold;

    case 'auth_failure_rate':
      return event.event_type === 'authentication' && (event.status_code || 0) >= 400;

    default:
      return false;
  }
}

// Trigger alert notification
async function triggerAlert(rule: AlertRule, event: AnalyticsEvent, env: Env): Promise<void> {
  const alert = {
    id: generateAlertId(),
    rule_name: rule.name,
    severity: rule.severity,
    environment: event.environment,
    service: event.service,
    message: generateAlertMessage(rule, event),
    triggered_at: Date.now(),
    event_data: event,
  };

  // Store alert
  await env.ALERT_KV.put(alert.id, JSON.stringify(alert), {
    expirationTtl: 86400, // 24 hours
  });

  // Send notification (implement based on your notification system)
  await sendAlertNotification(alert, env);
}

// Get active alerts
async function getActiveAlerts(env: Env): Promise<any[]> {
  const alerts: any[] = [];

  // In production, query alert storage or KV for active alerts
  // This is a simplified implementation

  return alerts;
}

// Get service health status
async function getServiceHealth(env: Env): Promise<ServiceHealth[]> {
  const services = ['gateway', 'rag', 'vector', 'policy'];
  const environments = ['development', 'staging', 'production'];

  const health: ServiceHealth[] = [];

  for (const environment of environments) {
    for (const service of services) {
      // In production, query actual service health metrics
      const serviceHealth: ServiceHealth = {
        service,
        environment,
        status: 'healthy',
        last_check: Date.now(),
        uptime_percentage: 99.9,
        response_time_p95: 150,
        error_rate: 0.01,
      };

      health.push(serviceHealth);
    }
  }

  return health;
}

// Get dashboard data
async function getDashboardData(timeRange: string, service: string | null, env: Env): Promise<any> {
  // In production, query analytics engine for actual metrics
  return {
    timeRange,
    service,
    metrics: {
      totalRequests: 1000000,
      errorRate: 0.012,
      averageResponseTime: 145,
      activeUsers: 5000,
      documentsProcessed: 50000,
      vectorSearches: 250000,
    },
    trends: {
      requests: [100, 120, 115, 130, 125, 140],
      errors: [1, 2, 1.5, 2.5, 2, 1.8],
      responseTime: [120, 130, 125, 140, 135, 145],
    },
    alerts: [],
  };
}

// Process analytics messages from queues
async function processAnalyticsMessage(message: any, env: Env): Promise<void> {
  const event = JSON.parse(message.body);
  await writeAnalyticsEvent(event, env);
}

// Run scheduled monitoring tasks
async function runScheduledTasks(env: Env): Promise<void> {
  // Aggregate metrics
  await aggregateMetrics(env);

  // Clean up old data
  await cleanupOldData(env);

  // Generate reports
  await generateReports(env);
}

// Helper functions
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAlertMessage(rule: AlertRule, event: AnalyticsEvent): string {
  return `Alert: ${rule.name} triggered for ${event.service} in ${event.environment}`;
}

async function sendAlertNotification(alert: any, env: Env): Promise<void> {
  // Implement notification sending (email, Slack, PagerDuty, etc.)
  console.log('Alert triggered:', alert);
}

async function aggregateMetrics(env: Env): Promise<void> {
  // Implement metric aggregation logic
}

async function cleanupOldData(env: Env): Promise<void> {
  // Implement data cleanup logic
}

async function generateReports(env: Env): Promise<void> {
  // Implement report generation logic
}

async function createAlert(alertData: any, env: Env): Promise<void> {
  // Implement manual alert creation
}

// Environment interface
interface Env {
  PLATFORM_ANALYTICS: AnalyticsEngineDataset;
  BILLING_ANALYTICS: AnalyticsEngineDataset;
  USAGE_ANALYTICS: AnalyticsEngineDataset;
  ALERT_KV: KVNamespace;
  [key: string]: any;
}
