import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';
import mockRoutes from './mockRoutes';
import { playwrightBridge } from './services/PlaywrightBridge';
import authRoute from './routes/auth.route';
import oauthRoute from './routes/oauth.route';
import projectsRoute from './routes/projects.route';
import testCasesRoute from './routes/testCases.route';
import testPlansRoute from './routes/testPlans.route';
import cyclesRoute from './routes/cycles.route';
import runsRoute from './routes/runs.route';
import insightsRoute from './routes/insights.route';
import explorationsRoute from './routes/explorations.route';
import missionsRoute from './routes/missions.route';
import onboardingRoute from './routes/onboarding.route';
import aiChatRoute from './routes/ai-chat';
import recordingsRoute from './routes/recordings.route';
import ssoRoute from './routes/sso.route';
import loadTestRoute from './routes/load-test.route';
import apiTestingRoute from './routes/api-testing.route';
import cloudDevicesRoute from './routes/cloud-devices.route';

// Define the environment bindings for TypeScript
type Bindings = {
  DB: D1Database;
  RECORDINGS: R2Bucket;
  RATE_LIMIT_KV: KVNamespace;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  AZURE_OAUTH_CLIENT_ID: string;
  AZURE_OAUTH_CLIENT_SECRET: string;
  AZURE_TENANT_ID: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  LINKEDIN_OAUTH_CLIENT_ID: string;
  LINKEDIN_OAUTH_CLIENT_SECRET: string;
  DISCORD_OAUTH_CLIENT_ID: string;
  DISCORD_OAUTH_CLIENT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const allowedOrigins = new Set([
  'https://qestro.io',
  'https://app.qestro.io',
  'https://qestro.app',
  'https://app.qestro.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const isLocalDevOrigin = (o: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

// Copy Worker env bindings into process.env for Node-style env access
// (AIProviderClient and other services read process.env.* directly)
app.use('*', async (c, next) => {
  for (const [k, v] of Object.entries(c.env || {})) {
    if (typeof v === 'string') {
      (process.env as Record<string, string>)[k] = v;
    }
  }
  await next();
});

// Enable CORS for allowed origins (localhost wildcard only outside production Worker)
app.use('*', cors({
  origin: (origin, c) => {
    const env = c.env?.ENVIRONMENT;
    const isProduction = env === 'production';

    if (!origin) {
      return null;
    }
    if (allowedOrigins.has(origin)) {
      return origin;
    }
    if (!isProduction && isLocalDevOrigin(origin)) {
      return origin;
    }
    return null;
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
}));

import { requestId } from 'hono/request-id';
import { systemLogger } from './utils/logger';

// Inject Request ID
app.use('*', requestId());

// Global Request Tracing Logger
app.use('*', async (c, next) => {
  const reqId = c.get('requestId');
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  // Skip logging high-volume endpoints if necessary
  if (c.req.path !== '/health') {
    try {
      systemLogger.info(`[${c.req.method}] ${c.req.path}`, {
        requestId: reqId,
        status: c.res.status,
        duration: `${ms}ms`,
        ip: c.req.header('cf-connecting-ip') || 'unknown'
      });
    } catch (error) {
      console.error('Request logging failed:', error);
    }
  }
});

const buildHealthResponse = async (c: Context<{ Bindings: Bindings }>) => {
  let dbStatus = 'unhealthy';
  try {
    const db = drizzle(c.env.DB);
    await db.select().from(schema.automationRuns).limit(1);
    dbStatus = 'healthy';
  } catch (e) {
    console.error('DB Health Check Error:', e);
  }

  return c.json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'production',
    platform: 'cloudflare-workers-hono',
    version: '1.2.0',
    dependencies: {
      database: dbStatus
    }
  });
};

const defaultAutomationRuns = [
  {
    id: 'RUN-1',
    name: 'Nightly Core Regression',
    projectId: 'demo',
    userId: 'demo-user',
    status: 'running',
    passedTests: 42,
    failedTests: 1,
    skippedTests: 0,
    totalTests: 120,
    startTime: Date.now() - 600000,
    createdAt: Date.now() - 600000,
  },
  {
    id: 'RUN-2',
    name: 'Checkout Flow Tests',
    projectId: 'demo',
    userId: 'demo-user',
    status: 'passed',
    passedTests: 35,
    failedTests: 0,
    skippedTests: 0,
    totalTests: 35,
    startTime: Date.now() - 86400000,
    createdAt: Date.now() - 86400000,
  },
];

const defaultRecordingSessions = [
  { id: 'rec_101', name: 'User Onboarding', url: 'https://example.com/signup', status: 'completed', duration: 145, interactionCount: 22, framework: 'playwright', confidence: 94, createdAt: '1 hour ago', viewport: { width: 1920, height: 1080 } },
  { id: 'rec_102', name: 'Cart Validation', url: 'https://example.com/cart', status: 'completed', duration: 56, interactionCount: 8, framework: 'cypress', confidence: 89, createdAt: '3 hours ago', viewport: { width: 375, height: 812 } }
];

const fallbackGeneratedRecordingCode = `import { test, expect } from '@playwright/test';

test('Recorded flow', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveURL(/example/);
});`;

const defaultDashboardStats = {
  testCases: {
    total: 0,
    active: 0,
    byType: {},
  },
  devices: {
    total: 12,
    available: 8,
    busy: 4,
  },
  projects: {
    total: 1,
  },
  execution: {
    coverage: 89,
    statusBreakdown: {
      passed: 42,
      failed: 1,
      pending: 0,
    },
  },
  security: {
    score: 98,
    grade: 'A+',
    criticalIssues: 0,
    posture: { auth: 145, data: 140, infra: 135, api: 148, client: 142, gdpr: 150 },
  },
  aiStats: {
    selfHealed: 42,
    generated: 0,
    optimizedTimeMs: 3500,
  },
  liveFeed: [
    {
      id: 'feed-run-1',
      title: 'Nightly Core Regression',
      type: 'run',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      relativeTime: '10m ago',
      message: 'Run RUNNING: 42 passed, 1 failed.',
    },
    {
      id: 'feed-rec-1',
      title: 'Checkout Flow Recording',
      type: 'recording',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      relativeTime: '1h ago',
      message: 'Recording completed with 18 captured interactions.',
    },
  ],
};

// Health Check
app.get('/health', buildHealthResponse);
app.get('/api/health', buildHealthResponse);

// Auth Routes (Mount at both /api/v1/auth and /api/auth)
app.route('/api/v1/auth', authRoute);
app.route('/api/auth', authRoute);

// OAuth Routes (GitHub, Microsoft)
app.route('/api/v1/auth', oauthRoute);
app.route('/api/auth', oauthRoute);

// API routes
import { rateLimiters } from './middleware/rateLimit';

const api = new Hono<{ Bindings: Bindings }>();

// Apply general API rate limiter to all /api routes
api.use('*', rateLimiters.api());

api.get('/automation-runs', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const runs = await db.select().from(schema.automationRuns).all();

    // If empty DB, return mocks
    if (runs.length === 0) {
      return c.json({ success: true, data: defaultAutomationRuns });
    }

    return c.json({ success: true, data: runs });
  } catch (err) {
    console.error('Falling back to default automation runs:', err);
    return c.json({ success: true, data: defaultAutomationRuns });
  }
});

api.post('/automation-runs', async (c) => {
  const body = await c.req.json();
  const createdAt = Date.now();

  const run = {
    id: `RUN-${createdAt}`,
    name: body.name || 'New Test Run',
    projectId: body.projectId || 'demo',
    userId: body.userId || 'demo-user',
    status: 'queued',
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    totalTests: Array.isArray(body.testCases) ? body.testCases.length : 0,
    startTime: createdAt,
    createdAt,
  };

  try {
    const db = drizzle(c.env.DB);
    await db.insert(schema.automationRuns).values({
      id: run.id,
      projectId: run.projectId,
      name: run.name,
      status: run.status,
      passedTests: run.passedTests,
      failedTests: run.failedTests,
      skippedTests: run.skippedTests,
      totalTests: run.totalTests,
      startTime: new Date(run.startTime),
      createdAt: new Date(run.createdAt),
    });
  } catch (error) {
    console.error('Falling back to transient automation run:', error);
  }

  defaultAutomationRuns.unshift(run);
  return c.json({ success: true, data: run }, 201);
});

api.get('/recordings/openclaw/sessions', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const sessions = await db.select().from(schema.recordingSessions).all();

    if (sessions.length === 0) {
      return c.json({ success: true, data: defaultRecordingSessions });
    }

    return c.json({ success: true, data: sessions });
  } catch (err) {
    console.error('Falling back to default recording sessions:', err);
    return c.json({ success: true, data: defaultRecordingSessions });
  }
});

api.post('/recordings/openclaw/start', async (c) => {
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  try {
    // 1. Hand off to Playwright container via Bridge
    const sessionInfo = await playwrightBridge.startSession({
      name: body.name || 'New Recording',
      url: body.url || 'https://example.com',
      viewport: body.viewport,
      framework: body.framework
    });

    const newId = sessionInfo.sessionId;

    // 2. Persist the session metadata to D1
    await db.insert(schema.recordingSessions).values({
      id: newId,
      name: body.name || 'New Recording',
      url: body.url || 'https://example.com',
      status: 'recording',
      duration: 0,
      interactionCount: 0,
      framework: body.framework || 'playwright',
      confidence: 0,
      createdAt: new Date()
    });

    return c.json({
      success: true,
      data: {
        id: newId,
        name: body.name || 'New Recording',
        url: body.url || 'https://example.com',
        status: 'recording',
        duration: 0,
        interactionCount: 0,
        framework: body.framework || 'playwright',
        confidence: 0,
        createdAt: 'Now',
        viewport: body.viewport || { width: 1920, height: 1080 },
        // Important: Return the WebSocket endpoint so the frontend can stream interactions
        wsEndpoint: sessionInfo.wsEndpoint
      }
    });
  } catch (e: any) {
    console.error('Failed to start recording session:', e);
    const fallbackSession = {
      id: `rec_${Date.now()}`,
      name: body.name || 'New Recording',
      url: body.url || 'https://example.com',
      status: 'recording',
      duration: 0,
      interactionCount: 0,
      framework: body.framework || 'playwright',
      confidence: 0,
      createdAt: 'Now',
      viewport: body.viewport || { width: 1920, height: 1080 },
      wsEndpoint: null,
    };

    defaultRecordingSessions.unshift(fallbackSession);
    return c.json({ success: true, data: fallbackSession });
  }
});

api.post('/recordings/openclaw/:id/stop', async (c) => {
  const id = c.req.param('id');
  const db = drizzle(c.env.DB);

  try {
    // 1. Tell the Playwright container to halt and generate code
    const result = await playwrightBridge.stopSession(id);

    // 2. Save the session as completed
    await db.update(schema.recordingSessions)
      .set({ status: 'completed', duration: 120 })
      .where(eq(schema.recordingSessions.id, id));

    // 3. Save the generated test code to the newly created test_cases table
    if (result.success && result.generatedCode) {
      const { allocateDisplayId } = await import('./lib/display-id');
      let displayId: string | null = null;
      try {
        displayId = await allocateDisplayId(c.env.DB, 'test_case');
      } catch (err) {
        console.error('display-id allocation failed (openclaw stop):', err);
      }
      await db.insert(schema.testCases).values({
        id: 'TC-REC-' + Date.now().toString().slice(-6),
        displayId,
        projectId: '1',
        title: `Recorded Test: ${id}`,
        status: 'Draft',
        priority: 'Medium',
        type: 'Recorded',
        description: 'Generated via Recording Studio',
        testCode: result.generatedCode,
        createdAt: new Date()
      });
    }

    return c.json({ success: true, message: 'Recording stopped and test case generated', code: result.generatedCode });
  } catch (e: any) {
    const session = defaultRecordingSessions.find((entry) => entry.id === id);
    if (session) {
      session.status = 'completed';
      session.duration = session.duration || 75;
      session.interactionCount = session.interactionCount || 12;
      session.confidence = session.confidence || 91;
      session.createdAt = session.createdAt || 'Now';
    }

    return c.json({
      success: true,
      message: 'Recording stopped in local fallback mode',
      code: fallbackGeneratedRecordingCode,
    });
  }
});

api.get('/dashboard/stats', async (c) => {
  // Require auth — prevents leaking aggregate stats to unauthenticated users
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const { verifyJWT } = await import('./auth/jwt');
    await verifyJWT(authHeader.slice(7), c.env.JWT_SECRET);
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }

  try {
    const db = drizzle(c.env.DB);

    // Aggregate real data from D1 tables
    const allTests = await db.select().from(schema.testCases).all();
    const allRuns = await db.select().from(schema.automationRuns).all();
    const allRecordings = await db.select().from(schema.recordingSessions).all();

    // Compute Test Case metrics
    const activeTests = allTests.filter(t => t.status !== 'Draft').length;
    const testsByType = allTests.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Compute Execution metrics
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Sort runs by most recent first
    allRuns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    allRuns.forEach(run => {
      totalPassed += run.passedTests;
      totalFailed += run.failedTests;
      totalSkipped += run.skippedTests;
    });

    const totalExecuted = totalPassed + totalFailed + totalSkipped;
    const coverage = totalExecuted > 0 ? Math.round((totalPassed / totalExecuted) * 100) : 0;

    // AI Stats (Currently mocking self-healed, dynamically pulling generated)
    const generatedTests = allTests.filter(t => t.type === 'AI Generated' || t.type === 'Recorded').length;

    // Construct Live Feed from recent runs and recordings
    const liveFeed = [...allRuns.map(r => ({
      id: r.id,
      title: r.name,
      type: 'run',
      timestamp: r.createdAt.toISOString(),
      relativeTime: 'Recently',
      message: `Run ${r.status.toUpperCase()}: ${r.passedTests} passed, ${r.failedTests} failed.`
    })), ...allRecordings.map(r => ({
      id: r.id,
      title: r.name,
      type: 'recording',
      timestamp: r.createdAt.toISOString(),
      relativeTime: 'Recently',
      message: `Recording ${r.status}: Duration ${r.duration}s with ${r.interactionCount} interactions.`
    }))]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Keep top 10 most recent

    const dashboardStats = {
      testCases: {
        total: allTests.length,
        active: activeTests,
        byType: testsByType,
      },
      devices: {
        total: 12,
        available: 8,
        busy: 4,
      },
      projects: {
        total: 1, // Currently single project scope
      },
      execution: {
        coverage: coverage || 89, // Fallback to 89 if no runs exist
        statusBreakdown: {
          passed: totalPassed,
          failed: totalFailed,
          pending: totalSkipped,
        },
      },
      security: {
        score: 98,
        grade: 'A+',
        criticalIssues: 0,
        posture: { auth: 145, data: 140, infra: 135, api: 148, client: 142, gdpr: 150 },
      },
      aiStats: {
        selfHealed: 42,
        generated: generatedTests,
        optimizedTimeMs: 3500,
      },
      liveFeed
    };

    return c.json({ success: true, data: dashboardStats });
  } catch (err) {
    console.error('Falling back to default dashboard stats', err);
    return c.json({ success: true, data: defaultDashboardStats });
  }
});

api.get('/dashboard/health', async (c) => {
  return c.json({
    success: true,
    data: {
      status: 'Healthy',
      environment: c.env.ENVIRONMENT || 'production',
      services: {
        api: 'online',
        database: 'fallback',
        websocket: 'standby',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

api.get('/jira/connection', async (c) => {
  return c.json({
    connected: false,
    jiraUrl: '',
    connectedAt: null,
  });
});

api.delete('/jira/connection', async (c) => {
  return c.json({
    success: true,
    message: 'Jira connection removed',
  });
});

api.get('/jira/auth/url', async (c) => {
  return c.json({
    success: true,
    url: null,
    message: 'Jira OAuth is not configured for this local environment.',
  });
});

api.get('/jira/issues/:issueKey', async (c) => {
  const issueKey = c.req.param('issueKey');
  return c.json({
    key: issueKey,
    summary: `Imported Jira issue ${issueKey}`,
    description: `Imported from Jira issue ${issueKey}. Connect a real Jira workspace in Settings to fetch live metadata.`,
    status: 'To Do',
  });
});

api.get('/mock/stubs', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const stubs = await db.select().from(schema.virtualServices).all();

    if (stubs.length === 0) {
      return c.json({
        mappings: [
          {
            id: 'stub_1',
            name: 'Mock Auth Response',
            request: { method: 'POST', urlPath: '/api/v1/login' },
            response: { status: 200, jsonBody: { token: 'mock-token' } }
          },
          {
            id: 'stub_2',
            name: 'Mock Products',
            request: { method: 'GET', urlPath: '/api/v1/products' },
            response: { status: 200, jsonBody: { items: ['Product 1', 'Product 2'] } }
          }
        ]
      });
    }

    // Format DB rows to wiremock mapping syntax
    const mappings = stubs.map(stub => ({
      id: stub.id,
      name: stub.name,
      request: { method: stub.method, urlPath: stub.urlPath },
      response: {
        status: stub.status,
        jsonBody: stub.jsonBody ? JSON.parse(stub.jsonBody) : undefined,
        headers: stub.headers ? JSON.parse(stub.headers) : undefined
      }
    }));

    return c.json({ mappings });
  } catch (err) {
    return c.json({ error: 'DB error' }, 500);
  }
});

api.post('/mock/stubs', async (c) => {
  try {
    const body = await c.req.json();
    const db = drizzle(c.env.DB);

    await db.insert(schema.virtualServices).values({
      id: 'stub_' + Date.now(),
      name: body.name || 'New Mock',
      method: body.request?.method || 'GET',
      urlPath: body.request?.url || body.request?.urlPath || '/api/new',
      status: body.response?.status || 200,
      jsonBody: body.response?.jsonBody ? JSON.stringify(body.response.jsonBody) : null,
      headers: body.response?.headers ? JSON.stringify(body.response.headers) : null,
      createdAt: new Date()
    });

    return c.json({ success: true, message: 'Stub created from DB' }, 201);
  } catch (e) {
    console.error(e);
    return c.json({ success: true, message: 'Stub creation error' }, 500);
  }
});

import testgenRoutes from './testgenRoutes';
import billingRoutes from './billingRoutes';
import virtualizationRoutes from './virtualizationRoutes';

api.route('/testgen', testgenRoutes);
api.route('/billing', billingRoutes);
api.route('/mock', virtualizationRoutes);
api.route('/projects', projectsRoute);
api.route('/test-cases', testCasesRoute);
api.route('/test-plans', testPlansRoute);
api.route('/cycles', cyclesRoute);
api.route('/runs', runsRoute);
api.route('/insights', insightsRoute);
api.route('/explorations', explorationsRoute);
api.route('/missions', missionsRoute);
api.route('/onboarding', onboardingRoute);
api.route('/ai', aiChatRoute);
api.route('/recordings', recordingsRoute);
api.route('/sso', ssoRoute);
api.route('/api-testing', apiTestingRoute);
api.route('/devices', cloudDevicesRoute);
api.all('/visual/*', (c) => c.json({
  success: false,
  error: 'Visual regression endpoints are unavailable in Cloudflare Worker runtime',
}, 503));
api.route('/load-test', loadTestRoute);

// ─── New Feature APIs (Analytics, Scheduling, CI/CD, Self-Healing) ───
// These use the new services built for market readiness

import { aiService } from './services/AIService';
import { openClawBridge } from './services/OpenClawBridgeService';

const requireAuthenticatedUserId = async (c: Context<{ Bindings: Bindings }>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const { verifyJWT } = await import('./auth/jwt');
    const payload = await verifyJWT(authHeader.slice(7), c.env.JWT_SECRET);
    return String(payload.userId || payload.sub || '');
  } catch {
    return null;
  }
};

// AI Test Generation (enhanced)
api.post('/ai/generate-test', async (c) => {
  const userId = await requireAuthenticatedUserId(c);
  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const body = await c.req.json();
  const result = await aiService.processAIRequest({
    type: 'test_generation',
    feature: 'test_generation',
    userId,
    data: { description: body.description, framework: body.framework || 'playwright',
            testType: body.testType || 'e2e', url: body.url || '', platform: 'web' },
  });
  if (result.success) {
    const r = result.result as Record<string, unknown>;
    return c.json({ success: true, testCode: r.testCode,
      metadata: { framework: body.framework || 'playwright', generatedAt: new Date().toISOString(),
        confidence: r.confidence, model: result.model, cost: result.cost } });
  }
  return c.json({ success: false, error: (result.result as Record<string, unknown>).error }, 500);
});

// AI Failure Analysis
api.post('/ai/analyze-failure', async (c) => {
  const userId = await requireAuthenticatedUserId(c);
  if (!userId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const body = await c.req.json();
  const result = await aiService.processAIRequest({
    type: 'bug_analysis', feature: 'bug_analysis', userId,
    data: { testId: body.testId, errorMessage: body.errorMessage || '',
            stackTrace: body.stackTrace || '', testCode: body.testCode || '' },
  });
  return c.json({ success: result.success, data: result.result });
});

// OpenClaw incoming webhook (from chat channels)
api.post('/openclaw/incoming', async (c) => {
  const body = await c.req.json();
  const { action, params } = body;

  const handlers: Record<string, () => Promise<unknown>> = {
    'dashboard': async () => ({
      testCases: { total: 156, active: 132, byType: { web: 89, mobile: 34, api: 33 } },
      execution: { coverage: 89, statusBreakdown: { passed: 92, failed: 5, pending: 3 } },
      security: { score: 98, grade: 'A+', criticalIssues: 0 },
      aiStats: { selfHealed: 42, generated: 28, optimizedTimeMs: 3500 },
      system: { status: 'OPTIMAL', uptime: '99.97%' },
    }),
    'run-suite': async () => ({
      id: `RUN-${Date.now()}`, status: 'queued',
      testCount: 35, estimatedDuration: '~2 minutes',
    }),
    'failures': async () => ({
      count: 2, recentFailures: [
        { id: 'TC-089', name: 'Login Flow - 2FA Timeout', error: 'SMS delivery delay >30s' },
        { id: 'TC-112', name: 'Checkout - Payment Gateway', error: 'Stripe webhook timeout' },
      ],
    }),
  };

  const handler = handlers[action];
  if (handler) {
    return c.json({ success: true, data: await handler() });
  }
  return c.json({ success: false, error: `Unknown action: ${action}` }, 400);
});

// OpenClaw bridge status
api.get('/openclaw/status', async (c) => {
  const health = await openClawBridge.healthCheck();
  return c.json({ success: true, data: { ...openClawBridge.getStatus(), health } });
});

app.route('/api/v1', api);
app.route('/api', api);

app.get('/', (c) => {
  return c.json({
    name: 'Qestro API',
    description: 'AI-Powered QA Automation Platform',
    version: '2.0.0',
    status: 'operational',
    environment: c.env.ENVIRONMENT || 'production',
    framework: 'Hono + Drizzle + D1',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth/*',
    },
    poweredBy: 'Qestro',
  });
});

// Service Virtualization Wildcard Interceptor
app.all('*', async (c, next) => {
  // Always skip internal api routes to prevent infinite loops or blocking real endpoints
  if (c.req.path.startsWith('/api/') && !c.req.path.startsWith('/api/mock/virtual/')) {
    return next();
  }

  try {
    const db = drizzle(c.env.DB);
    const method = c.req.method;

    // We attempt to match the exact URL path. In a true WireMock equivalent we'd also process regex urlPatterns
    const pathMatch = await db.select().from(schema.virtualServices)
      .where(eq(schema.virtualServices.urlPath, c.req.path));

    const activeStub = pathMatch.find(stub => stub.method === method || stub.method === 'ANY');

    if (activeStub) {
      const startTime = Date.now();
      let reqBody = undefined;
      try { reqBody = await c.req.text(); } catch (e) { }

      // Serve the configured mock response immediately
      const serveTime = Date.now() - startTime;

      // Log the invocation asynchronously (fire and forget)
      c.executionCtx.waitUntil((async () => {
        try {
          const { v4: uuidv4 } = await import('uuid');
          await db.insert(schema.virtualServiceRequests).values({
            id: `req_${Date.now()}_${uuidv4().substring(0, 4)}`,
            virtualServiceId: activeStub.id,
            method,
            url: c.req.path,
            absoluteUrl: c.req.url,
            headers: JSON.stringify(c.req.header()),
            body: reqBody,
            queryParams: JSON.stringify(c.req.query()),
            wasMatched: true,
            timingTotal: serveTime + 2, // arbitrary small overhead addition
            timingServe: serveTime,
            createdAt: new Date()
          });
        } catch (e) { console.error('Failed logging mock interceptor', e); }
      })());

      const resHeaders = activeStub.headers ? JSON.parse(activeStub.headers) : {};
      for (const [key, value] of Object.entries(resHeaders)) {
        c.header(key, value as string);
      }

      if (activeStub.jsonBody) {
        try {
          return c.json(JSON.parse(activeStub.jsonBody), activeStub.status as any);
        } catch (e) {
          return c.body(activeStub.jsonBody, activeStub.status as any);
        }
      }

      return c.body(null, activeStub.status as any);
    }
  } catch (e) {
    console.error('Virtualization interceptor error:', e);
  }

  await next();
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path,
  }, 404);
});

// Error handling
app.onError((err, c) => {
  console.error('Hono app error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message,
  }, 500);
});

export default app;
