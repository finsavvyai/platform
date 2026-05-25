/**
 * TokenForge API — api.tokenforge.dev.
 *
 * Phase 3 surface (CISCO-dua.md §6.1):
 *   GET  /v1/health
 *   POST /v1/sessions/register      X-TokenForge-Key
 *   POST /v1/sessions/refresh       X-TokenForge-Key + DPoP
 *   POST /v1/sessions/:id/revoke    X-TokenForge-Key
 *   GET  /v1/sessions?subject=...   X-TokenForge-Key
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { App as AppRow } from '@tokenforge/db';
import { drizzle, type Tenant } from '@tokenforge/db';
import { drizzleDb } from './lib/db-drizzle.js';
import { KvChallengeStore } from './lib/kv-challenge-store.js';
import { apiKey } from './middleware/api-key.js';
import { handleRegister } from './routes/sessions.register.js';
import { handleRefresh } from './routes/sessions.refresh.js';
import { handleDbscRegister } from './routes/sessions.dbsc-register.js';
import { handleOidcCallback } from './routes/sso.oidc.js';
import { handleRevoke, handleList } from './routes/sessions.admin.js';
import {
  handleCreateWebhook,
  handleDeleteWebhook,
  handleListWebhooks,
  handleTestWebhook,
} from './routes/webhooks.js';
import { InMemoryWebhookStore } from './services/webhooks/store.js';
import { WebhookSink } from './services/webhooks/sink.js';

const webhookStore = new InMemoryWebhookStore();
const webhookSink = new WebhookSink({ store: webhookStore });

export interface Env {
  DB: D1Database;
  NONCES: KVNamespace;
  ENVIRONMENT: string;
  COMMIT_SHA?: string;
  REFRESH_URL?: string;
  DBSC_REGISTRATION_URL?: string;
}

type AppEnv = {
  Bindings: Env;
  Variables: { app: AppRow };
};

const app = new Hono<AppEnv>();

app.use(
  '*',
  cors({
    origin: (o) => o,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'DPoP', 'X-TokenForge-Key', 'Sec-Session-Response'],
    credentials: true,
  }),
);

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.get('/', (c) =>
  c.json({
    name: 'TokenForge API',
    version: '0.1.0',
    docs: 'https://tokenforge.dev/docs',
    spec: 'https://tokenforge.dev/.well-known/tokenforge/dbsc',
  }),
);

app.get('/v1/health', async (c) => {
  let dbOk = false;
  try {
    drizzle(c.env.DB);
    const rows = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'",
    ).all<Tenant>();
    dbOk = rows.success === true;
  } catch {
    dbOk = false;
  }
  return c.json({
    status: 'ok',
    db: dbOk ? 'reachable' : 'unreachable',
    environment: c.env.ENVIRONMENT,
    commit: c.env.COMMIT_SHA ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

app.use('/v1/sessions/*', apiKey({ db: (env) => drizzleDb((env as Env).DB) }));

app.post('/v1/sessions/register', async (c) =>
  handleRegister(c, {
    db: drizzleDb(c.env.DB),
    challengeStore: new KvChallengeStore(c.env.NONCES),
    refreshUrl: c.env.REFRESH_URL ?? 'https://api.tokenforge.dev/v1/sessions/refresh',
  }),
);

app.post('/v1/sessions/dbsc-register', async (c) =>
  handleDbscRegister(c, {
    db: drizzleDb(c.env.DB),
    challengeStore: new KvChallengeStore(c.env.NONCES),
    registrationUrl: c.env.DBSC_REGISTRATION_URL ?? `${new URL(c.req.url).origin}/v1/sessions/dbsc-register`,
    refreshUrl: c.env.REFRESH_URL ?? 'https://api.tokenforge.dev/v1/sessions/refresh',
  }),
);

app.post('/v1/sessions/refresh', async (c) =>
  handleRefresh(c, {
    db: drizzleDb(c.env.DB),
    challengeStore: new KvChallengeStore(c.env.NONCES),
    webhooks: webhookSink,
  }),
);

app.post('/v1/sessions/:id/revoke', async (c) =>
  handleRevoke(c, { db: drizzleDb(c.env.DB) }),
);

app.get('/v1/sessions', async (c) =>
  handleList(c, { db: drizzleDb(c.env.DB) }),
);

app.use('/v1/sso/*', apiKey({ db: (env) => drizzleDb((env as Env).DB) }));

app.post('/v1/sso/:appId/callback', async (c) =>
  handleOidcCallback(c, {
    db: drizzleDb(c.env.DB),
    challengeStore: new KvChallengeStore(c.env.NONCES),
    refreshUrl: c.env.REFRESH_URL ?? 'https://api.tokenforge.dev/v1/sessions/refresh',
  }),
);

app.use('/v1/webhooks', apiKey({ db: (env) => drizzleDb((env as Env).DB) }));
app.use('/v1/webhooks/*', apiKey({ db: (env) => drizzleDb((env as Env).DB) }));

app.get('/v1/webhooks', async (c) => handleListWebhooks(c, { store: webhookStore }));
app.post('/v1/webhooks', async (c) => handleCreateWebhook(c, { store: webhookStore }));
app.delete('/v1/webhooks/:id', async (c) => handleDeleteWebhook(c, { store: webhookStore }));
app.post('/v1/webhooks/:id/test', async (c) => handleTestWebhook(c, { store: webhookStore }));

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'internal_server_error',
      message: c.env.ENVIRONMENT === 'staging' ? err.message : 'An unexpected error occurred',
    },
    500,
  );
});

export default { fetch: app.fetch };
