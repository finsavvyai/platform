import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { bodyLimit } from 'hono/body-limit';
import type { Env, Variables } from './types.js';
import { securityHeaders } from './middleware/security-headers.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { tokenForgeMiddlewareInternal as tokenForgeMiddleware } from '@opensyber/tokenforge/server/internal';
import { D1Storage } from '@opensyber/tokenforge/storage/internal';
import { registerRoutes } from './routes/register.js';
import { recordScoreSnapshots } from './routes/security-cron.js';
import { processTrialEmails } from './services/trial.js';
import { pollInstanceHealth } from './services/health-cron.js';
import { enforceAuditRetention } from './services/audit-retention.js';
import { runScheduledJobs } from './services/cron-handlers.js';
import { processDlqRetries } from './services/dlq-processor.js';

// Re-export Durable Object class for Cloudflare runtime
export { AgentInstance } from './durable-objects/agent-instance.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', securityHeaders);
app.use('*', bodyLimit({ maxSize: 256 * 1024 }));
app.use('*', async (c, next) => {
  const origins = [
    'https://opensyber.cloud', 'https://www.opensyber.cloud',
    'https://tokenforge.opensyber.cloud',
  ];
  if (c.env.ENVIRONMENT !== 'production') {
    origins.push('http://localhost:3000');
  }
  const mw = cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type', 'Authorization', 'X-Gateway-Token', 'X-Instance-Id',
      'X-TF-Signature', 'X-TF-Nonce', 'X-TF-Timestamp', 'X-TF-Device-ID',
      'X-Org-Id', 'X-API-Key',
    ],
    credentials: true,
  });
  return mw(c, next);
});

// TokenForge device-bound session verification
app.use('/api/*', async (c, next) => {
  const storage = new D1Storage(c.env.DB, c.env.TF_NONCES);
  const mw = tokenForgeMiddleware({
    storage,
    trustThresholds: { allow: 50, stepUp: 30 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    // TokenForge skipPaths — entries MUST either be truly unauthenticated or
    // use a different auth mechanism (gateway token, API key). Enterprise
    // and SSO routes are JWT-auth'd and thus SHOULD be covered by device
    // binding; do not add them here without a documented reason.
    skipPaths: ['/health', '/webhooks/*', '/api/agent/*', '/api/tf/*', '/api/badges/*', '/api/threats/*', '/api/threat-intel/*', '/api/score/*', '/api/achievements/*', '/api/trust/*', '/api/ingest/*'],
    sensitiveOps: ['DELETE /api/instances/*', 'POST /api/instances/*/secrets'],
    getIpAddress: (req) => (req as Request).headers.get('cf-connecting-ip') ?? '',
    getCountryCode: (req) => (req as Request).headers.get('cf-ipcountry') ?? '',
    getUserAgent: (req) => (req as Request).headers.get('user-agent') ?? '',
  });
  return mw(c as any, next);
});

// Rate limiting
app.use('/api/agent/*', rateLimitMiddleware('agent'));
app.use('/api/*', rateLimitMiddleware('authenticated'));
app.use('/health', rateLimitMiddleware('public'));
app.use('/webhooks/*', rateLimitMiddleware('public'));
app.use('/api/threats/*', rateLimitMiddleware('public'));
app.use('/api/threat-intel/*', rateLimitMiddleware('public'));
app.use('/api/score/*', rateLimitMiddleware('public'));
app.use('/api/achievements/*', rateLimitMiddleware('public'));
app.use('/api/trust/*', rateLimitMiddleware('public'));
app.use('/api/enterprise/*', rateLimitMiddleware('public'));
app.use('/api/ingest/*', rateLimitMiddleware('public'));

// Register all routes
registerRoutes(app);

// Root
app.get('/', (c) => c.json({ name: 'OpenSyber API', version: '0.3.0', docs: 'https://opensyber.cloud/docs/api' }));

// 404 handler
app.notFound((c) => c.json({ error: 'Not found', message: `Route ${c.req.path} not found` }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err instanceof Error ? err.message : 'Unknown error');
  return c.json({
    error: 'Internal server error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : 'An unexpected error occurred',
  }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(recordScoreSnapshots(env));
    ctx.waitUntil(processTrialEmails(env));
    ctx.waitUntil(pollInstanceHealth(env));
    ctx.waitUntil(enforceAuditRetention(env));
    ctx.waitUntil(runScheduledJobs(env));
    ctx.waitUntil(processDlqRetries(env));
  },
};
