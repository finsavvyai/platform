/**
 * Realistic tenant profiles simulating different MSP customer types.
 * Each profile represents a real-world scenario TenantIQ must handle.
 */
import type {
	Tenant, Organization, CachedUser, LicenseCache, TenantData,
	Alert, Workflow, PlatformUser, WorkflowStep
} from '@tenantiq/shared';

// ── Helpers ──────────────────────────────────────────────────────

let counter = 0;
const uid = (prefix: string) => `${prefix}-${++counter}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// ── Organizations ────────────────────────────────────────────────

export const mspOrg: Organization = {
	id: uid('org'), name: 'CloudGuard MSP', type: 'msp',
	billingPlan: 'enterprise', createdAt: daysAgo(365),
};

export const directOrg: Organization = {
	id: uid('org'), name: 'Contoso Direct', type: 'direct',
	billingPlan: 'professional', createdAt: daysAgo(180),
};

export const freeOrg: Organization = {
	id: uid('org'), name: 'SmallBiz Free', type: 'direct',
	billingPlan: 'free', createdAt: daysAgo(30),
};

// ── Tenants ──────────────────────────────────────────────────────

export const healthyTenant: Tenant = {
	id: uid('tenant'), organizationId: mspOrg.id,
	azureTenantId: uid('azure'), displayName: 'Healthy Corp',
	domain: 'healthycorp.com', lastSyncAt: hoursAgo(1),
	status: 'active', createdAt: daysAgo(200),
};

export const riskyTenant: Tenant = {
	id: uid('tenant'), organizationId: mspOrg.id,
	azureTenantId: uid('azure'), displayName: 'Risky Industries',
	domain: 'riskyindustries.com', lastSyncAt: hoursAgo(2),
	status: 'active', createdAt: daysAgo(150),
};

export const staleTenant: Tenant = {
	id: uid('tenant'), organizationId: mspOrg.id,
	azureTenantId: uid('azure'), displayName: 'Stale Holdings',
	domain: 'staleholdings.com', lastSyncAt: daysAgo(3),
	status: 'active', createdAt: daysAgo(100),
};

export const newTenant: Tenant = {
	id: uid('tenant'), organizationId: directOrg.id,
	azureTenantId: uid('azure'), displayName: 'New Startup',
	domain: 'newstartup.io', lastSyncAt: null,
	status: 'active', createdAt: daysAgo(1),
};

export const suspendedTenant: Tenant = {
	id: uid('tenant'), organizationId: mspOrg.id,
	azureTenantId: uid('azure'), displayName: 'Suspended LLC',
	domain: 'suspended.com', lastSyncAt: daysAgo(60),
	status: 'suspended', createdAt: daysAgo(300),
};

export const freeTierTenant: Tenant = {
	id: uid('tenant'), organizationId: freeOrg.id,
	azureTenantId: uid('azure'), displayName: 'Free Tier Co',
	domain: 'freetier.co', lastSyncAt: hoursAgo(6),
	status: 'active', createdAt: daysAgo(15),
};

// ── User Generators ──────────────────────────────────────────────

function makeUser(overrides: Partial<CachedUser> = {}): CachedUser {
	const id = uid('user');
	return {
		id, tenantId: healthyTenant.id, azureUserId: uid('az-user'),
		displayName: `User ${id}`, email: `user-${id}@test.com`,
		userType: 'member', accountEnabled: true,
		lastSignIn: daysAgo(1), lastNonInteractiveSignIn: daysAgo(1),
		assignedLicenses: ['Microsoft 365 E3'], assignedGroups: [],
		createdAt: daysAgo(100), updatedAt: daysAgo(1),
		...overrides,
	};
}

export function makeActiveUsers(count: number, tenantId: string): CachedUser[] {
	return Array.from({ length: count }, () =>
		makeUser({ tenantId, lastSignIn: daysAgo(Math.random() * 5) })
	);
}

export function makeInactiveUsers(count: number, tenantId: string): CachedUser[] {
	return Array.from({ length: count }, () =>
		makeUser({
			tenantId, lastSignIn: daysAgo(60 + Math.random() * 120),
			lastNonInteractiveSignIn: daysAgo(90),
			assignedLicenses: ['Microsoft 365 E5'],
		})
	);
}

export function makeGuestUsers(count: number, tenantId: string): CachedUser[] {
	return Array.from({ length: count }, () =>
		makeUser({
			tenantId, userType: 'guest',
			lastSignIn: daysAgo(120 + Math.random() * 60),
			assignedLicenses: [],
		})
	);
}

export function makeDisabledUsers(count: number, tenantId: string): CachedUser[] {
	return Array.from({ length: count }, () =>
		makeUser({ tenantId, accountEnabled: false, assignedLicenses: ['Microsoft 365 E3'] })
	);
}

export function makeE5Users(count: number, tenantId: string, inactive = false): CachedUser[] {
	return Array.from({ length: count }, () =>
		makeUser({
			tenantId,
			assignedLicenses: ['Microsoft 365 E5'],
			lastSignIn: inactive ? daysAgo(45) : daysAgo(1),
			lastNonInteractiveSignIn: inactive ? daysAgo(45) : daysAgo(1),
		})
	);
}

// ── License Generators ───────────────────────────────────────────

export function makeLicenses(tenantId: string, config: {
	e5Total?: number; e5Assigned?: number;
	e3Total?: number; e3Assigned?: number;
	e1Total?: number; e1Assigned?: number;
} = {}): LicenseCache[] {
	const licenses: LicenseCache[] = [];
	if (config.e5Total) {
		licenses.push({
			id: uid('lic'), tenantId, skuId: 'sku-e5',
			skuName: 'Microsoft 365 E5', total: config.e5Total,
			assigned: config.e5Assigned ?? config.e5Total,
			costPerUnit: 57, updatedAt: daysAgo(1),
		});
	}
	if (config.e3Total) {
		licenses.push({
			id: uid('lic'), tenantId, skuId: 'sku-e3',
			skuName: 'Microsoft 365 E3', total: config.e3Total,
			assigned: config.e3Assigned ?? config.e3Total,
			costPerUnit: 36, updatedAt: daysAgo(1),
		});
	}
	if (config.e1Total) {
		licenses.push({
			id: uid('lic'), tenantId, skuId: 'sku-e1',
			skuName: 'Microsoft 365 E1', total: config.e1Total,
			assigned: config.e1Assigned ?? config.e1Total,
			costPerUnit: 10, updatedAt: daysAgo(1),
		});
	}
	return licenses;
}

// ── Conditional Access Policies ──────────────────────────────────

export const mfaEnabledPolicies = [
	{
		id: uid('policy'), displayName: 'Require MFA for admins', state: 'enabled',
		conditions: { users: { includeRoles: ['All'] } },
		grantControls: { builtInControls: ['mfa'] },
	},
	{
		id: uid('policy'), displayName: 'Block legacy auth', state: 'enabled',
		conditions: { clientAppTypes: ['exchangeActiveSync', 'other'] },
		grantControls: { builtInControls: ['block'] },
	},
];

export const weakPolicies = [
	{
		id: uid('policy'), displayName: 'MFA for admins', state: 'disabled',
		conditions: { users: { includeRoles: ['All'] } },
		grantControls: { builtInControls: ['mfa'] },
	},
	{
		id: uid('policy'), displayName: 'Block legacy auth', state: 'enabledForReportingButNotEnforced',
		conditions: { clientAppTypes: ['exchangeActiveSync'] },
		grantControls: { builtInControls: ['block'] },
	},
];

export const noPolicies: unknown[] = [];

// ── Sign-in Logs ─────────────────────────────────────────────────

export function makeFailedSignIns(count: number): unknown[] {
	return Array.from({ length: count }, (_, i) => ({
		status: { errorCode: 50126 },
		createdDateTime: new Date(Date.now() - i * 60_000).toISOString(),
		ipAddress: `10.0.${Math.floor(i / 256)}.${i % 256}`,
		userPrincipalName: `user${i % 10}@test.com`,
	}));
}

export function makeImpossibleTravelLogs(): unknown[] {
	const now = Date.now();
	return [
		{
			userId: 'travel-user-1', userPrincipalName: 'alice@test.com',
			createdDateTime: new Date(now - 3_600_000).toISOString(),
			status: { errorCode: 0 },
			location: {
				countryOrRegion: 'US', city: 'New York',
				geoCoordinates: { latitude: 40.7128, longitude: -74.006 },
			},
		},
		{
			userId: 'travel-user-1', userPrincipalName: 'alice@test.com',
			createdDateTime: new Date(now - 1_800_000).toISOString(),
			status: { errorCode: 0 },
			location: {
				countryOrRegion: 'JP', city: 'Tokyo',
				geoCoordinates: { latitude: 35.6762, longitude: 139.6503 },
			},
		},
	];
}

export function makeNormalSignIns(count: number): unknown[] {
	return Array.from({ length: count }, (_, i) => ({
		status: { errorCode: 0 },
		createdDateTime: new Date(Date.now() - i * 3_600_000).toISOString(),
		ipAddress: '192.168.1.1',
		userPrincipalName: `user${i}@test.com`,
		location: {
			countryOrRegion: 'US', city: 'Chicago',
			geoCoordinates: { latitude: 41.8781, longitude: -87.6298 },
		},
	}));
}

// ── Risky Users ──────────────────────────────────────────────────

export function makeRiskyUsers(count: number): unknown[] {
	return Array.from({ length: count }, (_, i) => ({
		id: uid('risky'), userDisplayName: `Risky User ${i}`,
		userPrincipalName: `risky${i}@test.com`,
		riskState: 'atRisk', riskLevel: i === 0 ? 'high' : 'medium',
	}));
}

// ── Groups ───────────────────────────────────────────────────────

export function makeGroups(ownedCount: number, orphanedCount: number): unknown[] {
	const owned = Array.from({ length: ownedCount }, () => ({
		id: uid('group'), displayName: `Group ${uid('g')}`,
		owners: [{ id: uid('owner') }],
	}));
	const orphaned = Array.from({ length: orphanedCount }, () => ({
		id: uid('group'), displayName: `Orphan Group ${uid('g')}`, owners: [],
	}));
	return [...owned, ...orphaned];
}

// ── Composite TenantData builders ────────────────────────────────

export function buildHealthyTenantData(): TenantData {
	return {
		users: [
			...makeActiveUsers(80, healthyTenant.id),
			...makeE5Users(15, healthyTenant.id, false),
			...makeGuestUsers(5, healthyTenant.id),
		],
		licenses: makeLicenses(healthyTenant.id, {
			e5Total: 20, e5Assigned: 15, e3Total: 100, e3Assigned: 80,
		}),
		conditionalAccessPolicies: mfaEnabledPolicies,
		signInLogs: makeNormalSignIns(50),
		riskyUsers: [],
		groups: makeGroups(10, 0),
	};
}

export function buildRiskyTenantData(): TenantData {
	return {
		users: [
			...makeActiveUsers(30, riskyTenant.id),
			...makeInactiveUsers(40, riskyTenant.id),
			...makeGuestUsers(50, riskyTenant.id),
			...makeE5Users(20, riskyTenant.id, true),
			...makeDisabledUsers(10, riskyTenant.id),
		],
		licenses: makeLicenses(riskyTenant.id, {
			e5Total: 50, e5Assigned: 20, e3Total: 200, e3Assigned: 80,
		}),
		conditionalAccessPolicies: weakPolicies,
		signInLogs: [
			...makeFailedSignIns(200),
			...makeImpossibleTravelLogs(),
		],
		riskyUsers: makeRiskyUsers(5),
		groups: makeGroups(5, 8),
	};
}

export function buildNewTenantData(): TenantData {
	return {
		users: [],
		licenses: [],
		conditionalAccessPolicies: [],
		signInLogs: [],
		riskyUsers: [],
		groups: [],
	};
}

export function buildMinimalTenantData(): TenantData {
	return {
		users: makeActiveUsers(5, freeTierTenant.id),
		licenses: makeLicenses(freeTierTenant.id, { e3Total: 10, e3Assigned: 5 }),
		conditionalAccessPolicies: [],
		signInLogs: makeNormalSignIns(10),
		riskyUsers: [],
	};
}

// ── Platform Users ───────────────────────────────────────────────

export const mspAdmin: PlatformUser = {
	id: uid('puser'), organizationId: mspOrg.id,
	email: 'admin@cloudguard.com', name: 'MSP Admin',
	role: 'super_admin', azureOid: uid('oid'),
	lastLoginAt: hoursAgo(1), createdAt: daysAgo(365),
};

export const tenantOperator: PlatformUser = {
	id: uid('puser'), organizationId: mspOrg.id,
	email: 'operator@cloudguard.com', name: 'Tenant Operator',
	role: 'operator', azureOid: uid('oid'),
	lastLoginAt: hoursAgo(3), createdAt: daysAgo(200),
};

export const viewer: PlatformUser = {
	id: uid('puser'), organizationId: mspOrg.id,
	email: 'viewer@cloudguard.com', name: 'Read Only User',
	role: 'viewer', azureOid: uid('oid'),
	lastLoginAt: daysAgo(7), createdAt: daysAgo(100),
};

export const contractor: PlatformUser = {
	id: uid('puser'), organizationId: directOrg.id,
	email: 'contractor@external.com', name: 'External Contractor',
	role: 'viewer', azureOid: null,
	lastLoginAt: daysAgo(2), createdAt: daysAgo(30),
};

// ── Workflow Templates ───────────────────────────────────────────

export function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
	const steps: WorkflowStep[] = [
		{ action: 'sync_users', onFailure: 'abort' },
		{ action: 'run_security_scan', onFailure: 'skip' },
		{ action: 'generate_report', onFailure: 'retry' },
	];
	return {
		id: uid('wf'), tenantId: healthyTenant.id,
		name: 'Default Workflow', workflowType: 'security_scan',
		triggerType: 'manual', triggerConfig: {},
		steps, requiresApproval: false, enabled: true,
		lastRunAt: null, lastRunStatus: null,
		createdAt: daysAgo(30), ...overrides,
	};
}

// ── Alert Templates ──────────────────────────────────────────────

export function makeAlert(overrides: Partial<Alert> = {}): Alert {
	return {
		id: uid('alert'), tenantId: healthyTenant.id,
		ruleId: 'SEC-001', severity: 'high', category: 'security',
		title: 'Test Alert', description: 'A test alert',
		businessImpact: 'Moderate risk', affectedResources: [],
		recommendedAction: 'Investigate and remediate',
		remediationType: 'semi_automatic', status: 'active',
		createdAt: daysAgo(1), resolvedAt: null, resolvedBy: null,
		...overrides,
	};
}
