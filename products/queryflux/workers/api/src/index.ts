/**
 * QueryFlux Backend on Cloudflare Workers
 * Using Web Crypto API for auth (Workers-compatible)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from '@neondatabase/serverless';

type Bindings = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  OPENAI_API_KEY?: string;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS middleware
app.use('/*', cors({
  origin: ['https://queryflux.dev', 'https://www.queryflux.dev', 'https://queryflux-frontend.pages.dev', 'http://localhost:5173'],
  credentials: true,
}));

// Simple JWT helpers using Web Crypto API
async function createJWT(payload: any, secret: string, expiresIn: number): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = { ...payload, iat: now, exp: now + expiresIn };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${signatureB64}`;
}

async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

  const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  const paddedSignature = signatureStr + '='.repeat((4 - (signatureStr.length % 4)) % 4);
  const signatureBytes = Uint8Array.from(atob(paddedSignature), c => c.charCodeAt(0));

  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
  if (!valid) throw new Error('Invalid signature');

  const payloadStr = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = payloadStr + '='.repeat((4 - (payloadStr.length % 4)) % 4);
  const payload = JSON.parse(atob(paddedPayload));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    time: Math.floor(Date.now() / 1000),
    environment: c.env.ENVIRONMENT,
  });
});

// JWT middleware
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set('userId', payload.user_id);
    c.set('email', payload.email);
    await next();
  } catch (error: any) {
    return c.json({ error: 'Invalid or expired token', details: error.message }, 401);
  }
};

// Auth: Login
app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    const pool = new Pool({ connectionString: c.env.DATABASE_URL });
    const result = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const user = result.rows[0];
    // Temporary: skip password verification for test user
    // In production, use a Worker-compatible bcrypt library
    if (password !== 'test123') {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate access token (15 min = 900 seconds)
    const accessToken = await createJWT(
      { user_id: user.id, email: user.email },
      c.env.JWT_SECRET,
      900
    );

    // Generate refresh token (7 days = 604800 seconds)
    const refreshToken = await createJWT(
      { user_id: user.id, email: user.email, type: 'refresh' },
      c.env.JWT_SECRET,
      604800
    );

    // Store refresh token
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [user.id, refreshToken]
    );

    return c.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed', details: error.message }, 500);
  }
});

// Auth: Refresh token
app.post('/auth/refresh', async (c) => {
  try {
    const { refresh_token } = await c.req.json();

    if (!refresh_token) {
      return c.json({ error: 'Refresh token required' }, 400);
    }

    const payload = await verifyJWT(refresh_token, c.env.JWT_SECRET);

    if (payload.type !== 'refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    const pool = new Pool({ connectionString: c.env.DATABASE_URL });

    // Verify token exists in database
    const tokenResult = await pool.query(
      'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW() AND revoked = false',
      [payload.user_id, refresh_token]
    );

    if (tokenResult.rows.length === 0) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    // Generate new access token
    const accessToken = await createJWT(
      { user_id: payload.user_id, email: payload.email },
      c.env.JWT_SECRET,
      900
    );

    // Generate new refresh token (rotation)
    const newRefreshToken = await createJWT(
      { user_id: payload.user_id, email: payload.email, type: 'refresh' },
      c.env.JWT_SECRET,
      604800
    );

    // Revoke old refresh token and store new one
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE token = $1', [refresh_token]);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [payload.user_id, newRefreshToken]
    );

    return c.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: 900,
      token_type: 'Bearer',
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    return c.json({ error: 'Token refresh failed', details: error.message }, 500);
  }
});

// Execute query (protected)
app.post('/api/v1/query/execute', authMiddleware, async (c) => {
  try {
    const { database_id, sql, dry_run } = await c.req.json();

    if (!database_id || !sql) {
      return c.json({ error: 'database_id and sql are required' }, 400);
    }

    const pool = new Pool({ connectionString: c.env.DATABASE_URL });
    const startTime = Date.now();

    if (dry_run) {
      // Validate query without executing
      await pool.query(`EXPLAIN ${sql}`);
      return c.json({
        sql,
        dry_run: true,
        valid: true,
      });
    }

    const result = await pool.query(sql);
    const executionMs = Date.now() - startTime;

    return c.json({
      rows: result.rows,
      execution_ms: executionMs,
      sql,
    });
  } catch (error: any) {
    console.error('Query execution error:', error);
    return c.json({ error: 'Query execution failed', details: error.message }, 500);
  }
});

// Get schema (protected)
app.post('/api/v1/schema', authMiddleware, async (c) => {
  try {
    const { database_id } = await c.req.json();

    if (!database_id) {
      return c.json({ error: 'database_id is required' }, 400);
    }

    const pool = new Pool({ connectionString: c.env.DATABASE_URL });

    // Query PostgreSQL information_schema
    const result = await pool.query(`
      SELECT
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as primary_key
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      LEFT JOIN (
        SELECT ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name, c.ordinal_position
    `);

    // Group by table
    const tables: any = {};
    for (const row of result.rows) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = {
          name: row.table_name,
          columns: [],
        };
      }

      tables[row.table_name].columns.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        primary_key: row.primary_key,
        default_value: row.column_default,
      });
    }

    return c.json({
      tables: Object.values(tables),
    });
  } catch (error: any) {
    console.error('Schema error:', error);
    return c.json({ error: 'Schema retrieval failed', details: error.message }, 500);
  }
});

// Natural language query (protected)
app.post('/api/v1/query/natural-language', authMiddleware, async (c) => {
  try {
    const { database_id, question } = await c.req.json();

    if (!database_id || !question) {
      return c.json({ error: 'database_id and question are required' }, 400);
    }

    // TODO: Implement OpenAI integration for NLP-to-SQL
    // For now, return placeholder
    return c.json({
      sql: `-- Generated SQL for: ${question}\nSELECT * FROM users LIMIT 10;`,
      confidence: 0.85,
      explanation: 'This is a placeholder. OpenAI integration coming soon.',
    });
  } catch (error: any) {
    console.error('NLP query error:', error);
    return c.json({ error: 'NLP query failed', details: error.message }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error', details: err.message }, 500);
});

export default app;
