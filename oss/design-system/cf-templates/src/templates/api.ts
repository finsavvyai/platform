export function getApiTemplate(): string {
  return `import { Hono } from 'hono';
import { createApp, getD1, getKV } from '@finsavvyai/cf-stack';

const app = createApp({
  corsOrigins: ['https://example.com'],
  rateLimit: { maxRequests: 100, windowMs: 60000 },
});

app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/users', async (c) => {
  const db = getD1(c, 'DB');
  const users = await db.prepare('SELECT * FROM users LIMIT 10').all();
  return c.json(users);
});

app.post('/api/users', async (c) => {
  const body = await c.req.json();
  const db = getD1(c, 'DB');

  const result = await db
    .prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    .bind(body.name, body.email)
    .run();

  return c.json({ success: result.success }, 201);
});

app.get('/api/subscriptions/:userId', async (c) => {
  const userId = c.req.param('userId');
  const kv = getKV(c, 'CACHE');

  const cached = await kv.get(\`subscription:\${userId}\`);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  const db = getD1(c, 'DB');
  const sub = await db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .bind(userId)
    .first();

  if (sub) {
    await kv.put(\`subscription:\${userId}\`, JSON.stringify(sub), {
      expirationTtl: 3600,
    });
  }

  return c.json(sub || { error: 'Not found' }, sub ? 200 : 404);
});

export default app;
`;
}
