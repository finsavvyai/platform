import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { standardRateLimit } from '../../middleware/rateLimit.middleware';
import type { AppEnv } from '../../index';
import orgsCrud from './orgs-crud';
import orgsCreate from './orgs-create';
import orgsSettings from './orgs-settings';

/**
 * Platform Organization Management Routes
 *
 * These routes allow platform admins to manage customer organizations (tenants).
 * Only accessible by users with 'platform_admin' role.
 */

const organizations = new Hono<AppEnv>();

// All routes require platform admin role
organizations.use('*', authMiddleware);
organizations.use('*', requireRole('platform_admin', 'super_admin', 'admin'));
organizations.use('*', standardRateLimit);

// Read operations (list, get by id)
organizations.route('/', orgsCrud);

// Create operations
organizations.route('/', orgsCreate);

// Settings operations (update, delete, stats)
organizations.route('/', orgsSettings);

export default organizations;
