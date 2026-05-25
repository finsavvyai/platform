import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { bodyLimit } from 'hono/body-limit';
import type { Env, Variables } from './types.js';
import { createDb } from './lib/db.js';
import { requestLog } from './middleware/request-log.js';
import { mountRoutes } from './routes/mount.js';
import { runUsageCron } from './services/usage-cron.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', requestLog);
app.use('*', prettyJSON());
app.use('*', bodyLimit({ maxSize: 256 * 1024 }));
app.use('*', async (c, next) => {
  const origins = ['https://tokenforge.opensyber.cloud', 'https://opensyber.cloud'];
  if (c.env.ENVIRONMENT !== 'production') {
    origins.push('http://localhost:3000', 'http://localhost:3001');
  }
  const mw = cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-TF-Signature',
      'X-TF-Nonce',
      'X-TF-Timestamp',
      'X-TF-Device-ID',
    ],
    exposeHeaders: [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'X-Usage-Remaining',
    ],
    credentials: false,
    maxAge: 86400,
  });
  return mw(c, next);
});

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('X-XSS-Protection', '0');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Vary', 'Origin');
});

// DB initialization middleware
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB);
  c.set('db', db);
  await next();
});

// Root
app.get('/', (c) => {
  return c.json({
    name: 'TokenForge API',
    version: '0.1.0',
    docs: 'https://tokenforge.opensyber.cloud/docs/api',
  });
});

// All route groups + per-route middleware
mountRoutes(app);

// 404 handler
app.notFound((c) => {
  return c.json(
    { error: 'not_found', message: 'Not found' },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'internal_server_error',
      message:
        c.env.ENVIRONMENT === 'development'
          ? err.message
          : 'An unexpected error occurred',
    },
    500,
  );
});

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const db = createDb(env.DB);
    ctx.waitUntil(
      runUsageCron(db, env.RESEND_API_KEY, env.CACHE)
        .then((result) => {
          console.log(
            `[Cron] Usage check: ${result.tenantsChecked} tenants, ${result.warningsSent} warnings`,
          );
        })
        .catch((err) => {
          console.error('[Cron] Usage check failed:', err);
        }),
    );
  },
};
