import type { Hono } from 'hono';
import { tenantRoutes } from '../routes/tenants';
import { tenantSettingsRoutes } from '../routes/tenant-settings';
import onboarding from '../routes/onboarding';
import onboardingTracking from '../routes/onboarding-tracking';
import costOptimization from '../routes/cost-optimization';
import tenantProfileRoutes from '../routes/tenants/profile';
import purviewRoutes from '../routes/tenants/purview';
import { promoRoutes } from '../routes/tenants/promo';
import tenantWebhookRoutes from '../routes/tenants/webhooks';
import { licenseRoutes } from '../routes/licenses';
import { aiRoutes } from '../routes/ai';
import { aiStreamingRoutes } from '../routes/ai-streaming';
import { aiExportRoutes } from '../routes/ai-export';
import { aiEngineRoutes } from '../routes/ai-engine';
import { storageComplianceRoutes } from '../routes/storage-compliance';
import { aiFeedbackRoutes } from '../routes/ai-feedback';
import { graphSubscriptionRoutes } from '../routes/graph-subscriptions';
import tenantComparison from '../routes/tenant-comparison';
import auditHistoryRoutes from '../routes/tenants/audit-history';
import { tokenforgeMiddleware } from '../middleware/tokenforge';
import type { AppEnv } from './types';

export function registerTenantRoutes(app: Hono<AppEnv>) {
	// Enforce TokenForge device binding on every authenticated tenant request.
	// The middleware is idempotent for tenants without TokenForge configured —
	// it short-circuits when `tokenforge_config.enabled` is 0 or the config row is missing.
	app.use('/api/tenants/:tenantId/*', tokenforgeMiddleware);
	app.route('/api/tenants', tenantRoutes);
	app.route('/api/tenants', tenantSettingsRoutes);
	app.route('/api/tenants/:tenantId', tenantProfileRoutes);
	app.route('/api/tenants/:tenantId/purview', purviewRoutes);
	app.route('/api/tenants', promoRoutes);
	app.route('/api/tenants/:tenantId/webhooks', tenantWebhookRoutes);
	app.route('/api/tenants/:tenantId/licenses', licenseRoutes);
	app.route('/api/tenants/:tenantId/ai', aiRoutes);
	app.route('/api/tenants/:tenantId/ai', aiStreamingRoutes);
	app.route('/', aiExportRoutes);
	app.route('/api/ai', aiEngineRoutes);
	app.route('/api/ai/feedback', aiFeedbackRoutes);
	app.route('/api/tenants/:tenantId/storage', storageComplianceRoutes);
	app.route('/api/tenants/:tenantId/graph-subscriptions', graphSubscriptionRoutes);
	app.route('/api/tenant-comparison', tenantComparison);
	app.route('/api/tenants/:tenantId/audit', auditHistoryRoutes);
	// Routes moved here from routes-core/routes-analytics so they inherit
	// tokenforgeMiddleware. Handlers already get tenantId from JWT, so no
	// handler changes needed — only the public URL changes.
	app.route('/api/tenants/:tenantId/onboarding', onboarding);
	app.route('/api/tenants/:tenantId/onboarding', onboardingTracking);
	app.route('/api/tenants/:tenantId/cost-optimization', costOptimization);
}
