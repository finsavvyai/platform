/**
 * Route + per-route middleware mounting.
 *
 * Pulled out of `index.ts` so the entry file stays under the 200L
 * portfolio cap. Pure: takes the Hono `app` instance and wires every
 * route group + scoped middleware. No global middleware (CORS, body
 * limit, security headers, DB init) — those stay in `index.ts`
 * because they precede this call.
 */

import type { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { tenantAuth } from '../middleware/tenant-auth.js';
import { usageLimit } from '../middleware/usage-limit.js';
import { publicRateLimit, apiRateLimit, rateLimit } from '../middleware/rate-limit.js';
import { guardMiddleware } from '../middleware/guard.js';
import { analyticsRoutes } from './analytics.js';
import { healthRoutes } from './health.js';
import { sessionRoutes } from './sessions.js';
import { verifyRoutes } from './verify.js';
import { bindRoutes } from './bind.js';
import { eventRoutes } from './events.js';
import { usageRoutes } from './usage.js';
import { webhookRoutes } from './webhooks.js';
import { tenantRoutes } from './tenants.js';
import { edgeVerifyRoutes } from './edge-verify.js';
import { sdkJsRoutes } from './sdk-js.js';
import { proxyConfigRoutes } from './proxy-config.js';
import { alertRoutes } from './alerts.js';
import { trustPageRoutes } from './trust-page.js';
import { badgeJsRoutes } from './badge-js.js';
import { signupRoutes } from './signup.js';
import { complianceRoutes } from './compliance.js';
import { webhookConfigRoutes } from './webhooks-config.js';
import { webhookActionsRoutes } from './webhooks-actions.js';
import { dbscRegisterRoutes } from './dbsc-register.js';
import { dbscRefreshRoutes } from './dbsc-refresh.js';
import { dbscChallengeRoutes } from './dbsc-challenge.js';
import { dbscSessionRoutes } from './dbsc-revoke.js';
import { deviceTelemetryRoutes } from './device-telemetry.js';
import { policyRoutes } from './policies.js';
import { actionsVerifyRoutes } from './actions-verify.js';
import { aitmEvidenceRoutes } from './compliance/aitm-evidence.js';
import { stepUpActionsRoutes } from './step-up-actions.js';
import { workforceAppRoutes } from './workforce-apps.js';
import { workforceSsoRoutes } from './workforce-sso.js';
import { workforceSubjectRoutes } from './workforce-subjects.js';
import { wellKnownRoutes } from './well-known.js';
import { internalProvisionRoutes } from './internal-provision.js';
import { internalSigningKeysRoutes } from './internal-signing-keys.js';
import { scimUserRoutes } from './scim/users.js';
import { scimGroupRoutes } from './scim/groups.js';
import { samlRoutes } from './saml.js';
import { openapiRoutes } from './openapi.js';

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function mountRoutes(app: App): void {
  // Public routes (no auth, IP rate limited)
  app.use('/sdk.js', publicRateLimit);
  app.use('/badge.js', publicRateLimit);
  app.use('/public/*', publicRateLimit);
  app.route('/health', healthRoutes);
  app.route('/sdk.js', sdkJsRoutes);
  app.route('/public/trust', trustPageRoutes);
  app.route('/badge.js', badgeJsRoutes);
  app.route('/.well-known', wellKnownRoutes);
  app.route('/v1/openapi.json', openapiRoutes);
  app.route('/v1/saml', samlRoutes);

  // Provision — rate limited to 3/hour per IP (anti-abuse)
  const provisionLimit = rateLimit({ limit: 3, window: 3600, prefix: 'prov', keySource: 'ip' });
  app.use('/public/provision', provisionLimit);
  app.route('/public/provision', signupRoutes);

  // Internal routes (secret-protected, server-to-server only)
  app.route('/internal/provision', internalProvisionRoutes);
  app.route('/internal/signing-keys', internalSigningKeysRoutes);

  // Webhooks (no tenant auth — uses signature verification)
  app.route('/webhooks', webhookRoutes);

  // Rate limit first (sets headers even for unauthenticated requests)
  app.use('/v1/*', apiRateLimit);
  // Authenticate all /v1/* calls
  app.use('/v1/*', tenantAuth);
  app.use('/v1/*', guardMiddleware());
  // Usage quota only applies to metered data-plane endpoints (verify/bind/session
  // issuance, edge verify). Control-plane CRUD (webhooks, alerts, tenant, proxy,
  // events, usage, compliance, analytics) must not be gated by monthly quota.
  app.use('/v1/sessions/*', usageLimit);
  app.use('/v1/verify/*', usageLimit);
  app.use('/v1/bind/*', usageLimit);
  app.use('/v1/edge/verify/*', usageLimit);
  app.use('/v1/dbsc/register', usageLimit);
  app.use('/v1/dbsc/refresh', usageLimit);

  // Mount route groups
  app.route('/v1/sessions', sessionRoutes);
  app.route('/v1/verify', verifyRoutes);
  app.route('/v1/bind', bindRoutes);
  app.route('/v1/webhooks', webhookConfigRoutes);
  app.route('/v1/webhooks', webhookActionsRoutes);
  app.route('/v1/events', eventRoutes);
  app.route('/v1/usage', usageRoutes);
  app.route('/v1/tenant', tenantRoutes);
  app.route('/v1/edge/verify', edgeVerifyRoutes);
  app.route('/v1/dbsc/challenge', dbscChallengeRoutes);
  app.route('/v1/dbsc/register', dbscRegisterRoutes);
  app.route('/v1/dbsc/refresh', dbscRefreshRoutes);
  app.route('/v1/dbsc/sessions', dbscSessionRoutes);
  app.route('/v1/policies', policyRoutes);
  app.route('/v1/actions/verify', actionsVerifyRoutes);
  app.route('/v1/compliance', aitmEvidenceRoutes);
  app.route('/v1/step-up-actions', stepUpActionsRoutes);
  app.route('/v1/workforce/apps', workforceAppRoutes);
  app.route('/v1/workforce/sso', workforceSsoRoutes);
  app.route('/v1/workforce/subjects', workforceSubjectRoutes);
  app.route('/v1/devices', deviceTelemetryRoutes);
  app.route('/v1/proxy', proxyConfigRoutes);
  app.route('/v1/alerts', alertRoutes);
  app.route('/v1/compliance', complianceRoutes);
  app.route('/v1/analytics', analyticsRoutes);

  // SCIM 2.0 provisioning (tenant auth via Bearer token)
  app.route('/scim/v2/Users', scimUserRoutes);
  app.route('/scim/v2/Groups', scimGroupRoutes);

}
