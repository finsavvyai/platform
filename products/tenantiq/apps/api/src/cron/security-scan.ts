import type { Env } from '../index';
import { getDb } from '../lib/db';
import { getAllActiveTenants, getUsersByTenant, getLicensesByTenant } from '@tenantiq/db';
import { RuleEngine } from '@tenantiq/intel';
import { SecurityOperations, PolicyOperations } from '@tenantiq/graph';
import { createGraphClient } from './user-sync';
import { trackSyncJob } from '../lib/sync-job-tracker';
import type { TenantData, Tenant, CachedUser, LicenseCache } from '@tenantiq/shared';

function mapUsers(users: Awaited<ReturnType<typeof getUsersByTenant>>): CachedUser[] {
	return users.map((u) => ({
		id: u.id,
		tenantId: u.tenantId,
		azureUserId: u.azureUserId,
		displayName: u.displayName ?? '',
		email: u.email ?? '',
		userType: (u.userType as 'member' | 'guest') ?? 'member',
		accountEnabled: u.accountEnabled ?? true,
		lastSignIn: u.lastSignIn?.toISOString() ?? null,
		lastNonInteractiveSignIn: u.lastNonInteractiveSignIn?.toISOString() ?? null,
		assignedLicenses: (u.assignedLicenses as string[]) ?? [],
		assignedGroups: (u.assignedGroups as string[]) ?? [],
		createdAt: u.createdAt?.toISOString() ?? '',
		updatedAt: u.updatedAt?.toISOString() ?? ''
	}));
}

function mapLicenses(licenses: Awaited<ReturnType<typeof getLicensesByTenant>>): LicenseCache[] {
	return licenses.map((l) => ({
		id: l.id,
		tenantId: l.tenantId,
		skuId: l.skuId,
		skuName: l.skuName,
		total: l.total,
		assigned: l.assigned,
		costPerUnit: l.costPerUnit ? Number(l.costPerUnit) : null,
		updatedAt: l.updatedAt?.toISOString() ?? ''
	}));
}

function mapTenant(tenant: Awaited<ReturnType<typeof getAllActiveTenants>>[0]): Tenant {
	return {
		id: tenant.id,
		organizationId: tenant.organizationId ?? '',
		azureTenantId: tenant.azureTenantId,
		displayName: tenant.displayName,
		domain: tenant.domain ?? '',
		lastSyncAt: tenant.lastSyncAt?.toISOString() ?? null,
		status: (tenant.status as 'active') ?? 'active',
		createdAt: tenant.createdAt?.toISOString() ?? ''
	};
}

export { mapUsers, mapLicenses, mapTenant };

export async function runSecurityScan(env: Env) {
	console.log('[SecurityScan] Starting hourly security scan');

	const db = getDb(env);
	const tenants = await getAllActiveTenants(db);
	const engine = new RuleEngine();
	const graphClient = createGraphClient(env);
	const securityOps = new SecurityOperations(graphClient);
	const policyOps = new PolicyOperations(graphClient);

	for (const tenant of tenants) {
		try {
			await trackSyncJob(env.DB, {
				type: 'security_scan',
				tenantId: tenant.id,
				orgId: tenant.organizationId ?? tenant.id,
			}, async () => {
				const [users, licenses] = await Promise.all([
					getUsersByTenant(db, tenant.id, { limit: 50000 }),
					getLicensesByTenant(db, tenant.id)
				]);

				let conditionalAccessPolicies: unknown[] = [];
				let signInLogs: unknown[] = [];
				let riskyUsers: unknown[] = [];

				try {
					const [caResult, signInsResult, riskyResult] = await Promise.all([
						policyOps.listConditionalAccessPolicies(tenant.azureTenantId),
						securityOps.getSignInLogs(tenant.azureTenantId, 24),
						securityOps.getRiskyUsers(tenant.azureTenantId)
					]);
					conditionalAccessPolicies = caResult.value ?? [];
					signInLogs = signInsResult.value ?? [];
					riskyUsers = riskyResult.value ?? [];
				} catch (graphErr) {
					console.warn(`[SecurityScan] Graph API fetch failed for ${tenant.displayName}:`, graphErr);
				}

				try {
					const scoreResult = await securityOps.getSecureScore(tenant.azureTenantId);
					if (scoreResult.value && scoreResult.value.length > 0) {
						const latest = scoreResult.value[0] as { currentScore?: number; maxScore?: number };
						if (latest.currentScore != null && latest.maxScore && latest.maxScore > 0) {
							const current = Math.round((latest.currentScore / latest.maxScore) * 100);
							const previous = await env.KV.get(`securescore:${tenant.id}`, 'json') as { current: number; trend: number[] } | null;
							const trend = previous?.trend ?? [];
							trend.push(current);
							if (trend.length > 30) trend.shift();
							await env.KV.put(`securescore:${tenant.id}`, JSON.stringify({ current, trend }), { expirationTtl: 604800 });
						}
					}
				} catch (scoreErr) {
					console.warn(`[SecurityScan] Secure Score fetch failed for ${tenant.displayName}:`, scoreErr);
				}

				const data: TenantData = { users: mapUsers(users), licenses: mapLicenses(licenses), conditionalAccessPolicies, signInLogs, riskyUsers };
				const candidates = await engine.evaluateCategory('security', mapTenant(tenant), data);

				if (candidates.length > 0) {
					await env.SCAN_QUEUE.send({ type: 'alert_candidates', tenantId: tenant.id, candidates });
				}

				try {
					const { generateAlertsWithPush } = await import('../lib/alert-generator');
					await generateAlertsWithPush(tenant.id, env);
				} catch (alertErr) {
					console.warn(`[SecurityScan] Alert generation failed for ${tenant.displayName}:`, alertErr);
				}

				console.log(`[SecurityScan] ${tenant.displayName}: ${candidates.length} findings`);
				return { itemsProcessed: candidates.length, itemsFailed: 0 };
			});
		} catch (err) {
			console.error(`[SecurityScan] Failed for ${tenant.displayName}:`, err);
		}
	}

	console.log('[SecurityScan] Complete');
}
