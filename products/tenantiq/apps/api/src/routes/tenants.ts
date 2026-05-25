/**
 * Tenant routes barrel — combines all tenant sub-route modules.
 * All endpoints return real DB data — no hardcoded demo data.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { verifyTenantAccess } from './tenants/helpers';
import { forbidden } from '../lib/errors';
import { crudRoutes } from './tenants/crud';
import { syncRoutes } from './tenants/sync';
import { dashboardRoutes } from './tenants/dashboard';
import { backupRoutes } from './tenants/backup';
import { backupScheduleRoutes } from './tenants/backup-schedule';
import { licenseRoutes } from './tenants/licenses';
import { alertRoutes } from './tenants/alerts';
import { workflowRoutes } from './tenants/workflows-routes';
import { securityGraphRoutes } from './tenants/security-graph';
import { securityStackRoutes } from './tenants/security-stack';
import { hardeningRoutes } from './tenants/hardening';
import { emailSigninRoutes } from './tenants/email-signin';
import { inboxRuleRoutes } from './tenants/inbox-rules';
import { intelligenceRoutes } from './tenants/intelligence';
import { skillRoutes } from './tenants/skills-routes';
import { skillTemplateRoutes } from './tenants/skill-templates';
import { autoFixModeRoutes } from './tenants/auto-fix-mode';
import { miscRoutes } from './tenants/misc';
import { tokenforgeRoutes } from './tenants/tokenforge';

export const tenantRoutes = new Hono<AppEnv>();

tenantRoutes.use('*', authMiddleware);

// Defense-in-depth: any route that carries a `:id` path param must verify
// the caller owns that tenant. Fast path is the JWT tenantIds list (set at
// sign-in); slow path falls back to a D1 lookup so a session minted before a
// tenant was provisioned (admin-consent flow, marketplace activation) still
// works without a forced sign-out.
tenantRoutes.use('/:id/*', async (c, next) => {
	const id = c.req.param('id');
	if (!id) { await next(); return; }
	if (verifyTenantAccess(c, id)) { await next(); return; }

	// JWT-stale fallback: check DB ownership by org_id.
	const user = c.get('user');
	if (!user?.orgId) throw forbidden('You do not have access to this tenant');
	const row = await c.env.DB.prepare(
		'SELECT id FROM tenants WHERE id = ? AND organization_id = ? LIMIT 1',
	).bind(id, user.orgId).first<{ id: string }>();
	if (!row) throw forbidden('You do not have access to this tenant');

	// Mutate in-memory so downstream verifyTenantAccess() calls in handlers
	// also pass without re-querying. Lifecycle is request-scoped only.
	user.tenantIds = Array.isArray(user.tenantIds) ? [...user.tenantIds, id] : [id];
	// Signal to the frontend that the JWT is stale and should be refreshed.
	// The client reads this from the response and calls /auth/refresh in the
	// background so subsequent requests take the fast path. Exposed in CORS.
	c.header('X-Refresh-Session', '1');
	await next();
});

// Mount all sub-route modules
tenantRoutes.route('/', crudRoutes);
tenantRoutes.route('/', syncRoutes);
tenantRoutes.route('/', dashboardRoutes);
tenantRoutes.route('/', backupRoutes);
tenantRoutes.route('/', backupScheduleRoutes);
tenantRoutes.route('/', licenseRoutes);
tenantRoutes.route('/', alertRoutes);
tenantRoutes.route('/', workflowRoutes);
tenantRoutes.route('/', securityGraphRoutes);
tenantRoutes.route('/', securityStackRoutes);
tenantRoutes.route('/', hardeningRoutes);
tenantRoutes.route('/', emailSigninRoutes);
tenantRoutes.route('/', inboxRuleRoutes);
tenantRoutes.route('/', intelligenceRoutes);
tenantRoutes.route('/', skillRoutes);
tenantRoutes.route('/', skillTemplateRoutes);
tenantRoutes.route('/', autoFixModeRoutes);
tenantRoutes.route('/', miscRoutes);
tenantRoutes.route('/', tokenforgeRoutes);
