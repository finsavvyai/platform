/**
 * Graph API Sync — fetches real tenant data from Microsoft Graph
 * and stores it in D1 for the TenantIQ dashboard.
 */
import { GraphClient } from './graph-client';

interface SyncEnv {
	KV: KVNamespace;
	DB: D1Database;
	AZURE_CLIENT_ID?: string;
	AZURE_CLIENT_SECRET?: string;
}

interface SyncProgress {
	phase: 'users' | 'licenses' | 'security' | 'complete' | 'error';
	progress: number;
	message: string;
	startedAt: number;
}

interface SyncResult {
	users: number;
	licenses: number;
	errors: string[];
}

interface GraphUser {
	id: string;
	displayName?: string;
	mail?: string;
	userPrincipalName?: string;
	jobTitle?: string;
	department?: string;
	accountEnabled?: boolean;
	signInActivity?: { lastSignInDateTime?: string | null };
}

async function syncUsers(
	graph: GraphClient,
	db: D1Database,
	kv: KVNamespace,
	tenantId: string,
): Promise<{ count: number; error?: string }> {
	try {
		let usersData: { value?: GraphUser[] };
		try {
			usersData = await graph.fetch(
				'/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled,signInActivity&$top=999',
			);
		} catch {
			console.log('[Sync] signInActivity not available, falling back to basic user query');
			usersData = await graph.fetch(
				'/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled&$top=999',
			);
		}
		const users = usersData.value ?? [];

		// Atomic: delete + inserts in a single D1 batch. If any statement fails
		// the whole batch rolls back — tenant keeps its previous cache.
		const insertStmt = db.prepare(
			'INSERT OR REPLACE INTO users_cache (id, tenant_id, azure_user_id, user_principal_name, display_name, mail, account_enabled, job_title, department, last_sign_in_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
		);
		const statements: D1PreparedStatement[] = [
			db.prepare('DELETE FROM users_cache WHERE tenant_id = ?').bind(tenantId),
			...users.map((u) =>
				insertStmt.bind(
					u.id,
					tenantId,
					u.id,
					u.userPrincipalName ?? '',
					u.displayName ?? '',
					u.mail ?? u.userPrincipalName ?? '',
					u.accountEnabled ? 1 : 0,
					u.jobTitle ?? '',
					u.department ?? '',
					u.signInActivity?.lastSignInDateTime ?? null,
				),
			),
		];
		await db.batch(statements);

		await kv.put(`sync:${tenantId}:users`, String(users.length));
		return { count: users.length };
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'User sync failed';
		console.error('User sync failed:', msg);
		return { count: 0, error: msg };
	}
}

interface GraphSku {
	id: string;
	skuId: string;
	skuPartNumber: string;
	consumedUnits?: number;
	prepaidUnits?: { enabled?: number };
}

async function syncLicenses(
	graph: GraphClient,
	db: D1Database,
	kv: KVNamespace,
	tenantId: string,
): Promise<{ count: number; error?: string }> {
	try {
		const skusData = (await graph.fetch('/subscribedSkus')) as { value?: GraphSku[] };
		const skus = skusData.value ?? [];

		const insertStmt = db.prepare(
			'INSERT OR REPLACE INTO licenses_cache (id, tenant_id, sku_id, sku_part_number, consumed_units, enabled_units, prepaid_units, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
		);
		const now = new Date().toISOString();
		const statements: D1PreparedStatement[] = [
			db.prepare('DELETE FROM licenses_cache WHERE tenant_id = ?').bind(tenantId),
			...skus.map((sku) =>
				insertStmt.bind(
					sku.id,
					tenantId,
					sku.skuId,
					sku.skuPartNumber,
					sku.consumedUnits ?? 0,
					sku.prepaidUnits?.enabled ?? 0,
					sku.prepaidUnits?.enabled ?? 0,
					now,
				),
			),
		];
		await db.batch(statements);

		await kv.put(`sync:${tenantId}:licenses`, String(skus.length));
		return { count: skus.length };
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'License sync failed';
		console.error('License sync failed:', msg);
		return { count: 0, error: msg };
	}
}

async function writeSyncProgress(kv: KVNamespace, tid: string, p: SyncProgress) {
	await kv.put(`sync:${tid}`, JSON.stringify(p), { expirationTtl: 600 });
}

export async function syncTenantData(
	env: SyncEnv,
	tenantId: string,
	azureTenantId: string,
): Promise<SyncResult> {
	const graph = new GraphClient(env, azureTenantId);
	const errors: string[] = [];
	const startedAt = Date.now();

	// Phase 0: Tenant metadata — backfill display_name + domain from Graph if placeholder.
	try {
		const org = await graph.fetch('/organization') as { value?: Array<{ displayName?: string; verifiedDomains?: Array<{ name: string; isDefault?: boolean; isInitial?: boolean }> }> };
		const info = org.value?.[0];
		if (info) {
			const primary = info.verifiedDomains?.find((d) => d.isDefault) ?? info.verifiedDomains?.find((d) => d.isInitial) ?? info.verifiedDomains?.[0];
			const domain = primary?.name ?? azureTenantId;
			const displayName = info.displayName ?? 'Connected Tenant';
			await env.DB.prepare(
				"UPDATE tenants SET display_name = ?, domain = ? WHERE id = ? AND (display_name = 'Connected Tenant' OR display_name IS NULL OR domain = azure_tenant_id OR domain IS NULL)",
			).bind(displayName, domain, tenantId).run();
		}
	} catch (err) {
		errors.push(`Organization metadata: ${err instanceof Error ? err.message : 'Failed'}`);
	}

	// Phase 1: Users
	await writeSyncProgress(env.KV, tenantId, {
		phase: 'users', progress: 0, message: 'Syncing users from Microsoft 365...', startedAt,
	});
	const usersResult = await syncUsers(graph, env.DB, env.KV, tenantId);
	if (usersResult.error) errors.push(usersResult.error);

	// Phase 2: Licenses
	const userMsg = usersResult.count > 0
		? `Synced ${usersResult.count} users. Now syncing licenses...`
		: 'Syncing licenses...';
	await writeSyncProgress(env.KV, tenantId, {
		phase: 'licenses', progress: 33, message: userMsg, startedAt,
	});
	const licensesResult = await syncLicenses(graph, env.DB, env.KV, tenantId);
	if (licensesResult.error) errors.push(licensesResult.error);

	// Phase 3: Security
	const licMsg = licensesResult.count > 0
		? `Synced ${licensesResult.count} SKUs. Running security analysis...`
		: 'Running security analysis...';
	await writeSyncProgress(env.KV, tenantId, {
		phase: 'security', progress: 66, message: licMsg, startedAt,
	});

	// Fetch real Secure Score from Graph
	try {
		const { fetchSecureScore } = await import('./secure-score');
		await fetchSecureScore((p) => graph.fetch(p), env.KV, tenantId);
	} catch (err) {
		errors.push(`SecureScore: ${err instanceof Error ? err.message : 'Failed'}`);
	}

	// Generate security alerts from synced data + dispatch web push to subscribers.
	// Cast SyncEnv → Env: push-dispatch only reads VAPID_* (optional, no-op if missing).
	try {
		const { generateAlertsWithPush } = await import('./alert-generator');
		await generateAlertsWithPush(tenantId, env as unknown as import('../app/types').Env);
	} catch (err) {
		errors.push(`AlertGen: ${err instanceof Error ? err.message : 'Failed'}`);
	}

	// Phase 4: Complete
	await writeSyncProgress(env.KV, tenantId, {
		phase: 'complete', progress: 100, message: 'Sync complete', startedAt,
	});

	// Update tenant last_sync_at — schema declares integer (epoch ms).
	try {
		await env.DB
			.prepare('UPDATE tenants SET last_sync_at = ?, status = ? WHERE id = ?')
			.bind(Date.now(), 'active', tenantId)
			.run();
	} catch (err) {
		errors.push(`tenants.update: ${err instanceof Error ? err.message : 'Failed'}`);
	}

	// Emit notification for sync completion
	try {
		const { addNotification } = await import('./notifications');
		await addNotification(env.KV, tenantId, {
			type: 'sync',
			title: 'Sync completed',
			message: `Synced ${usersResult.count} users and ${licensesResult.count} licenses${errors.length ? ` (${errors.length} warning${errors.length > 1 ? 's' : ''})` : ''}`,
		});
	} catch { /* non-blocking */ }

	return { users: usersResult.count, licenses: licensesResult.count, errors };
}
