import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Security & Parsing Middleware ───
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const configuredOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || [];
const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
  FRONTEND_URL,
]);
const isLocalDev = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || isDev || isLocalDev(origin!) || allowedOrigins.has(origin!)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID injection
app.use((req: any, res, next) => {
  req.id = (req.headers['x-request-id'] as string) || uuidv4();
  res.set('X-Request-ID', req.id);
  next();
});

app.use(morgan(isDev ? 'dev' : 'combined'));

// ─── Health Check (always available) ───
app.get('/health', async (_req, res) => {
  try {
    const { db } = await import('./lib/db');
    const { sql } = await import('drizzle-orm');
    await (db as any).execute(sql`SELECT 1`);
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0', environment: NODE_ENV, database: 'connected' });
  } catch {
    res.json({ status: 'degraded', timestamp: new Date().toISOString(), version: '1.0.0', environment: NODE_ENV, database: 'disconnected' });
  }
});

// ─── Dynamic Route Mounting ───
// Use dynamic imports so a broken route file doesn't crash the entire server
const routeMap: Array<{ path: string; file: string; exportName?: string }> = [
  // New production routes (named exports)
  { path: '/api/auth', file: './routes/auth.routes', exportName: 'authRouter' },
  { path: '/api/projects', file: './routes/project.routes', exportName: 'projectRouter' },
  { path: '/api/dashboard', file: './routes/dashboard.routes' },
  { path: '/api/test-cases', file: './routes/testCase.routes', exportName: 'testCaseRouter' },
  { path: '/api/test-plans', file: './routes/testPlan.routes', exportName: 'testPlanRouter' },
  { path: '/api/test-runs', file: './routes/testRun.routes', exportName: 'testRunRouter' },
  { path: '/api/analytics', file: './routes/analytics.routes' },
  { path: '/api/automation', file: './routes/automation.routes', exportName: 'automationRouter' },
  { path: '/api/billing', file: './routes/billing.routes' },
  { path: '/api/integrations', file: './routes/integration.routes', exportName: 'integrationRouter' },
  { path: '/api/notifications', file: './routes/notification.routes', exportName: 'notificationRouter' },
  { path: '/api/admin', file: './routes/admin.routes', exportName: 'adminRouter' },
  { path: '/api/health', file: './routes/health.routes', exportName: 'healthRouter' },
  // Sprint 2: Vibe Test Pilot, Visual Regression, Test Recorder
  { path: '/api/vibe-pilot', file: './routes/vibe-pilot.routes' },
  { path: '/api/visual', file: './routes/visual-regression.routes' },
  { path: '/api/recorder', file: './routes/recorder.routes' },
  // Sprint 3: Enterprise (SSO, RBAC, Teams, Webhooks, Audit)
  { path: '/api/sso', file: './routes/sso.routes' },
  { path: '/api/rbac', file: './services/rbac/rbac.routes' },
  { path: '/api/teams', file: './services/team/team.routes' },
  { path: '/api/organizations', file: './services/team/organization.routes' },
  { path: '/api/webhooks', file: './services/webhooks/routes/webhook.routes' },
  { path: '/api/audit', file: './services/audit/routes/audit.routes' },
  // Sprint 4: Platform Intelligence & Ecosystem
  { path: '/api/marketplace', file: './services/marketplace/routes/marketplace.routes' },
  { path: '/api/intelligence', file: './routes/test-intelligence.routes' },
  { path: '/api/collaboration', file: './services/collaboration/routes' },
  { path: '/api/impact', file: './services/impact-analysis/routes' },
  { path: '/api/mocks', file: './services/api-mocking/api-mocking.routes' },
  { path: '/api/score', file: './services/qestro-score/qestro-score.routes' },
  // Sprint 5: Scale & Performance
  { path: '/api/apm', file: './services/apm/routes/apm.routes' },
  { path: '/api/cache', file: './services/cache/routes/cache.routes' },
  { path: '/api/rate-limit', file: './services/rate-limiter/routes' },
  { path: '/api/db', file: './services/db-optimizer/routes' },
  // Sprint 6: Billing
  { path: '/api/stripe', file: './routes/stripe-billing.routes' },
  // Existing routes (default exports)
  { path: '/api/cicd', file: './routes/cicd.routes' },
  { path: '/api/self-healing', file: './routes/self-healing.routes' },
  { path: '/api/scheduling', file: './routes/scheduling.routes' },
  { path: '/api/recordings', file: './routes/recordings.routes' },
  { path: '/api/ai/testing', file: './routes/ai-testing.routes' },
  { path: '/api/ai/agents', file: './routes/ai-agents.routes' },
  { path: '/api/ai/recorder', file: './routes/ai-step-recorder.routes' },
  { path: '/api/jira', file: './routes/jira.routes' },
  { path: '/api/slack', file: './routes/slack.routes' },
  { path: '/api/cloud-devices', file: './routes/cloud-devices.routes' },
  { path: '/api/mock', file: './routes/mock.routes' },
  { path: '/api/security', file: './routes/security.routes' },
  { path: '/api/playback', file: './routes/playback.routes' },
  { path: '/api/missions', file: './routes/missions.routes' },
  { path: '/api/explorations', file: './routes/explorations.routes' },
  { path: '/api/insights', file: './routes/insights.routes' },
  { path: '/api/testgen', file: './routes/testgen.routes' },
  // Performance Testing (Load Testing & Browser Matrix)
  { path: '/api/load-test', file: './services/load-testing/load-testing.routes', exportName: 'loadTestingRouter' },
  { path: '/api/browser-matrix', file: './services/browser-matrix/browser-matrix.routes', exportName: 'browserMatrixRouter' },
];

const mountRoutes = async () => {
  let mounted = 0;
  let failed = 0;

  for (const route of routeMap) {
    try {
      const filePath = route.file.endsWith('.js') ? route.file : `${route.file}.js`;
      const mod = await import(filePath);
      const router = route.exportName ? mod[route.exportName] : (mod.default || Object.values(mod)[0]);
      if (router && typeof router === 'function') {
        app.use(route.path, router);
        mounted++;
      } else {
        logger.warn(`No router exported from ${route.file}`);
        failed++;
      }
    } catch (err: any) {
      logger.warn(`Route skipped: ${route.path} — ${err.message}`);
      failed++;
    }
  }

  logger.info(`Routes: ${mounted} mounted, ${failed} skipped`);
};

// API info
app.get('/api', (_req, res) => {
  res.json({ name: 'Qestro API', version: '1.0.0', environment: NODE_ENV });
});

// ─── Error Handling ───
app.use((err: any, req: any, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON' });
  if (err.message?.startsWith('CORS')) return res.status(403).json({ error: 'CORS policy violation' });
  logger.error(`[${req.id}] Unhandled error:`, err);
  res.status(500).json({ error: 'Internal server error', ...(isDev && { message: err.message }) });
});

app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// ─── Graceful Shutdown ───
let server: ReturnType<typeof app.listen>;
const shutdown = async (signal: string) => {
  logger.info(`${signal} — shutting down...`);
  server?.close(() => { logger.info('Goodbye.'); process.exit(0); });
  setTimeout(() => process.exit(1), 15000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start ───
(async () => {
  try {
    // Initialize database
    try {
      const { db } = await import('./lib/db');
      logger.info('Database module loaded');
    } catch (err: any) {
      logger.warn(`Database not available: ${err.message} — running in degraded mode`);
    }

    await mountRoutes();

    server = app.listen(PORT, () => {
      console.log(`
  ╔══════════════════════════════════════╗
  ║   QESTRO API — ${NODE_ENV.toUpperCase().padEnd(18)}  ║
  ║   Port: ${String(PORT).padEnd(29)} ║
  ║   http://localhost:${String(PORT).padEnd(18)} ║
  ╚══════════════════════════════════════╝`);
    });
  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
})();

export default app;
