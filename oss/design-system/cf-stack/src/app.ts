import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  createRateLimiter,
  createErrorHandler,
  createCors,
} from './index';

export interface AppConfig {
  corsOrigins?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  enableErrorHandler?: boolean;
  enableCors?: boolean;
  enableRateLimit?: boolean;
}

export function createApp(config: AppConfig = {}): Hono {
  const {
    corsOrigins = ['*'],
    rateLimit = { maxRequests: 100, windowMs: 60000 },
    enableErrorHandler = true,
    enableCors = true,
    enableRateLimit = true,
  } = config;

  const app = new Hono();

  if (enableErrorHandler) {
    app.use(createErrorHandler());
  }

  if (enableCors) {
    app.use(createCors({ origins: corsOrigins }));
  }

  if (enableRateLimit) {
    app.use(createRateLimiter(rateLimit));
  }

  app.get('/health', (c: Context) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
