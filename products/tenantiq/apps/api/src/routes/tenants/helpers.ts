/**
 * Shared helpers for tenant sub-routes.
 */

/** Generate a 32-char hex ID from crypto random bytes. */
export function genId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verify the authenticated user owns this tenant via their tenantIds list. */
export function verifyTenantAccess(c: any, tenantId: string): boolean {
	const user = c.get('user');
	return Array.isArray(user.tenantIds) && user.tenantIds.includes(tenantId);
}

/** Map a raw DB tenant row to the API response shape. */
export function mapTenant(row: Record<string, unknown>) {
	return {
		id: row.id,
		organizationId: row.organization_id,
		azureTenantId: row.azure_tenant_id,
		displayName: row.display_name,
		domain: row.domain,
		status: row.status ?? 'active',
		lastSyncAt: row.last_sync_at,
		createdAt: row.created_at,
	};
}
