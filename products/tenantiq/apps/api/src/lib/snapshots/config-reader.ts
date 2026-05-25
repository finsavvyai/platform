/**
 * Config Reader — fetches tenant configuration from Graph API for snapshotting.
 * Each category returns a JSON-serializable object.
 */

export interface ConfigCategory {
	id: string;
	name: string;
	graphPath: string;
	description: string;
}

export const CONFIG_CATEGORIES: ConfigCategory[] = [
	{ id: 'conditional_access', name: 'Conditional Access Policies', graphPath: '/identity/conditionalAccessPolicies', description: 'All CA policies including conditions and grant controls' },
	{ id: 'named_locations', name: 'Named Locations', graphPath: '/identity/conditionalAccess/namedLocations', description: 'IP ranges and country-based named locations' },
	{ id: 'auth_methods', name: 'Authentication Methods', graphPath: '/policies/authenticationMethodsPolicy', description: 'MFA methods, passwordless, FIDO2 configuration' },
	{ id: 'authorization', name: 'Authorization Policy', graphPath: '/policies/authorizationPolicy', description: 'Guest invite settings, user consent, default permissions' },
	{ id: 'security_defaults', name: 'Security Defaults', graphPath: '/policies/identitySecurityDefaultsEnforcementPolicy', description: 'Security defaults enforcement state' },
	{ id: 'directory_roles', name: 'Directory Roles', graphPath: '/directoryRoles?$expand=members($select=id,displayName)', description: 'Admin role assignments' },
	{ id: 'app_consent', name: 'App Consent Policies', graphPath: '/policies/permissionGrantPolicies', description: 'OAuth app consent configuration' },
	{ id: 'cross_tenant', name: 'Cross-Tenant Access', graphPath: '/policies/crossTenantAccessPolicy', description: 'B2B collaboration and direct connect settings' },
	{ id: 'sensitivity_labels', name: 'Sensitivity Labels', graphPath: '/informationProtection/policy/labels', description: 'Information protection labels' },
	{ id: 'directory_settings', name: 'Directory Settings', graphPath: '/settings', description: 'Org-wide directory settings (groups, consent, etc.)' },
];

export interface CategorySnapshot {
	categoryId: string;
	name: string;
	data: unknown;
	objectCount: number;
	fetchedAt: string;
	error?: string;
}

export async function captureCategory(
	graphFetch: (path: string) => Promise<any>,
	category: ConfigCategory,
): Promise<CategorySnapshot> {
	const fetchedAt = new Date().toISOString();
	try {
		const raw = await graphFetch(category.graphPath);
		const data = raw.value ?? raw;
		const objectCount = Array.isArray(data) ? data.length : 1;
		return { categoryId: category.id, name: category.name, data, objectCount, fetchedAt };
	} catch (err) {
		return { categoryId: category.id, name: category.name, data: null, objectCount: 0, fetchedAt, error: err instanceof Error ? err.message : 'Failed' };
	}
}

export async function captureAllCategories(
	graphFetch: (path: string) => Promise<any>,
): Promise<CategorySnapshot[]> {
	return Promise.all(CONFIG_CATEGORIES.map(cat => captureCategory(graphFetch, cat)));
}
