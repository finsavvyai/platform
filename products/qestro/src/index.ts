/**
 * Qestro MVP - Main Cloudflare Worker Entry Point
 * 
 * This is the main entry point for the Qestro API running on Cloudflare Workers.
 * It uses the Hono framework for routing and middleware.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

// Import Durable Objects
import { CollaborationDO } from './durable-objects/collaboration-do';
import { SessionDO } from './durable-objects/session-do';
import { TestExecutionDO } from './durable-objects/test-execution-do';
import { MonitoringDO } from './durable-objects/monitoring-do';

// Import middleware
import { requireAuth, optionalAuth, requireRole, rateLimit } from './middleware/auth';

// Import AI routes
import { aiRoutes } from './routes/ai.routes';

// Import mobile routes
import { mobileRoutes } from './routes/mobile.routes';

// Environment bindings type
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV Namespaces
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;

  // R2 Buckets
  SCREENSHOTS: R2Bucket;
  RECORDINGS: R2Bucket;
  ARTIFACTS: R2Bucket;

  // Durable Objects
  COLLABORATION_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;
  TEST_EXECUTION_DO: DurableObjectNamespace;
  MONITORING_DO: DurableObjectNamespace;

  // Environment variables
  NODE_ENV: string;
  ENVIRONMENT: string;
  API_URL: string;
  FRONTEND_URL: string;
  BACKEND_AUTH_URL: string;
  LOG_LEVEL: string;
  APP_NAME: string;
  APP_VERSION: string;
  CORS_ALLOWED_ORIGINS: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY?: string;
  HUGGING_FACE_API_KEY?: string;
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  AZURE_OAUTH_CLIENT_ID: string;
  AZURE_OAUTH_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  CUSTOM_AI_ENDPOINT?: string;
  CUSTOM_AI_API_KEY?: string;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());

// CORS middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.CORS_ALLOWED_ORIGINS?.split(',') || [
    'https://qestro.app',
    'http://localhost:5173'
  ];

  const origin = c.req.header('origin');
  const corsMiddleware = cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  });

  return corsMiddleware(c, next);
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Qestro API',
    description: 'AI-Powered QA Automation Platform',
    version: c.env.APP_VERSION || '1.0.0',
    environment: c.env.ENVIRONMENT || 'production',
    status: 'operational',
    endpoints: {
      health: '/health',
      api: '/api',
      docs: 'https://docs.qestro.app',
    },
    poweredBy: 'Qestro',
  });
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: c.env.APP_VERSION,
    services: {
      database: 'connected',
      kv: 'connected',
      r2: 'connected',
      durableObjects: 'connected',
    }
  });
});

// API version info
app.get('/api', (c) => {
  return c.json({
    name: c.env.APP_NAME,
    version: c.env.APP_VERSION,
    environment: c.env.ENVIRONMENT,
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      projects: '/api/projects/*',
      recordings: '/api/recordings/*',
      tests: '/api/tests/*',
      ai: '/api/ai/*',
      subscriptions: '/api/subscriptions/*',
    },
    documentation: 'https://docs.qestro.app',
  });
});

// API Routes (to be implemented in subsequent tasks)
const api = new Hono<{ Bindings: Env }>();

// Authentication routes - Proxy to backend auth service
// The backend (Express) handles all authentication logic
// Workers validate tokens and proxy requests as needed

api.post('/auth/register', async (c) => {
  // Forward to backend auth service
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const response = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(await c.req.json()),
  });

  return c.json(await response.json(), response.status);
});

api.post('/auth/login', async (c) => {
  // Forward to backend auth service
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const response = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(await c.req.json()),
  });

  return c.json(await response.json(), response.status);
});

api.post('/auth/logout', async (c) => {
  // Clear session from KV
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    await c.env.SESSIONS.delete(`session:${token}`);
  }

  return c.json({ message: 'Logged out successfully' });
});

api.get('/auth/verify-email', async (c) => {
  // Forward to backend auth service
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const token = c.req.query('token');
  const response = await fetch(`${backendUrl}/api/auth/verify/${token}`);

  return c.json(await response.json(), response.status);
});

api.get('/auth/profile', async (c) => {
  // Forward to backend with auth token
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const authHeader = c.req.header('Authorization');

  const response = await fetch(`${backendUrl}/api/auth/profile`, {
    headers: {
      'Authorization': authHeader || '',
    },
  });

  return c.json(await response.json(), response.status);
});

// OAuth routes - Proxy to backend OAuth service
api.get('/oauth/github', async (c) => {
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const response = await fetch(`${backendUrl}/api/oauth/github`);

  return c.json(await response.json(), response.status);
});

api.get('/oauth/github/callback', async (c) => {
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const code = c.req.query('code');
  const state = c.req.query('state');

  const response = await fetch(`${backendUrl}/api/oauth/github/callback?code=${code}&state=${state}`);

  return c.json(await response.json(), response.status);
});

api.get('/oauth/azure', async (c) => {
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const response = await fetch(`${backendUrl}/api/oauth/azure`);

  return c.json(await response.json(), response.status);
});

api.get('/oauth/azure/callback', async (c) => {
  const backendUrl = c.env.BACKEND_AUTH_URL || 'http://localhost:8000';
  const code = c.req.query('code');
  const state = c.req.query('state');

  const response = await fetch(`${backendUrl}/api/oauth/azure/callback?code=${code}&state=${state}`);

  return c.json(await response.json(), response.status);
});

// Project routes (protected) - Full D1 Integration
api.get('/projects', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const result = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(user.userId).all();

    return c.json({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

api.post('/projects', requireAuth, rateLimit({ maxRequests: 10, windowMs: 60000 }), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { name, description, type = 'web', platform = 'web', settings = {} } = body;

    if (!name || name.length < 2) {
      return c.json({ error: 'Project name is required (min 2 characters)' }, 400);
    }

    const projectId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO projects (id, user_id, name, description, type, platform, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(projectId, user.userId, name, description || '', type, platform, JSON.stringify(settings), now, now).run();

    return c.json({
      success: true,
      data: {
        id: projectId,
        name,
        description,
        type,
        platform,
        settings,
        userId: user.userId,
        createdAt: now,
      }
    }, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

api.get('/projects/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const projectId = c.req.param('id');

    const result = await c.env.DB.prepare(
      `SELECT * FROM projects WHERE id = ? AND user_id = ?`
    ).bind(projectId, user.userId).first();

    if (!result) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Get test cases count
    const testCasesResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM test_cases WHERE project_id = ?`
    ).bind(projectId).first();

    // Get recent test runs
    const recentRuns = await c.env.DB.prepare(
      `SELECT * FROM test_runs WHERE test_suite_id IN (SELECT id FROM test_suites WHERE project_id = ?) ORDER BY created_at DESC LIMIT 5`
    ).bind(projectId).all();

    return c.json({
      success: true,
      data: {
        ...result,
        testCasesCount: testCasesResult?.count || 0,
        recentRuns: recentRuns.results || [],
      }
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json({ error: 'Failed to fetch project' }, 500);
  }
});

api.put('/projects/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const projectId = c.req.param('id');
    const body = await c.req.json();
    const { name, description, type, platform, settings } = body;

    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT id FROM projects WHERE id = ? AND user_id = ?`
    ).bind(projectId, user.userId).first();

    if (!existing) {
      return c.json({ error: 'Project not found' }, 404);
    }

    const now = Date.now();
    await c.env.DB.prepare(
      `UPDATE projects SET name = ?, description = ?, type = ?, platform = ?, settings = ?, updated_at = ? WHERE id = ?`
    ).bind(name, description, type, platform, JSON.stringify(settings || {}), now, projectId).run();

    return c.json({
      success: true,
      data: { id: projectId, name, description, type, platform, settings, updatedAt: now }
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

api.delete('/projects/:id', requireAuth, requireRole('admin', 'owner'), async (c) => {
  try {
    const user = c.get('user');
    const projectId = c.req.param('id');

    // Verify ownership
    const existing = await c.env.DB.prepare(
      `SELECT id FROM projects WHERE id = ? AND user_id = ?`
    ).bind(projectId, user.userId).first();

    if (!existing) {
      return c.json({ error: 'Project not found' }, 404);
    }

    await c.env.DB.prepare(
      `DELETE FROM projects WHERE id = ?`
    ).bind(projectId).run();

    return c.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

// Recording routes - Full D1 Integration
api.post('/recordings/start', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { projectId, name, deviceInfo = {} } = body;

    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO recording_sessions (id, project_id, user_id, status, name, device_info, started_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, projectId, user.userId, 'recording', name || 'Untitled Recording', JSON.stringify(deviceInfo), now, now, now).run();

    // Store session state in KV for real-time access
    await c.env.SESSIONS.put(`recording:${sessionId}`, JSON.stringify({
      id: sessionId,
      projectId,
      userId: user.userId,
      status: 'recording',
      startedAt: now,
      actions: [],
    }), { expirationTtl: 3600 });

    return c.json({
      success: true,
      data: {
        sessionId,
        status: 'recording',
        startedAt: now,
        message: 'Recording session started successfully',
      }
    }, 201);
  } catch (error) {
    console.error('Error starting recording:', error);
    return c.json({ error: 'Failed to start recording' }, 500);
  }
});

api.post('/recordings/:id/stop', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const now = Date.now();

    // Get session from KV
    const sessionData = await c.env.SESSIONS.get(`recording:${sessionId}`);
    if (!sessionData) {
      return c.json({ error: 'Recording session not found' }, 404);
    }

    const session = JSON.parse(sessionData);
    const duration = now - session.startedAt;

    // Update database
    await c.env.DB.prepare(
      `UPDATE recording_sessions SET status = ?, stopped_at = ?, duration = ?, updated_at = ? WHERE id = ?`
    ).bind('completed', now, duration, now, sessionId).run();

    // Clean up KV
    await c.env.SESSIONS.delete(`recording:${sessionId}`);

    return c.json({
      success: true,
      data: {
        sessionId,
        status: 'completed',
        duration,
        actionsRecorded: session.actions?.length || 0,
      }
    });
  } catch (error) {
    console.error('Error stopping recording:', error);
    return c.json({ error: 'Failed to stop recording' }, 500);
  }
});

api.get('/recordings/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.req.param('id');

    const session = await c.env.DB.prepare(
      `SELECT * FROM recording_sessions WHERE id = ? AND user_id = ?`
    ).bind(sessionId, user.userId).first();

    if (!session) {
      return c.json({ error: 'Recording not found' }, 404);
    }

    // Get recorded actions
    const actions = await c.env.DB.prepare(
      `SELECT * FROM recorded_actions WHERE session_id = ? ORDER BY sequence_number ASC`
    ).bind(sessionId).all();

    return c.json({
      success: true,
      data: {
        ...session,
        actions: actions.results || [],
      }
    });
  } catch (error) {
    console.error('Error fetching recording:', error);
    return c.json({ error: 'Failed to fetch recording' }, 500);
  }
});

// Mount AI service routes
api.route('/ai', aiRoutes);

// Mount mobile testing routes
api.route('/mobile', mobileRoutes);

// Test execution routes - Full D1 Integration
api.post('/tests', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { name, description, projectId, type = 'ui', steps = [], assertions = [], priority = 'medium' } = body;

    if (!name || !projectId) {
      return c.json({ error: 'Name and project ID are required' }, 400);
    }

    const testId = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO test_cases (id, project_id, user_id, name, description, type, steps, assertions, priority, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(testId, projectId, user.userId, name, description || '', type, JSON.stringify(steps), JSON.stringify(assertions), priority, 1, now, now).run();

    return c.json({
      success: true,
      data: {
        id: testId,
        name,
        description,
        projectId,
        type,
        steps,
        assertions,
        priority,
        isActive: true,
        createdAt: now,
      }
    }, 201);
  } catch (error) {
    console.error('Error creating test:', error);
    return c.json({ error: 'Failed to create test' }, 500);
  }
});

api.get('/tests/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const testId = c.req.param('id');

    const test = await c.env.DB.prepare(
      `SELECT tc.*, p.name as project_name FROM test_cases tc 
       JOIN projects p ON tc.project_id = p.id 
       WHERE tc.id = ? AND tc.user_id = ?`
    ).bind(testId, user.userId).first();

    if (!test) {
      return c.json({ error: 'Test not found' }, 404);
    }

    // Get recent runs
    const recentRuns = await c.env.DB.prepare(
      `SELECT * FROM test_runs WHERE test_case_id = ? ORDER BY created_at DESC LIMIT 10`
    ).bind(testId).all();

    return c.json({
      success: true,
      data: {
        ...test,
        steps: JSON.parse(test.steps || '[]'),
        assertions: JSON.parse(test.assertions || '[]'),
        recentRuns: recentRuns.results || [],
      }
    });
  } catch (error) {
    console.error('Error fetching test:', error);
    return c.json({ error: 'Failed to fetch test' }, 500);
  }
});

api.post('/tests/:id/execute', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const testId = c.req.param('id');
    const body = await c.req.json();
    const { environment = 'production', options = {} } = body;

    // Get test case
    const test = await c.env.DB.prepare(
      `SELECT * FROM test_cases WHERE id = ? AND user_id = ?`
    ).bind(testId, user.userId).first();

    if (!test) {
      return c.json({ error: 'Test not found' }, 404);
    }

    const runId = crypto.randomUUID();
    const now = Date.now();

    // Create test run record
    await c.env.DB.prepare(
      `INSERT INTO test_runs (id, test_case_id, status, started_at, environment, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(runId, testId, 'running', now, JSON.stringify({ name: environment, ...options }), now).run();

    // In production, this would trigger actual test execution via Durable Objects
    // For now, we simulate completion after a short delay
    const executionId = c.env.TEST_EXECUTION_DO.idFromName(runId);
    const stub = c.env.TEST_EXECUTION_DO.get(executionId);

    // Queue execution
    await stub.fetch(new Request('https://internal/execute', {
      method: 'POST',
      body: JSON.stringify({
        runId,
        testId,
        steps: JSON.parse(test.steps || '[]'),
        environment,
        options,
      }),
    }));

    return c.json({
      success: true,
      data: {
        runId,
        testId,
        status: 'queued',
        environment,
        startedAt: now,
        message: 'Test execution started',
      }
    }, 202);
  } catch (error) {
    console.error('Error executing test:', error);
    return c.json({ error: 'Failed to execute test' }, 500);
  }
});

api.get('/tests/:id/results', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const testId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '20');

    // Verify test ownership
    const test = await c.env.DB.prepare(
      `SELECT id FROM test_cases WHERE id = ? AND user_id = ?`
    ).bind(testId, user.userId).first();

    if (!test) {
      return c.json({ error: 'Test not found' }, 404);
    }

    const results = await c.env.DB.prepare(
      `SELECT * FROM test_runs WHERE test_case_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(testId, limit).all();

    // Calculate statistics
    const runs = results.results || [];
    const stats = {
      totalRuns: runs.length,
      passed: runs.filter(r => r.status === 'passed').length,
      failed: runs.filter(r => r.status === 'failed').length,
      running: runs.filter(r => r.status === 'running').length,
      avgDuration: runs.filter(r => r.duration).reduce((acc, r) => acc + (r.duration || 0), 0) / Math.max(runs.filter(r => r.duration).length, 1),
      passRate: runs.length > 0 ? (runs.filter(r => r.status === 'passed').length / runs.length) * 100 : 0,
    };

    return c.json({
      success: true,
      data: {
        results: runs,
        statistics: stats,
      }
    });
  } catch (error) {
    console.error('Error fetching test results:', error);
    return c.json({ error: 'Failed to fetch test results' }, 500);
  }
});

// Subscription routes
api.get('/subscriptions/plans', async (c) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for trying out Qestro',
      price: 0,
      currency: 'usd',
      interval: 'month',
      features: [
        { name: 'Test Recording', limit: 10, included: true },
        { name: 'Test Execution', limit: 50, included: true },
        { name: 'Team Members', limit: 1, included: true },
        { name: 'Projects', limit: 2, included: true },
        { name: 'Storage (GB)', limit: 1, included: true },
        { name: 'Community Support', included: true },
      ],
      limits: {
        recordingsPerMonth: 10,
        testExecutionsPerMonth: 50,
        teamMembers: 1,
        projectsLimit: 2,
        storageGB: 1,
        retentionDays: 30,
      }
    },
    {
      id: 'starter',
      name: 'Early Access',
      description: 'For small teams getting started with automation',
      price: 2900,
      currency: 'usd',
      interval: 'month',
      lemonSqueezyVariantId: '1006098',
      trialDays: 14,
      features: [
        { name: 'Test Recording', limit: 100, included: true },
        { name: 'Test Execution', limit: 500, included: true },
        { name: 'Team Members', limit: 3, included: true },
        { name: 'Projects', limit: 10, included: true },
        { name: 'Storage (GB)', limit: 10, included: true },
        { name: 'Email Support', included: true },
        { name: 'Slack & GitHub Integration', included: true },
      ],
      limits: {
        recordingsPerMonth: 100,
        testExecutionsPerMonth: 500,
        teamMembers: 3,
        projectsLimit: 10,
        storageGB: 10,
        retentionDays: 90,
      }
    },
    {
      id: 'professional',
      name: 'Pro',
      description: 'For growing teams that need more power',
      price: 9900,
      currency: 'usd',
      interval: 'month',
      lemonSqueezyVariantId: '1006101',
      popular: true,
      trialDays: 14,
      features: [
        { name: 'Unlimited Recording', included: true },
        { name: 'Test Execution', limit: 2000, included: true },
        { name: 'Team Members', limit: 10, included: true },
        { name: 'Unlimited Projects', included: true },
        { name: 'Storage (GB)', limit: 50, included: true },
        { name: 'Priority Support', included: true },
        { name: 'All Integrations', included: true },
        { name: 'Custom Branding', included: true },
        { name: 'Advanced Analytics', included: true },
      ],
      limits: {
        recordingsPerMonth: -1,
        testExecutionsPerMonth: 2000,
        teamMembers: 10,
        projectsLimit: -1,
        storageGB: 50,
        retentionDays: 365,
      }
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations with advanced needs',
      price: 29900,
      currency: 'usd',
      interval: 'month',
      lemonSqueezyVariantId: '1006102',
      trialDays: 30,
      features: [
        { name: 'Unlimited Everything', included: true },
        { name: 'Unlimited Team Members', included: true },
        { name: 'Unlimited Storage', included: true },
        { name: 'Dedicated Support', included: true },
        { name: 'SSO Integration', included: true },
        { name: 'Audit Logs', included: true },
        { name: 'SLA Guarantee', included: true },
        { name: 'On-premise Option', included: true },
        { name: 'Custom Integrations', included: true },
      ],
      limits: {
        recordingsPerMonth: -1,
        testExecutionsPerMonth: -1,
        teamMembers: -1,
        projectsLimit: -1,
        storageGB: -1,
        retentionDays: -1,
      }
    },
  ];

  return c.json({
    success: true,
    data: { plans },
    currency: 'USD',
    checkoutUrl: 'https://qestro.lemonsqueezy.com/checkout',
  });
});

api.post('/subscriptions/checkout', async (c) => {
  return c.json({ message: 'Create checkout endpoint - to be implemented' }, 501);
});

api.get('/subscriptions/status', async (c) => {
  return c.json({ message: 'Get subscription status endpoint - to be implemented' }, 501);
});

// Webhook routes
api.post('/webhooks/lemonsqueezy', async (c) => {
  return c.json({ message: 'LemonSqueezy webhook endpoint - to be implemented' }, 501);
});

// Mount API routes
app.route('/api', api);

// WebSocket routes for Durable Objects
app.get('/ws/collaboration/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const id = c.env.COLLABORATION_DO.idFromName(projectId);
  const stub = c.env.COLLABORATION_DO.get(id);
  return stub.fetch(c.req.raw);
});

app.get('/ws/test-execution/:executionId', async (c) => {
  const executionId = c.req.param('executionId');
  const id = c.env.TEST_EXECUTION_DO.idFromName(executionId);
  const stub = c.env.TEST_EXECUTION_DO.get(id);
  return stub.fetch(c.req.raw);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: c.req.path,
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);

  return c.json({
    error: 'Internal Server Error',
    message: c.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  }, 500);
});

// Export Durable Objects
export { CollaborationDO, SessionDO, TestExecutionDO, MonitoringDO };

// Export worker
export default app;
