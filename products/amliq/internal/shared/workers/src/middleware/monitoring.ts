/**
 * Revolutionary AI-Powered Monitoring Middleware
 * Comprehensive monitoring with intelligent anomaly detection and predictive analytics
 */

import type { Context, Next } from 'hono';
import type { Env, User, ProductContext } from '../types';

export interface MonitoringOptions {
  enableMetrics?: boolean;
  enableTracing?: boolean;
  enableLogging?: boolean;
  enableAnalytics?: boolean;
  enableAnomalyDetection?: boolean;
  enablePredictiveAnalytics?: boolean;
  customMetrics?: Record<string, (c: Context) => Promise<number>>;
  sampleRate?: number;
  excludeHealthChecks?: boolean;
}

export interface MonitoringData {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode?: number;
  responseTime: number;
  userAgent: string;
  ipAddress: string;
  userId?: string;
  organizationId?: string;
  product: string;
  region: string;
  error?: string;
  aiContext?: any;
  customMetrics?: Record<string, number>;
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  apdex: number; // Application Performance Index
}

export interface AnomalyDetection {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyTypes: string[];
  likelyCauses: string[];
  recommendations: string[];
  confidence: number;
}

export function MonitoringMiddleware(options: MonitoringOptions = {}) {
  const {
    enableMetrics = true,
    enableTracing = true,
    enableLogging = true,
    enableAnalytics = true,
    enableAnomalyDetection = true,
    enablePredictiveAnalytics = true,
    customMetrics = {},
    sampleRate = 1.0,
    excludeHealthChecks = true
  } = options;

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const productContext = c.get('productContext') as ProductContext;
    const user = c.get('user') as User | undefined;
    const aiContext = c.get('aiContext');

    // Set request ID for tracing
    c.set('requestId', requestId);

    // Skip monitoring for health checks if excluded
    if (excludeHealthChecks && c.req.path === '/health') {
      await next();
      return;
    }

    // Sample requests if sample rate < 1
    if (Math.random() > sampleRate) {
      await next();
      return;
    }

    let monitoringData: MonitoringData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      responseTime: 0,
      userAgent: c.req.header('User-Agent') || 'unknown',
      ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
      userId: user?.id,
      organizationId: user?.organization_id,
      product: productContext.product,
      region: productContext.region,
      aiContext
    };

    let error: Error | undefined;

    try {
      await next();

      monitoringData.statusCode = c.res?.status;
      monitoringData.responseTime = Date.now() - startTime;

      // Collect custom metrics
      if (Object.keys(customMetrics).length > 0) {
        monitoringData.customMetrics = {};
        for (const [name, metricFn] of Object.entries(customMetrics)) {
          try {
            monitoringData.customMetrics[name] = await metricFn(c);
          } catch (metricError) {
            console.error(`Failed to collect custom metric ${name}:`, metricError);
          }
        }
      }

      // Store monitoring data
      if (enableMetrics) {
        await storeMetrics(c.env, monitoringData);
      }

      // Tracing
      if (enableTracing) {
        await storeTracingData(c.env, monitoringData);
      }

      // Anomaly detection
      if (enableAnomalyDetection) {
        const anomalyDetection = await detectAnomalies(c.env, monitoringData);
        if (anomalyDetection.isAnomaly) {
          await handleAnomaly(c.env, monitoringData, anomalyDetection);
        }
      }

      // Logging
      if (enableLogging) {
        await storeLogs(c.env, monitoringData);
      }

      // Analytics
      if (enableAnalytics) {
        await updateAnalytics(c.env, monitoringData);
      }

      // Predictive analytics
      if (enablePredictiveAnalytics) {
        await updatePredictiveModels(c.env, monitoringData);
      }

      // Set monitoring headers
      setMonitoringHeaders(c, monitoringData);

    } catch (err) {
      error = err as Error;
      monitoringData.error = error.message;
      monitoringData.responseTime = Date.now() - startTime;

      // Enhanced error monitoring
      if (enableMetrics) {
        await storeErrorMetrics(c.env, monitoringData, error);
      }

      if (enableLogging) {
        await storeErrorLogs(c.env, monitoringData, error);
      }

      // Re-throw the error
      throw error;
    }
  };
}

async function storeMetrics(env: Env, data: MonitoringData): Promise<void> {
  try {
    // Store individual request metrics
    const metricKey = `metric:${data.timestamp}:${data.requestId}`;
    await env.AGENT_MEMORY.put(metricKey, JSON.stringify(data), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });

    // Update aggregated metrics
    await updateAggregatedMetrics(env, data);
  } catch (error) {
    console.error('Failed to store metrics:', error);
  }
}

async function updateAggregatedMetrics(env: Env, data: MonitoringData): Promise<void> {
  try {
    const now = new Date();
    const timeWindows = [
      { key: '1m', ttl: 60 },
      { key: '5m', ttl: 5 * 60 },
      { key: '1h', ttl: 60 * 60 },
      { key: '1d', ttl: 24 * 60 * 60 }
    ];

    for (const window of timeWindows) {
      const key = `aggregated_metrics:${data.product}:${data.region}:${window.key}:${now.toISOString().slice(0, -8)}`;
      const current = await env.AGENT_MEMORY.get(key);

      let metrics = current ? JSON.parse(current) : {
        requestCount: 0,
        totalResponseTime: 0,
        errorCount: 0,
        statusCodes: {},
        userCount: new Set(),
        organizationCount: new Set(),
        customMetrics: {}
      };

      // Update metrics
      metrics.requestCount++;
      metrics.totalResponseTime += data.responseTime;

      if (data.statusCode && data.statusCode >= 400) {
        metrics.errorCount++;
      }

      // Track status codes
      if (data.statusCode) {
        metrics.statusCodes[data.statusCode] = (metrics.statusCodes[data.statusCode] || 0) + 1;
      }

      // Track unique users and organizations
      if (data.userId) {
        metrics.userCount.add(data.userId);
      }
      if (data.organizationId) {
        metrics.organizationCount.add(data.organizationId);
      }

      // Update custom metrics
      if (data.customMetrics) {
        for (const [name, value] of Object.entries(data.customMetrics)) {
          if (!metrics.customMetrics[name]) {
            metrics.customMetrics[name] = { sum: 0, count: 0 };
          }
          metrics.customMetrics[name].sum += value;
          metrics.customMetrics[name].count++;
        }
      }

      // Convert Sets to arrays for storage
      metrics.userCount = Array.from(metrics.userCount);
      metrics.organizationCount = Array.from(metrics.organizationCount);

      await env.AGENT_MEMORY.put(key, JSON.stringify(metrics), {
        expirationTtl: window.ttl
      });
    }
  } catch (error) {
    console.error('Failed to update aggregated metrics:', error);
  }
}

async function storeTracingData(env: Env, data: MonitoringData): Promise<void> {
  try {
    const traceData = {
      traceId: data.requestId,
      spanId: crypto.randomUUID(),
      parentSpanId: null,
      operationName: `${data.method} ${data.path}`,
      startTime: new Date(data.timestamp).getTime(),
      duration: data.responseTime,
      tags: {
        'http.method': data.method,
        'http.status_code': data.statusCode,
        'product': data.product,
        'region': data.region,
        'user.id': data.userId,
        'organization.id': data.organizationId
      },
      logs: data.error ? [{ timestamp: Date.now(), level: 'error', message: data.error }] : []
    };

    const traceKey = `trace:${data.requestId}`;
    await env.AGENT_MEMORY.put(traceKey, JSON.stringify(traceData), {
      expirationTtl: 24 * 60 * 60 // 24 hours
    });
  } catch (error) {
    console.error('Failed to store tracing data:', error);
  }
}

async function detectAnomalies(env: Env, data: MonitoringData): Promise<AnomalyDetection> {
  try {
    if (!env.AI) {
      return { isAnomaly: false, anomalyScore: 0, anomalyTypes: [], likelyCauses: [], recommendations: [], confidence: 0 };
    }

    // Get historical data for comparison
    const historicalData = await getHistoricalMetrics(env, data.product, data.region);

    const anomalyPrompt = `
    Analyze this request for anomalies:

    Current Request:
    - Method: ${data.method}
    - Path: ${data.path}
    - Response Time: ${data.responseTime}ms
    - Status Code: ${data.statusCode}
    - User: ${data.userId}
    - Organization: ${data.organizationId}
    - IP: ${data.ipAddress}
    - Timestamp: ${data.timestamp}

    Historical Data:
    ${JSON.stringify(historicalData, null, 2)}

    AI Context:
    ${JSON.stringify(data.aiContext, null, 2)}

    Analyze for:
    1. Response time anomalies
    2. Error rate anomalies
    3. Geographic anomalies
    4. User behavior anomalies
    5. Request pattern anomalies

    Return JSON:
    {
      "isAnomaly": true/false,
      "anomalyScore": 0.0-1.0,
      "anomalyTypes": ["performance", "security", "usage"],
      "likelyCauses": ["cause1", "cause2"],
      "recommendations": ["action1", "action2"],
      "confidence": 0.0-1.0
    }`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: anomalyPrompt }],
      temperature: 0.1,
      max_tokens: 500
    });

    if (response?.response) {
      return JSON.parse(response.response);
    }
  } catch (error) {
    console.error('Anomaly detection failed:', error);
  }

  return {
    isAnomaly: false,
    anomalyScore: 0,
    anomalyTypes: [],
    likelyCauses: [],
    recommendations: [],
    confidence: 0
  };
}

async function getHistoricalMetrics(env: Env, product: string, region: string): Promise<any> {
  try {
    const key = `aggregated_metrics:${product}:${region}:1h:${new Date().toISOString().slice(0, -8)}`;
    const metrics = await env.AGENT_MEMORY.get(key);

    if (metrics) {
      const parsed = JSON.parse(metrics);
      return {
        averageResponseTime: parsed.totalResponseTime / parsed.requestCount,
        errorRate: parsed.errorCount / parsed.requestCount,
        requestCount: parsed.requestCount,
        uniqueUsers: parsed.userCount.length,
        uniqueOrganizations: parsed.organizationCount.length
      };
    }
  } catch (error) {
    console.error('Failed to get historical metrics:', error);
  }

  return {
    averageResponseTime: 0,
    errorRate: 0,
    requestCount: 0,
    uniqueUsers: 0,
    uniqueOrganizations: 0
  };
}

async function handleAnomaly(env: Env, data: MonitoringData, anomaly: AnomalyDetection): Promise<void> {
  try {
    // Store anomaly for investigation
    const anomalyKey = `anomaly:${Date.now()}:${data.requestId}`;
    await env.AGENT_MEMORY.put(anomalyKey, JSON.stringify({
      request: data,
      anomaly,
      timestamp: new Date().toISOString()
    }), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });

    // Trigger alerts for high-severity anomalies
    if (anomaly.anomalyScore > 0.8) {
      await triggerAnomalyAlert(env, data, anomaly);
    }

    // Update anomaly statistics
    await updateAnomalyStatistics(env, data.product, anomaly);
  } catch (error) {
    console.error('Failed to handle anomaly:', error);
  }
}

async function triggerAnomalyAlert(env: Env, data: MonitoringData, anomaly: AnomalyDetection): Promise<void> {
  try {
    const alert = {
      id: crypto.randomUUID(),
      severity: anomaly.anomalyScore > 0.9 ? 'critical' : 'high',
      type: 'anomaly_detected',
      title: `Anomaly detected in ${data.product}`,
      description: `Anomaly detected: ${anomaly.anomalyTypes.join(', ')}`,
      data: {
        request: data,
        anomaly,
        timestamp: new Date().toISOString()
      },
      status: 'open',
      createdAt: new Date().toISOString()
    };

    const alertKey = `alert:${alert.id}`;
    await env.AGENT_MEMORY.put(alertKey, JSON.stringify(alert), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });

    // Queue for processing
    if (env.AI_PROCESSING_QUEUE) {
      await env.AI_PROCESSING_QUEUE.send({
        type: 'anomaly_alert',
        alertId: alert.id,
        severity: alert.severity,
        timestamp: alert.createdAt
      });
    }
  } catch (error) {
    console.error('Failed to trigger anomaly alert:', error);
  }
}

async function updateAnomalyStatistics(env: Env, product: string, anomaly: AnomalyDetection): Promise<void> {
  try {
    const statsKey = `anomaly_stats:${product}:${new Date().toISOString().split('T')[0]}`;
    const currentStats = await env.AGENT_MEMORY.get(statsKey);

    let stats = currentStats ? JSON.parse(currentStats) : {
      totalAnomalies: 0,
      anomalyTypes: {},
      averageScore: 0,
      highSeverityCount: 0
    };

    stats.totalAnomalies++;

    for (const type of anomaly.anomalyTypes) {
      stats.anomalyTypes[type] = (stats.anomalyTypes[type] || 0) + 1;
    }

    stats.averageScore = (stats.averageScore * (stats.totalAnomalies - 1) + anomaly.anomalyScore) / stats.totalAnomalies;

    if (anomaly.anomalyScore > 0.8) {
      stats.highSeverityCount++;
    }

    await env.AGENT_MEMORY.put(statsKey, JSON.stringify(stats), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
  } catch (error) {
    console.error('Failed to update anomaly statistics:', error);
  }
}

async function storeLogs(env: Env, data: MonitoringData): Promise<void> {
  try {
    const logLevel = data.statusCode && data.statusCode >= 500 ? 'error' :
                    data.statusCode && data.statusCode >= 400 ? 'warn' :
                    data.responseTime > 1000 ? 'warn' : 'info';

    const logEntry = {
      timestamp: data.timestamp,
      level: logLevel,
      requestId: data.requestId,
      message: `${data.method} ${data.path} - ${data.statusCode} in ${data.responseTime}ms`,
      data: {
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        userId: data.userId,
        organizationId: data.organizationId,
        product: data.product,
        region: data.region,
        error: data.error
      }
    };

    const logKey = `log:${data.timestamp}:${data.requestId}`;
    await env.AGENT_MEMORY.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });
  } catch (error) {
    console.error('Failed to store logs:', error);
  }
}

async function storeErrorMetrics(env: Env, data: MonitoringData, error: Error): Promise<void> {
  try {
    const errorMetrics = {
      timestamp: data.timestamp,
      requestId: data.requestId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      request: {
        method: data.method,
        path: data.path,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        userId: data.userId,
        organizationId: data.organizationId,
        product: data.product,
        region: data.region
      }
    };

    const errorKey = `error_metric:${data.timestamp}:${data.requestId}`;
    await env.AGENT_MEMORY.put(errorKey, JSON.stringify(errorMetrics), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });

    // Update error statistics
    await updateErrorStatistics(env, data.product, error.name);
  } catch (err) {
    console.error('Failed to store error metrics:', err);
  }
}

async function updateErrorStatistics(env: Env, product: string, errorName: string): Promise<void> {
  try {
    const statsKey = `error_stats:${product}:${new Date().toISOString().split('T')[0]}`;
    const currentStats = await env.AGENT_MEMORY.get(statsKey);

    let stats = currentStats ? JSON.parse(currentStats) : {
      totalErrors: 0,
      errorTypes: {},
      errorsByHour: {}
    };

    stats.totalErrors++;
    stats.errorTypes[errorName] = (stats.errorTypes[errorName] || 0) + 1;

    const hour = new Date().getHours();
    stats.errorsByHour[hour] = (stats.errorsByHour[hour] || 0) + 1;

    await env.AGENT_MEMORY.put(statsKey, JSON.stringify(stats), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
  } catch (error) {
    console.error('Failed to update error statistics:', error);
  }
}

async function storeErrorLogs(env: Env, data: MonitoringData, error: Error): Promise<void> {
  try {
    const logEntry = {
      timestamp: data.timestamp,
      level: 'error',
      requestId: data.requestId,
      message: `Error in ${data.method} ${data.path}: ${error.message}`,
      data: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        request: {
          method: data.method,
          path: data.path,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          userId: data.userId,
          organizationId: data.organizationId,
          product: data.product,
          region: data.region
        }
      }
    };

    const logKey = `error_log:${data.timestamp}:${data.requestId}`;
    await env.AGENT_MEMORY.put(logKey, JSON.stringify(logEntry), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
  } catch (err) {
    console.error('Failed to store error logs:', err);
  }
}

async function updateAnalytics(env: Env, data: MonitoringData): Promise<void> {
  try {
    // Real-time analytics updates
    const analyticsKey = `realtime_analytics:${data.product}:${data.region}`;
    const current = await env.CACHE.get(analyticsKey);

    let analytics = current ? JSON.parse(current) : {
      activeUsers: new Set(),
      requestCount: 0,
      averageResponseTime: 0,
      topEndpoints: {},
      userAgents: {},
      geographicDistribution: {}
    };

    analytics.requestCount++;
    analytics.averageResponseTime = (analytics.averageResponseTime * (analytics.requestCount - 1) + data.responseTime) / analytics.requestCount;

    if (data.userId) {
      analytics.activeUsers.add(data.userId);
    }

    // Track top endpoints
    analytics.topEndpoints[data.path] = (analytics.topEndpoints[data.path] || 0) + 1;

    // Track user agents
    analytics.userAgents[data.userAgent] = (analytics.userAgents[data.userAgent] || 0) + 1;

    // Track geographic distribution
    analytics.geographicDistribution[data.ipAddress] = (analytics.geographicDistribution[data.ipAddress] || 0) + 1;

    // Convert Sets to arrays for storage
    analytics.activeUsers = Array.from(analytics.activeUsers);

    await env.CACHE.put(analyticsKey, JSON.stringify(analytics), {
      expirationTtl: 300 // 5 minutes
    });
  } catch (error) {
    console.error('Failed to update analytics:', error);
  }
}

async function updatePredictiveModels(env: Env, data: MonitoringData): Promise<void> {
  try {
    if (!env.AI) return;

    // Store data for predictive model training
    const trainingDataKey = `training_data:${data.product}:${new Date().toISOString().split('T')[0]}`;
    const currentData = await env.AGENT_MEMORY.get(trainingDataKey);

    let trainingData = currentData ? JSON.parse(currentData) : [];

    trainingData.push({
      timestamp: data.timestamp,
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      responseTime: data.responseTime,
      statusCode: data.statusCode,
      path: data.path,
      method: data.method,
      hasError: !!data.error,
      userId: data.userId,
      organizationId: data.organizationId
    });

    // Keep only last 1000 entries per day
    if (trainingData.length > 1000) {
      trainingData = trainingData.slice(-1000);
    }

    await env.AGENT_MEMORY.put(trainingDataKey, JSON.stringify(trainingData), {
      expirationTtl: 90 * 24 * 60 * 60 // 90 days
    });
  } catch (error) {
    console.error('Failed to update predictive models:', error);
  }
}

function setMonitoringHeaders(c: Context, data: MonitoringData): void {
  c.header('X-Request-ID', data.requestId);
  c.header('X-Response-Time', `${data.responseTime}ms`);
  c.header('X-Product', data.product);
  c.header('X-Region', data.region);

  if (data.aiContext) {
    c.header('X-AI-Processed', 'true');
    c.header('X-AI-Confidence', data.aiContext.confidence?.toString() || '0');
  }
}

// Predefined monitoring configurations
export const createFullMonitoring = () => MonitoringMiddleware({
  enableMetrics: true,
  enableTracing: true,
  enableLogging: true,
  enableAnalytics: true,
  enableAnomalyDetection: true,
  enablePredictiveAnalytics: true,
  sampleRate: 1.0
});

export const createBasicMonitoring = () => MonitoringMiddleware({
  enableMetrics: true,
  enableTracing: false,
  enableLogging: true,
  enableAnalytics: false,
  enableAnomalyDetection: false,
  enablePredictiveAnalytics: false,
  sampleRate: 0.1
});

export const createHighFrequencyMonitoring = () => MonitoringMiddleware({
  enableMetrics: true,
  enableTracing: true,
  enableLogging: true,
  enableAnalytics: true,
  enableAnomalyDetection: true,
  enablePredictiveAnalytics: true,
  sampleRate: 1.0,
  customMetrics: {
    memoryUsage: async (c) => {
      // Custom metric example - would need actual implementation
      return Math.random() * 100;
    },
    cpuUsage: async (c) => {
      // Custom metric example - would need actual implementation
      return Math.random() * 100;
    }
  }
});