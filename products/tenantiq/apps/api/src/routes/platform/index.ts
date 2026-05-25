import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import auth from './auth';
import organizations from './organizations';
import users from './users';
import subscriptions from './subscriptions';
import adminStats from './admin-stats';
import adminNotifications from './admin-notifications';
import adminOverview from './admin-overview';
import adminSync from './admin-sync';
import adminMetrics from './admin-metrics';
import adminAudit from './admin-audit';
import adminAlerts from './admin-alerts';
import adminRevenue from './admin-revenue';
import adminAnnouncements from './admin-announcements';
import { featureFlagRoutes } from './feature-flags';
import adminCron from './admin-cron';
import adminCredentials from './admin-credentials';
import orgsGrantTier from './orgs-grant-tier';

/**
 * Platform Management Routes
 *
 * Centralized routing for all platform management endpoints
 */

const platform = new Hono<AppEnv>();

// Mount sub-routes
platform.route('/auth', auth);
platform.route('/organizations', organizations);
platform.route('/organizations', orgsGrantTier);
platform.route('/users', users);
platform.route('/subscriptions', subscriptions);
platform.route('/admin', adminStats);
platform.route('/admin/notifications', adminNotifications);
platform.route('/admin', adminOverview);
platform.route('/admin', adminSync);
platform.route('/admin', adminMetrics);
platform.route('/admin', adminAudit);
platform.route('/admin', adminAlerts);
platform.route('/admin', adminRevenue);
platform.route('/admin/feature-flags', featureFlagRoutes);
platform.route('/announcements', adminAnnouncements);
platform.route('/admin', adminCron);
platform.route('/admin', adminCredentials);

export default platform;
