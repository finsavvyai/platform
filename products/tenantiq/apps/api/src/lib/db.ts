import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../index';
import * as localSchema from '../../drizzle/schema';
import * as pkgSchema from '@tenantiq/db/schema-d1';

// Merge both SQLite schemas — localSchema (alerts, organizations, etc.) and
// pkgSchema (tenants, users_cache, licenses_cache, security_alerts).
// Local wins on collisions (only webhookConfigs overlaps).
const schema = { ...pkgSchema, ...localSchema };

/**
 * Create a Drizzle database connection using Cloudflare D1.
 * D1 is a serverless SQLite database that runs directly in Cloudflare's network.
 */
export function getDb(env: Env) {
	if (!env.DB) {
		throw new Error('D1 database binding not configured. Add [[d1_databases]] to wrangler.toml');
	}
	return drizzle(env.DB, { schema });
}

export { schema };
