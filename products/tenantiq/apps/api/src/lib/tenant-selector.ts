/**
 * Resolves the selected tenant for the current request.
 *
 * Priority:
 *   1. X-Tenant-Id header (sent by the frontend API client)
 *   2. tenantId query parameter
 *   3. First tenant from the user's tenantIds
 *
 * The selected tenant is validated against the user's tenantIds list
 * to prevent cross-tenant access.
 */
import type { Context } from 'hono';

export function getSelectedTenant(c: Context): string | null {
	const user = c.get('user');
	const tenantIds: string[] = user?.tenantIds || [];
	const selected =
		c.req.header('X-Tenant-Id') ||
		c.req.query('tenantId') ||
		tenantIds[0];
	return selected && tenantIds.includes(selected) ? selected : tenantIds[0] || null;
}
