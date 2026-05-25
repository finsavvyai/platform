/**
 * SDLC.ai Platform - Cloudflare Workers Entry Point
 * Production-ready implementation with comprehensive error handling
 */

import { Router } from 'itty-router';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import { cors } from './middleware/cors';
import { auth } from './middleware/auth';
import { validateRequest } from './middleware/validation';
import { metrics } from './middleware/metrics';
import { tracing } from './middleware/tracing';

// Route imports
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import ragRoutes from './routes/rag';
import vectorRoutes from './routes/vector';
import userRoutes from './routes/users';
import tenantRoutes from './routes/tenants';
import adminRoutes from './routes/admin';
import healthRoutes from './routes/health';
import analyticsRoutes from './routes/analytics';

// Service imports
import { MetricsCollector } from './services/metrics';
import { CacheManager } from './services/cache';
import { ConfigService } from './services/config';
import { AnalyticsService } from './services/analytics';

// Create router
const router = Router();

// Initialize services
const metricsCollector = new MetricsCollector();
const cacheManager = new CacheManager();
const configService = new ConfigService();
const analyticsService = new AnalyticsService();

// Global middleware
router.all('*', tracing);
router.all('*', metrics(metricsCollector));
router.all('*', cors);
router.all('*', rateLimiter);

// Health check endpoints (no auth required)
router.all('/health', healthRoutes);
router.all('/health/*', healthRoutes);

// Authentication routes
router.all('/auth/*', authRoutes);

// API routes with authentication
router.all('/api/v1/auth/*', authRoutes);
router.all('/api/v1/documents/*', auth, documentRoutes);
router.all('/api/v1/rag/*', auth, ragRoutes);
router.all('/api/v1/vector/*', auth, vectorRoutes);
router.all('/api/v1/users/*', auth, userRoutes);
router.all('/api/v1/tenants/*', auth, tenantRoutes);
router.all('/api/v1/admin/*', auth, adminRoutes);
router.all('/api/v1/analytics/*', auth, analyticsRoutes);

// GraphQL endpoint
router.all('/graphql', auth, async (request, env) => {
  try {
    const { schema, context } = await import('./graphql');
    const { createYoga } = await import('@graphql-yoga/common');

    const yoga = createYoga({
      schema,
      context: { ...context, request, env, services: { cacheManager, analyticsService } },
      cors: {
        origin: env.CORS_ORIGINS?.split(',') || ['*'],
        credentials: true
      },
      logging: {
        debug: false,
        info: false,
        warn: false,
        error: true
      }
    });

    return yoga.fetch(request);
  } catch (error) {
    logger.error('GraphQL error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to process GraphQL request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// WebSocket upgrade handler
router.all('/ws', async (request, env) => {
  try {
    const pair = new WebSocketPair();
    const [client, server] = pair;

    server.accept();

    // Initialize WebSocket handler
    const handleWebSocket = await import('./handlers/websocket');
    handleWebSocket.default(server, env, request);

    return new Response(null, { status: 101, webSocket: client });
  } catch (error) {
    logger.error('WebSocket upgrade error:', error);
    return new Response('WebSocket upgrade failed', { status: 500 });
  }
});

// Static asset serving
router.get('/static/*', async (request, env) => {
  try {
    const url = new URL(request.url);
    const key = url.pathname.replace('/static/', '');

    // Try to get from R2
    const object = await env.STORAGE.get(key);

    if (object === null) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000');

    return new Response(object.body, {
      headers
    });
  } catch (error) {
    logger.error('Static asset error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

// 404 handler
router.all('*', () => {
  return new Response(JSON.stringify({
    error: 'Not Found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString()
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Export default fetch handler with error handling
export default {
  async fetch(request, env, ctx) {
    try {
      // Initialize logger
      logger.init(env);

      // Request logging
      const start = Date.now();
      const url = new URL(request.url);
      const method = request.method;
      const path = url.pathname;
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const country = request.cf?.country || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';

      logger.info('Request started', {
        method,
        path,
        ip,
        country,
        userAgent: userAgent.substring(0, 200)
      });

      // Execute router
      const response = await router.handle(request, env, ctx);

      // Add security headers
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
      };

      // Add security headers to response
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      // Log completion
      const duration = Date.now() - start;
      logger.info('Request completed', {
        method,
        path,
        status: response.status,
        duration,
        ip,
        country
      });

      // Add request ID header
      response.headers.set('X-Request-ID', crypto.randomUUID());

      return response;
    } catch (error) {
      // Global error handler
      logger.error('Unhandled error:', error);

      // Send error to monitoring
      if (env.SENTRY_DSN) {
        ctx.waitUntil(
          fetch(`https://sentry.io/api/${env.SENTRY_PROJECT_ID}/envelope/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-sentry-envelope',
              'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=workers-sentry/1.0, sentry_key=${env.SENTRY_KEY}`,
            },
            body: JSON.stringify({
              sentry: {
                timestamp: Date.now() / 1000,
                environment: env.ENVIRONMENT,
                release: env.RELEASE_VERSION || '1.0.0',
                platform: 'javascript',
                sdk: {
                  name: 'workers-sentry',
                  version: '1.0.0'
                }
              },
              message: error.message,
              exception: {
                values: [{
                  type: error.name || 'Error',
                  value: error.message,
                  stacktrace: {
                    frames: error.stack?.split('\n').map((line, i) => ({
                      filename: 'index.ts',
                      function: 'unknown',
                      lineno: i,
                      colno: 0,
                      abs_path: 'index.ts',
                      context_line: line.trim(),
                      pre_context: [],
                      post_context: []
                    })) || []
                  }
                }]
              },
              request: {
                url: request.url,
                method: request.method,
                headers: Object.fromEntries(request.headers.entries())
              }
            })
          })
        );
      }

      // Return appropriate error response
      return errorHandler(error, request, env);
    }
  },

  // Queue handler for async jobs
  async queue(batch, env) {
    try {
      const { processQueue } = await import('./handlers/queue');
      await processQueue(batch, env);
    } catch (error) {
      logger.error('Queue processing error:', error);
      // Retry failed messages
      batch.retryAll();
    }
  },

  // Scheduled event handler
  async scheduled(event, env, ctx) {
    try {
      logger.info('Scheduled event started', {
        scheduledTime: event.scheduledTime,
        cron: event.cron
      });

      // Run cleanup tasks
      const { cleanup } = await import('./tasks/cleanup');
      ctx.waitUntil(cleanup(env));

      // Run analytics aggregation
      const { aggregateAnalytics } = await import('./tasks/analytics');
      ctx.waitUntil(aggregateAnalytics(env));

      // Run backup tasks
      const { backupData } = await import('./tasks/backup');
      ctx.waitUntil(backupData(env));

      // Run health checks
      const { runHealthChecks } = await import('./tasks/health');
      ctx.waitUntil(runHealthChecks(env));

      logger.info('Scheduled event completed');
    } catch (error) {
      logger.error('Scheduled event error:', error);
    }
  },

  // Durable Object handler
  async fetch(request, env, ctx) {
    try {
      const id = env.WEBSOCKET.idFromName(request.url);
      const stub = env.WEBSOCKET.get(id);
      return stub.fetch(request);
    } catch (error) {
      logger.error('Durable Object error:', error);
      return new Response('Durable Object error', { status: 500 });
    }
  }
};
