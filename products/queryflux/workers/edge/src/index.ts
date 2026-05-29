// Cloudflare Worker API for QueryFlux Backend
// File: worker/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './middleware/auth';
import { db } from './db';
import { aiRouter } from './routes/ai';
import { databaseRouter } from './routes/database';
import { healthRouter } from './routes/health';

type Env = {
  QUERYFLUX_DB: D1Database;
  QUERYFLUX_CACHE: KVNamespace;
  QUERYFLUX_STORAGE: R2Bucket;
  JWT_SECRET: string;
  OPENAI_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  OLLAMA_URL?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://queryflux.pages.dev', 'https://preview.queryflux.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Routes
app.route('/health', healthRouter);
app.route('/api/ai', aiRouter);
app.route('/api/database', databaseRouter);

// Authenticated routes
app.use('/api/*', auth);

// API Routes
app.get('/api/version', (c) => {
  return c.json({
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Database management
app.get('/api/connections', async (c) => {
  try {
    const result = await c.env.QUERYFLUX_DB
      .prepare('SELECT * FROM connections WHERE user_id = ?')
      .bind(c.get('userId'))
      .all();

    return c.json({ connections: result.results });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/connections', async (c) => {
  try {
    const { name, type, host, port, database, username } = await c.req.json();

    const result = await c.env.QUERYFLUX_DB
      .prepare('INSERT INTO connections (id, user_id, name, type, host, port, database, username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), c.get('userId'), name, type, host, port, database, username, new Date().toISOString())
      .run();

    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Query execution
app.post('/api/query', async (c) => {
  try {
    const { connectionId, query } = await c.req.json();

    // Get connection details
    const connection = await c.env.QUERYFLUX_DB
      .prepare('SELECT * FROM connections WHERE id = ? AND user_id = ?')
      .bind(connectionId, c.get('userId'))
      .first();

    if (!connection) {
      return c.json({ error: 'Connection not found' }, 404);
    }

    // Execute query (this would need database driver implementation)
    // For now, return mock data
    const result = {
      columns: ['id', 'name', 'email'],
      rows: [
        [1, 'John Doe', 'john@example.com'],
        [2, 'Jane Smith', 'jane@example.com']
      ],
      executionTime: Math.random() * 100,
    };

    // Cache result
    await c.env.QUERYFLUX_CACHE.put(
      `query:${connectionId}:${btoa(query)}`,
      JSON.stringify(result),
      { expirationTtl: 300 }
    );

    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// File upload to R2
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const key = `uploads/${c.get('userId')}/${crypto.randomUUID()}-${file.name}`;
    await c.env.QUERYFLUX_STORAGE.put(key, file.stream());

    return c.json({
      success: true,
      key,
      url: `https://pub-${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default {
  fetch: app.fetch,
};
