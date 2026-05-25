/**
 * UPM.Plus AutomationHub - Cloudflare Workers Entry Point
 * Provides edge computing capabilities for global distribution
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { validator } from 'hono/validator';
import { z } from 'zod';

// Import route handlers
import { healthRoutes } from './routes/health';
import { apiRoutes } from './routes/api';
import { proxyRoutes } from './routes/proxy';
import { fileRoutes } from './routes/files';
import { analyticsRoutes } from './routes/analytics';
import { CollaborationRoom } from './durable-objects/collaboration';

// Create Hono application
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://upm.plus', 'https://www.upm.plus', 'https://admin.upm.plus'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const url = new URL(c.req.url);

  console.log(`[${c.req.method}] ${url.pathname} - ${c.req.header('user-agent') || 'Unknown'}`);

  await next();

  const duration = Date.now() - start;
  console.log(`[${c.req.method}] ${url.pathname} - ${c.res.status} - ${duration}ms`);

  // Store analytics data
  c.env.UPM_ANALYTICS?.writeDataPoint({
    blobs: [url.pathname, c.req.method, c.req.header('user-agent') || 'Unknown'],
    doubles: [duration, c.res.status],
    indexes: [c.env.ENVIRONMENT === 'production' ? 1 : 0]
  });
});

// Health check routes
app.route('/health', healthRoutes);

// API routes
app.route('/api/v1', apiRoutes);

// Proxy routes for backend services
app.route('/proxy', proxyRoutes);

// File handling routes
app.route('/files', fileRoutes);

// Analytics routes
app.route('/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'UPM.Plus AutomationHub',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api/v1',
      files: '/files',
      analytics: '/analytics'
    }
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${c.req.url} does not exist`,
    available_endpoints: [
      '/health',
      '/api/v1/agents',
      '/api/v1/workflows',
      '/files/upload',
      '/analytics/metrics'
    ]
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);

  return c.json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString(),
    request_id: c.req.header('cf-ray') || 'unknown'
  }, 500);
});

// Durable Object export
export { CollaborationRoom };

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Scheduled event triggered:', event.cron);

    // Background tasks
    switch (event.cron) {
      case '0 * * * *': // Every hour
        await performHourlyTasks(env);
        break;
      case '0 0 * * *': // Daily at midnight
        await performDailyTasks(env);
        break;
    }
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    console.log(`Processing queue batch with ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        await processQueueMessage(message, env);
        message.ack();
      } catch (error) {
        console.error('Failed to process queue message:', error);
        message.retry();
      }
    }
  }
};

// Background task functions
async function performHourlyTasks(env: Env): Promise<void> {
  console.log('Performing hourly maintenance tasks');

  // Cleanup expired cache entries
  const cacheKeys = await env.UPM_CACHE.list();
  const now = Date.now();
  const expireThreshold = 60 * 60 * 1000; // 1 hour

  for (const key of cacheKeys.keys) {
    const cached = await env.UPM_CACHE.get(key.name);
    if (cached) {
      const data = JSON.parse(cached);
      if (now - data.timestamp > expireThreshold) {
        await env.UPM_CACHE.delete(key.name);
      }
    }
  }

  // Update analytics summary
  await updateAnalyticsSummary(env);
}

async function performDailyTasks(env: Env): Promise<void> {
  console.log('Performing daily maintenance tasks');

  // Generate daily reports
  await generateDailyReport(env);

  // Cleanup old analytics data
  await cleanupOldAnalytics(env);

  // Backup critical data
  await backupCriticalData(env);
}

async function processQueueMessage(message: any, env: Env): Promise<void> {
  const { type, data } = message.body;

  switch (type) {
    case 'task_execution':
      await handleTaskExecution(data, env);
      break;
    case 'user_notification':
      await handleUserNotification(data, env);
      break;
    case 'analytics_event':
      await handleAnalyticsEvent(data, env);
      break;
    default:
      console.warn('Unknown queue message type:', type);
  }
}

async function handleTaskExecution(data: any, env: Env): Promise<void> {
  // Process task execution in background
  console.log('Processing task execution:', data.taskId);

  // Update task status in D1
  await env.UPM_DB.prepare(`
    UPDATE tasks SET status = ?, updated_at = ?
    WHERE id = ?
  `).bind('processing', new Date().toISOString(), data.taskId).run();
}

async function handleUserNotification(data: any, env: Env): Promise<void> {
  // Send user notifications
  console.log('Sending notification to user:', data.userId);

  // Store notification in D1
  await env.UPM_DB.prepare(`
    INSERT INTO notifications (user_id, type, message, data, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    data.userId,
    data.type,
    data.message,
    JSON.stringify(data.data || {}),
    new Date().toISOString()
  ).run();
}

async function handleAnalyticsEvent(data: any, env: Env): Promise<void> {
  // Process analytics events
  console.log('Processing analytics event:', data.event);

  // Store in Analytics Engine
  env.UPM_ANALYTICS?.writeDataPoint({
    blobs: [data.event, data.userId || 'anonymous'],
    doubles: [data.value || 0],
    indexes: [data.category || 0]
  });
}

async function updateAnalyticsSummary(env: Env): Promise<void> {
  // Update cached analytics summary
  const summary = await env.UPM_DB.prepare(`
    SELECT
      COUNT(*) as total_users,
      COUNT(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 END) as active_users_today,
      COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as active_users_week
    FROM users
  `).first();

  await env.UPM_CACHE.put(
    'analytics:summary',
    JSON.stringify({
      ...summary,
      updated_at: new Date().toISOString()
    }),
    { expirationTtl: 3600 } // 1 hour
  );
}

async function generateDailyReport(env: Env): Promise<void> {
  console.log('Generating daily report');

  const report = await env.UPM_DB.prepare(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      AVG(execution_time) as avg_execution_time
    FROM tasks
    WHERE created_at >= datetime('now', '-1 day')
    GROUP BY DATE(created_at)
  `).first();

  // Store report in KV for later retrieval
  await env.UPM_CACHE.put(
    `daily_report:${new Date().toISOString().split('T')[0]}`,
    JSON.stringify(report),
    { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
  );
}

async function cleanupOldAnalytics(env: Env): Promise<void> {
  console.log('Cleaning up old analytics data');

  // Clean up analytics data older than 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  await env.UPM_DB.prepare(`
    DELETE FROM analytics_events
    WHERE created_at < ?
  `).bind(ninetyDaysAgo.toISOString()).run();
}

async function backupCriticalData(env: Env): Promise<void> {
  console.log('Backing up critical data');

  // Export critical configuration to R2
  const config = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    settings: await env.UPM_CONFIG.get('app_settings')
  };

  await env.UPM_FILES.put(
    `backups/config_${new Date().toISOString().split('T')[0]}.json`,
    JSON.stringify(config, null, 2)
  );
}