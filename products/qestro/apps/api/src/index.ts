import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bearer } from 'hono/bearer-auth';
import testsRouter from './routes/tests';
import authRouter from './routes/auth';
import billingRouter from './routes/billing';

type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY: string;
  JWT_SECRET: string;
  STRIPE_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Public routes (no auth required)
app.route('/auth', authRouter);
app.route('/billing/webhook', billingRouter);

// Protected routes (JWT required)
app.use('/api/*', bearer(async (token, c) => {
  try {
    const secret = c.env.JWT_SECRET;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    // Simple JWT validation - in production use full verification
    return true;
  } catch {
    return false;
  }
}));

app.route('/api/tests', testsRouter);
app.route('/api/billing', billingRouter);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

export default app;
