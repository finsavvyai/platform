import { Router, Request, Response } from 'express';
import { db } from '../lib/db.js';
import { logger } from '../utils/logger.js';
import { sql } from 'drizzle-orm';

export const healthRouter = Router();

let requestCount = 0;
let totalResponseTime = 0;
const startTime = Date.now();

// Middleware to track metrics
export const metricsMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    requestCount++;
    totalResponseTime += duration;
    return originalSend.call(this, data);
  };

  next();
};

/**
 * GET / - Health check with db status, redis status, version, uptime
 */
healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    let dbStatus = 'down';
    let dbLatency = 0;

    try {
      const dbStartTime = Date.now();
      const result = await (db as any).execute(sql`SELECT 1`);
      dbLatency = Date.now() - dbStartTime;
      dbStatus = 'up';
    } catch (error) {
      logger.error('Database health check failed:', error);
      dbStatus = 'down';
    }

    let redisStatus = 'unknown';
    let redisLatency = 0;

    try {
      const Redis = (await import('ioredis')).default;
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000 });
      const redisStartTime = Date.now();
      await redis.ping();
      redisLatency = Date.now() - redisStartTime;
      redisStatus = 'up';
      await redis.quit();
    } catch {
      redisStatus = 'down';
    }

    const uptime = Date.now() - startTime;
    const version = process.env.APP_VERSION || '1.0.0';

    const status = dbStatus === 'up' && redisStatus === 'up' ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000),
      version,
      components: {
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
        },
        redis: {
          status: redisStatus,
          latency: `${redisLatency}ms`,
        },
        api: {
          status: 'up',
          latency: '0ms',
        },
      },
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /ready - Readiness check (db connected, redis connected)
 * Returns 200 only if all critical dependencies are ready
 */
healthRouter.get('/ready', async (req: Request, res: Response) => {
  try {
    let dbReady = false;
    let redisReady = false;

    // Check database
    try {
      await (db as any).execute(sql`SELECT 1`);
      dbReady = true;
    } catch (error) {
      logger.warn('Database not ready:', error);
    }

    try {
      const Redis = (await import('ioredis')).default;
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000 });
      await redis.ping();
      redisReady = true;
      await redis.quit();
    } catch {
      logger.warn('Redis not ready');
    }

    const ready = dbReady && redisReady;

    res.status(ready ? 200 : 503).json({
      ready,
      checks: {
        database: dbReady,
        redis: redisReady,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(503).json({
      ready: false,
      error: 'Readiness check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /metrics - Basic metrics (requests count, avg response time)
 */
healthRouter.get('/metrics', (req: Request, res: Response) => {
  try {
    const avgResponseTime = requestCount > 0 ? totalResponseTime / requestCount : 0;

    res.json({
      timestamp: new Date().toISOString(),
      metrics: {
        requests: {
          total: requestCount,
          avgResponseTime: Math.round(avgResponseTime),
          unit: 'ms',
        },
        uptime: {
          seconds: Math.floor((Date.now() - startTime) / 1000),
        },
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
        nodejs: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      },
    });
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});
