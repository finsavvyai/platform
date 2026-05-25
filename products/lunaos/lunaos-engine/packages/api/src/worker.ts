/** LunaOS Engine API — Cloudflare Worker entry point for api.lunaos.ai */

import { Hono } from 'hono';
import { logger } from 'hono/logger';

import { installZeroTrustFetch } from './middleware/zero-trust-fetch';
installZeroTrustFetch();

import { corsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/security-headers';
import { trackMetrics } from './middleware/metrics';
import { healthRoutes, readyHandler } from './routes/health';
import { authRoutes } from './routes/auth';
import { authResetRoutes } from './routes/auth-reset';
import { oauthRoutes } from './routes/oauth';

import { agentRoutes, agentExecutionRoutes } from './routes/agents';
import { customAgentRoutes } from './routes/custom-agents';
import { ragRoutes } from './routes/rag';
import { githubRoutes } from './routes/github';
import { chainRoutes } from './routes/chains';
import { billingRoutes } from './routes/billing';
import { teamRoutes } from './routes/teams';
import { apiKeyRoutes } from './routes/api-keys';
import { telemetryRoutes } from './routes/telemetry';
import { openclawRoutes } from './routes/openclaw';
import { openclawServicesRoutes } from './routes/openclaw-services';
import { kbRoutes } from './routes/kb';
import { providerRoutes } from './routes/providers';
import { userRoutes } from './routes/users';
import { executeRoutes } from './routes/execute';
import { pipeRoutes } from './routes/pipes';
import { creditRoutes } from './routes/credits';
import { captureException } from './services/sentry';
import { runScheduledTasks } from './services/scheduled-runner';

// Phase-1 SSO routers (mounted under /v1/sso/*)
import { oidcRouter } from './routes/auth/oidc';
import { samlRouter } from './routes/auth/saml';
import { idpAdminRouter } from './routes/auth/idp-admin';
import { discoveryRouter } from './routes/auth/discovery';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  LEMONSQUEEZY_API_KEY?: string;
  LEMONSQUEEZY_STORE_ID?: string;
  LEMONSQUEEZY_WEBHOOK_SECRET?: string;
  CHAINS_WEBHOOK_SECRET?: string;
  LEMONSQUEEZY_VARIANT_PRO?: string;
  LEMONSQUEEZY_VARIANT_TEAM?: string;
  OPENHANDS_API_URL?: string;
  OPENHANDS_API_KEY?: string;
  RESEND_API_KEY?: string;
  CLAW_API_KEY?: string;
  CLAW_ENDPOINT?: string;
  CLAW_PROJECT_ID?: string;
  OAUTH_ENCRYPTION_KEY?: string;
  AI: any;
  VECTORIZE: any;
  REASONING_BANK_ENABLED?: string;
  ENVIRONMENT: string;
  SENTRY_DSN?: string;

  // Phase-1 SSO bindings (Workers env / wrangler vars)
  // Required at runtime; declared optional so unit-test envs can omit.
  SSO_VAULT_KEY?: string;        // base64 32-byte HKDF IKM
  SP_ENTITY_ID?: string;         // SAML SP entityID (audience)
  SP_ACS_URL?: string;           // SAML AssertionConsumerService URL
  OIDC_REDIRECT_URI?: string;    // OIDC callback URL
  SESSION_SECRET?: string;       // HMAC for SSO state + cookies
  SAML_BINDING?: string;         // 'POST' | 'REDIRECT' (default REDIRECT)
}

// --- App setup ---
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', corsMiddleware);
app.use('*', securityHeaders);
app.use('*', trackMetrics);

// Mount routes
app.route('/health', healthRoutes);
app.get('/ready', readyHandler);
app.route('/auth', authRoutes);
app.route('/auth', authResetRoutes);
app.route('/auth/oauth', oauthRoutes);
app.route('/agents', agentRoutes);
app.route('/agents', agentExecutionRoutes);
app.route('/agents/custom', customAgentRoutes);
app.route('/rag', ragRoutes);
app.route('/github', githubRoutes);
app.route('/chains', chainRoutes);
app.route('/billing', billingRoutes);
app.route('/api-keys', apiKeyRoutes);
app.route('/telemetry', telemetryRoutes);
app.route('/teams', teamRoutes);
app.route('/providers', providerRoutes);
app.route('/openclaw', openclawRoutes);
app.route('/openclaw/services', openclawServicesRoutes);
app.route('/kb', kbRoutes);
app.route('/users', userRoutes);
app.route('/execute', executeRoutes);
app.route('/pipes', pipeRoutes);
app.route('/credits', creditRoutes);

// Phase-1 SSO routes (org-scoped, mounted under /v1/sso/*).
// NOTE: samlRouter declares fully-qualified paths internally; mount at '/'.
app.route('/v1/sso/oidc', oidcRouter);
app.route('/', samlRouter);
app.route('/v1/sso/idp', idpAdminRouter);
app.route('/v1/sso/discovery', discoveryRouter);

// Root
app.get('/', (c) => c.json({
  name: 'LunaOS Engine API',
  version: '1.0.0',
  docs: 'https://docs.lunaos.ai',
}));

app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  if (c.env.SENTRY_DSN) {
    const sentryPromise = captureException(
      err,
      {
        method: c.req.method,
        url: c.req.url,
        userId: c.get?.('userId'),
        userEmail: c.get?.('userEmail'),
        userTier: c.get?.('userTier'),
        headers: {
          'user-agent': c.req.header('user-agent') || '',
          'content-type': c.req.header('content-type') || '',
        },
      },
      {
        dsn: c.env.SENTRY_DSN,
        environment: c.env.ENVIRONMENT || 'production',
        release: '1.0.0',
      },
    );
    c.executionCtx?.waitUntil?.(sentryPromise);
  }

  return c.json({
    error: 'Internal Server Error',
    message: c.env.ENVIRONMENT === 'development' ? err.message : 'Something went wrong',
  }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Env, ctx: any) {
    ctx.waitUntil(runScheduledTasks(env));
  }
};
