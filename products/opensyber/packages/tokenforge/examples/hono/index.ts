/**
 * TokenForge + Hono (Cloudflare Workers) example
 *
 * Run locally:
 *   npx wrangler dev index.ts
 *
 * Deploy:
 *   npx wrangler deploy
 */
import { Hono } from 'hono';
import { tokenForgeMiddleware } from '@opensyber/tokenforge/hono';
import { D1Storage } from '@opensyber/tokenforge/storage';

type Env = {
  DB: D1Database;
  KV: KVNamespace;
};

const app = new Hono<{ Bindings: Env }>();

// Apply TokenForge to /api/* routes
app.use('/api/*', async (c, next) => {
  const storage = new D1Storage(c.env.DB, c.env.KV);
  const mw = tokenForgeMiddleware({
    storage,
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    skipPaths: ['/api/health'],
  });
  return mw(c, next);
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.get('/api/profile', (c) => {
  const tf = c.get('tf') as { bound: boolean; trustScore: number; deviceId: string | null };
  return c.json({
    message: 'Profile data',
    deviceBound: tf.bound,
    trustScore: tf.trustScore,
    deviceId: tf.deviceId,
  });
});

export default app;
