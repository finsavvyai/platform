/**
 * MCPOverflow Workers API
 * Main entry point for Cloudflare Workers
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { authMiddleware, apiKeyAuth, optionalAuth, type Env } from './middleware/auth';
import { featureFlagsMiddleware } from './middleware/featureflags';
import { connectorsRouter } from './routes/connectors';
import { jobsRouter } from './routes/jobs';
import { usersRouter } from './routes/users';
import { featureFlagsRouter } from './routes/featureflags';
import { mfaRouter } from './routes/mfa';
import { generateRouter } from './routes/generate';
import { enterpriseRouter } from './routes/enterprise';
import { securityHeaders } from './middleware/security_headers';
import { rateLimiter } from './middleware/rate_limiter';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
    origin: '*', // Allow all origins for the generator
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-JWT-Assertion'],
    exposeHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 86400,
}));

// Apply global security headers
app.use('*', securityHeaders);

// Apply optional auth widely to support rate limiting by user
app.use('*', optionalAuth);

// Apply rate limiting
app.use('*', rateLimiter);

// Health check - no auth required
app.get('/api/health', (c) => {
    return c.json({
        status: 'healthy',
        version: '1.0.0',
        environment: c.env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
    });
});

// Public generate endpoint - NO AUTH REQUIRED
app.route('/api/generate', generateRouter);

// Public endpoints - optional auth
app.get('/api/connectors/public', optionalAuth, async (c) => {
    const { limit = '20', offset = '0', search } = c.req.query();

    let query = `
    SELECT c.*, u.display_name as owner_name
    FROM connectors c
    JOIN users u ON c.owner_id = u.id
    WHERE c.is_public = 1
  `;
    const params: string[] = [];

    if (search) {
        query += ` AND (c.name LIKE ? OR c.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.download_count DESC, c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.MCP_DB
        .prepare(query)
        .bind(...params)
        .all();

    return c.json({ connectors: results });
});

// Protected routes - require authentication
app.use('/api/connectors/*', apiKeyAuth);
app.use('/api/jobs/*', apiKeyAuth);
app.use('/api/users/*', authMiddleware);

// Feature flags middleware (available on all routes)
app.use('*', featureFlagsMiddleware);

// Mount routers
app.route('/api/connectors', connectorsRouter);
app.route('/api/jobs', jobsRouter);
app.route('/api/users', usersRouter);
app.route('/api/features', featureFlagsRouter);
app.use('/api/mfa/*', authMiddleware);
app.route('/api/mfa', mfaRouter);
app.route('/api/enterprise', enterpriseRouter);

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not Found', message: 'The requested endpoint does not exist' }, 404);
});

// Error handler
app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({
        error: 'Internal Server Error',
        message: c.env.ENVIRONMENT === 'development' ? err.message : 'An unexpected error occurred',
    }, 500);
});

export default app;
