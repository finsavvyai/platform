import type { Env } from '../index';
import { getDb } from '../lib/db';
import {
	createAuditEntry,
	getTenantById,
	upsertUser,
	upsertLicense,
	updateTenantSyncTime
} from '@tenantiq/db';
import { createGraphClient } from '../cron/user-sync';
import { LicenseOperations } from '@tenantiq/graph';
import { broadcastToTenant } from '../lib/broadcast';
import { assertOrgId } from '../lib/org-scope-assert';

interface GraphUser {
	id: string;
	displayName: string;
	mail: string;
	userPrincipalName: string;
	userType: string;
	accountEnabled: boolean;
	signInActivity?: {
		lastSignInDateTime?: string;
		lastNonInteractiveSignInDateTime?: string;
	};
	assignedLicenses?: Array<{ skuId: string }>;
}

interface GraphSku {
	skuId: string;
	skuPartNumber: string;
	prepaidUnits: { enabled: number };
	consumedUnits: number;
}

export async function processFullSync(tenantId: string, env: Env) {
	const db = getDb(env);
	const tenant = await getTenantById(db, tenantId);
	if (!tenant) {
		console.error(`[FullSync] Tenant not found: ${tenantId}`);
		return;
	}

	assertOrgId(tenant.organizationId, 'SyncHandler');

	console.log(`[FullSync] Starting sync for tenant: ${tenant.displayName}`);
	const graphClient = createGraphClient(env);
	const licenseOps = new LicenseOperations(graphClient);

	await broadcastToTenant(env, tenantId, {
		type: 'sync_progress', status: 'started', step: 'users', progress: 0
	});

	try {
		const userCount = await syncUsers(db, graphClient, tenant);

		await broadcastToTenant(env, tenantId, {
			type: 'sync_progress', status: 'running', step: 'licenses',
			progress: 50, userCount
		});

		const skus = await syncLicenses(db, licenseOps, tenant);
		await updateTenantSyncTime(db, tenant.id);

		await createAuditEntry(db, {
			tenantId: tenant.id,
			actor: 'system',
			action: 'sync.completed',
			details: { userCount, licenseCount: skus.length }
		});

		await broadcastToTenant(env, tenantId, {
			type: 'sync_progress', status: 'completed', step: 'done',
			progress: 100, userCount, licenseCount: skus.length
		});

		console.log(`[FullSync] Synced ${userCount} users, ${skus.length} SKUs for ${tenant.displayName}`);
	} catch (err) {
		await broadcastToTenant(env, tenantId, {
			type: 'sync_progress', status: 'failed', error: String(err)
		});
		console.error(`[FullSync] Failed for tenant ${tenant.displayName}:`, err);
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncUsers(db: any, graphClient: any, tenant: any): Promise<number> {
	let userCount = 0;
	const query = '/users?$select=id,displayName,mail,userPrincipalName,userType,accountEnabled,signInActivity,assignedLicenses&$top=999';
	const paginator: AsyncIterable<GraphUser[]> = graphClient.paginate(tenant.azureTenantId, query);

	for await (const batch of paginator) {
		for (const user of batch) {
			const lastSignInMs = user.signInActivity?.lastSignInDateTime
				? new Date(user.signInActivity.lastSignInDateTime).getTime()
				: null;
			await upsertUser(db, tenant.id, user.id, {
				displayName: user.displayName,
				userPrincipalName: user.userPrincipalName,
				mail: user.mail ?? null,
				accountEnabled: user.accountEnabled ? 1 : 0,
				lastSignInAt: lastSignInMs ? Math.floor(lastSignInMs / 1000) : null,
			});
			userCount++;
		}
	}
	return userCount;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncLicenses(db: any, licenseOps: any, tenant: any): Promise<GraphSku[]> {
	const skusResult = await licenseOps.getSubscribedSkus(tenant.azureTenantId);
	const skus = skusResult.value as GraphSku[];

	for (const sku of skus) {
		await upsertLicense(db, tenant.id, sku.skuId, {
			skuPartNumber: sku.skuPartNumber,
			enabledUnits: sku.prepaidUnits.enabled,
			consumedUnits: sku.consumedUnits,
		});
	}
	return skus;
}
