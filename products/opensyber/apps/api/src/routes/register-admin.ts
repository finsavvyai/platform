/**
 * Admin & Enterprise Route Registration
 *
 * Extracted from register.ts to stay under 200-line limit.
 */
import type { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { adminStatsRoutes } from './admin-stats.js';
import { adminUserRoutes } from './admin-users.js';
import { adminOrgRoutes } from './admin-orgs.js';
import { adminInstanceRoutes } from './admin-instances.js';
import { adminEventRoutes } from './admin-events.js';
import { adminSkillRoutes } from './admin-skills.js';
import { adminBillingRoutes } from './admin-billing.js';
import { adminAuditRoutes } from './admin-audit.js';
import { dataRoomRoutes } from './data-room.js';
import { openApiRoutes } from './openapi/index.js';
import { scimUserRoutes } from './scim-users.js';
import { scimGroupRoutes } from './scim-groups.js';
import { soc2Routes } from './soc2-readiness.js';
import { slaMonitoringRoutes } from './sla-monitoring.js';
import { marketplaceBrowseRoutes } from './marketplace-browse.js';
import { marketplaceInstallRoutes } from './marketplace-install.js';
import { marketplaceRateRoutes } from './marketplace-rate.js';
import { marketplacePublishRoutes } from './marketplace-publish.js';
import { marketplaceAdminRoutes } from './marketplace-admin.js';
import { planFeatureRoutes } from './plan-features.js';
import { enterpriseContactRoutes } from './enterprise-contact.js';
import { dataExportRoutes } from './data-export.js';
import { webhookLogRoutes } from './webhook-logs.js';

type App = Hono<{ Bindings: Env; Variables: Variables }>;

export function registerAdminRoutes(app: App): void {
  // Admin routes
  app.route('/api/admin/data-room', dataRoomRoutes);
  app.route('/api/admin/stats', adminStatsRoutes);
  app.route('/api/admin/users', adminUserRoutes);
  app.route('/api/admin/organizations', adminOrgRoutes);
  app.route('/api/admin/instances', adminInstanceRoutes);
  app.route('/api/admin/events', adminEventRoutes);
  app.route('/api/admin/skills', adminSkillRoutes);
  app.route('/api/admin/billing', adminBillingRoutes);
  app.route('/api/admin/audit', adminAuditRoutes);

  // Marketplace (Sprint 27)
  app.route('/api/marketplace', marketplaceBrowseRoutes);
  app.route('/api/marketplace', marketplaceInstallRoutes);
  app.route('/api/marketplace', marketplaceRateRoutes);
  app.route('/api/marketplace', marketplacePublishRoutes);
  app.route('/api/admin/marketplace', marketplaceAdminRoutes);

  // OpenAPI spec (Sprint 28)
  app.route('/openapi.json', openApiRoutes);

  // SCIM provisioning (Sprint 28)
  app.route('/api/scim/v2', scimUserRoutes);
  app.route('/api/scim/v2', scimGroupRoutes);

  // SOC2 readiness (Sprint 28)
  app.route('/api/soc2', soc2Routes);

  // SLA monitoring (Sprint 28)
  app.route('/api/sla', slaMonitoringRoutes);

  // Plan & enterprise
  app.route('/api/plan', planFeatureRoutes);
  app.route('/api/enterprise', enterpriseContactRoutes);

  // Data export + webhook delivery logs
  app.route('/api/export', dataExportRoutes);
  app.route('/api/webhooks', webhookLogRoutes);
}
