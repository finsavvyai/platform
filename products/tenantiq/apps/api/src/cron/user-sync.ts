import type { Env } from '../index';
import { getDb } from '../lib/db';
import { getAllActiveTenants, upsertUser, updateTenantSyncTime, upsertLicense } from '@tenantiq/db';
import { GraphClient } from '@tenantiq/graph';
import { LicenseOperations } from '@tenantiq/graph';
import { trackSyncJob } from '../lib/sync-job-tracker';

function createGraphClient(env: Env) {
	if (!env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET) {
		throw new Error('Azure credentials are not configured');
	}

	return new GraphClient({
		clientId: env.AZURE_CLIENT_ID,
		clientSecret: env.AZURE_CLIENT_SECRET,
		tokenStore: {
			async getToken(tenantId: string) {
				// Read from auth callback's KV format (graph:{tid}:access_token / refresh_token)
				const accessToken = await env.KV.get(`graph:${tenantId}:access_token`);
				const refreshToken = await env.KV.get(`graph:${tenantId}:refresh_token`);
				if (accessToken) return { accessToken, refreshToken: refreshToken || '', expiresAt: Date.now() + 3600000 };
				if (refreshToken) return { accessToken: '', refreshToken, expiresAt: 0 };
				throw new Error(`No token for tenant ${tenantId}`);
			},
			async setToken(tenantId: string, accessToken: string, refreshToken: string, expiresAt: number) {
				// Store in auth callback's format so both cron and routes can read
				const ttl = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
				await env.KV.put(`graph:${tenantId}:access_token`, accessToken, { expirationTtl: ttl });
				if (refreshToken) {
					await env.KV.put(`graph:${tenantId}:refresh_token`, refreshToken);
				}
			}
		}
	});
}

export { createGraphClient };

export async function runUserSync(env: Env) {
	console.log('[UserSync] Starting user sync for all active tenants');

	const db = getDb(env);
	const tenants = await getAllActiveTenants(db);
	const graphClient = createGraphClient(env);
	const licenseOps = new LicenseOperations(graphClient);

	for (const tenant of tenants) {
		try {
			console.log(`[UserSync] Syncing tenant: ${tenant.displayName}`);

			await trackSyncJob(env.DB, {
				type: 'user_sync',
				tenantId: tenant.id,
				orgId: tenant.organizationId ?? tenant.id,
			}, async () => {
				let userCount = 0;
				for await (const batch of graphClient.paginate<{
					id: string;
					displayName: string;
					mail: string;
					userPrincipalName: string;
					userType: string;
					accountEnabled: boolean;
					signInActivity?: { lastSignInDateTime?: string; lastNonInteractiveSignInDateTime?: string };
					assignedLicenses?: Array<{ skuId: string }>;
				}>(tenant.azureTenantId, '/users?$select=id,displayName,mail,userPrincipalName,userType,accountEnabled,signInActivity,assignedLicenses&$top=999')) {
					for (const user of batch) {
						const lastSignInDate = user.signInActivity?.lastSignInDateTime
						? new Date(user.signInActivity.lastSignInDateTime)
						: null;
					await upsertUser(db, tenant.id, user.id, {
							displayName: user.displayName,
							email: user.mail ?? user.userPrincipalName,
							userType: user.userType?.toLowerCase() === 'guest' ? 'guest' : 'member',
							accountEnabled: user.accountEnabled,
							lastSignInAt: lastSignInDate ? lastSignInDate.getTime() : null,
							assignedLicenses: (user.assignedLicenses ?? []).map((l) => l.skuId)
						} as any);
						userCount++;
					}
				}

				const skusResult = await licenseOps.getSubscribedSkus(tenant.azureTenantId);
				const skus = skusResult.value as Array<{
					skuId: string;
					skuPartNumber: string;
					prepaidUnits: { enabled: number };
					consumedUnits: number;
				}>;

				for (const sku of skus) {
					await upsertLicense(db, tenant.id, sku.skuId, {
						skuPartNumber: sku.skuPartNumber,
						enabledUnits: sku.prepaidUnits.enabled,
						consumedUnits: sku.consumedUnits,
					});
				}

				await updateTenantSyncTime(db, tenant.id);
				await env.SCAN_QUEUE.send({
					type: 'post_sync_scan',
					tenantId: tenant.id,
					userCount,
					licenseCount: skus.length
				});

				console.log(`[UserSync] Synced ${userCount} users, ${skus.length} SKUs for ${tenant.displayName}`);
				return { itemsProcessed: userCount, itemsFailed: 0 };
			});
		} catch (err) {
			console.error(`[UserSync] Failed for tenant ${tenant.displayName}:`, err);
		}
	}

	console.log('[UserSync] Complete');
}
