/**
 * Security Stack Configuration Engine — applies Microsoft security configurations
 * via Graph API. Returns success/failure with rollback info for each action.
 */
import type { GraphClient } from './graph-client';

export interface ConfigAction {
	success: boolean;
	action: string;
	details: string;
	rollbackInfo?: Record<string, unknown>;
	resourceId?: string;
}

// ─── Conditional Access Policies ────────────────────────────────────────────

export async function createMfaEnforcementPolicy(
	graph: GraphClient,
	options: { allUsers?: boolean; adminOnly?: boolean }
): Promise<ConfigAction> {
	try {
		const users = options.adminOnly
			? {
					includeRoles: [
						'62e90394-69f5-4237-9190-012177145e10', // Global Admin
						'fe930be7-5e62-47db-91af-98c3a49a38b1', // User Admin
						'29232cdf-9323-42fd-ade2-1d097af3e4de'  // Exchange Admin
					]
				}
			: { includeUsers: ['All'] };

		const policy = await graph.fetch('/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: 'TenantIQ: MFA Enforcement',
				state: 'enabled',
				conditions: {
					users,
					applications: { includeApplications: ['All'] },
					clientAppTypes: ['all']
				},
				grantControls: { operator: 'OR', builtInControls: ['mfa'] }
			})
		});

		return {
			success: true,
			action: 'Create MFA Enforcement Policy',
			details: `Policy created for ${options.adminOnly ? 'admin roles' : 'all users'}`,
			rollbackInfo: { policyId: policy.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Create MFA Enforcement Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

export async function createDeviceCompliancePolicy(
	graph: GraphClient,
	options: { platforms?: string[] }
): Promise<ConfigAction> {
	try {
		const platforms = options.platforms ?? ['windows', 'macOS', 'iOS', 'android'];

		const policy = await graph.fetch('/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: 'TenantIQ: Device Compliance Required',
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					platforms: { includePlatforms: platforms },
					applications: { includeApplications: ['All'] }
				},
				grantControls: { operator: 'AND', builtInControls: ['compliantDevice', 'domainJoinedDevice'] }
			})
		});

		return {
			success: true,
			action: 'Create Device Compliance Policy',
			details: `Policy created for ${platforms.join(', ')}`,
			rollbackInfo: { policyId: policy.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Create Device Compliance Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

export async function createLocationRestrictionPolicy(
	graph: GraphClient,
	options: { allowedCountries?: string[] }
): Promise<ConfigAction> {
	try {
		const countries = options.allowedCountries ?? ['US'];

		const location = await graph.fetch('/identity/conditionalAccess/namedLocations', {
			method: 'POST',
			body: JSON.stringify({
				'@odata.type': '#microsoft.graph.countryNamedLocation',
				displayName: 'TenantIQ: Allowed Countries',
				countriesAndRegions: countries,
				includeUnknownCountriesAndRegions: false
			})
		});

		const policy = await graph.fetch('/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: 'TenantIQ: Location Restriction',
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					applications: { includeApplications: ['All'] },
					locations: { excludeLocations: [location.id] }
				},
				grantControls: { operator: 'OR', builtInControls: ['block'] }
			})
		});

		return {
			success: true,
			action: 'Create Location Restriction Policy',
			details: `Blocked access from outside: ${countries.join(', ')}`,
			rollbackInfo: { policyId: policy.id, locationId: location.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Create Location Restriction Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

export async function blockLegacyAuthPolicy(graph: GraphClient): Promise<ConfigAction> {
	try {
		const policy = await graph.fetch('/identity/conditionalAccessPolicies', {
			method: 'POST',
			body: JSON.stringify({
				displayName: 'TenantIQ: Block Legacy Authentication',
				state: 'enabled',
				conditions: {
					users: { includeUsers: ['All'] },
					applications: { includeApplications: ['All'] },
					clientAppTypes: ['exchangeActiveSync', 'other']
				},
				grantControls: { operator: 'OR', builtInControls: ['block'] }
			})
		});

		return {
			success: true,
			action: 'Block Legacy Auth Policy',
			details: 'Conditional Access policy blocking legacy authentication created',
			rollbackInfo: { policyId: policy.id },
			resourceId: policy.id
		};
	} catch (err) {
		return {
			success: false,
			action: 'Block Legacy Auth Policy',
			details: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}
