/**
 * Delta Sync for Incremental Backups
 *
 * Uses Microsoft Graph delta queries to fetch only changed resources
 * since the last sync, reducing bandwidth and processing time.
 */

import type { Env } from '../../app/types';
import { GraphClient } from '../graph-client';
import { createTenantBackup } from '../backup';
import type { TenantBackupData } from '../backup';

export interface DeltaBackupResult {
	type: 'incremental' | 'full';
	itemsSynced: number;
	deltaToken: string;
	duration: number;
}

interface DeltaResponse {
	value: Record<string, unknown>[];
	'@odata.deltaLink'?: string;
	'@odata.nextLink'?: string;
}

const DELTA_RESOURCES = ['users', 'groups', 'directoryRoles'] as const;
type DeltaResource = (typeof DELTA_RESOURCES)[number];

/** Extract delta token from the deltaLink URL */
function extractDeltaToken(deltaLink: string): string {
	const url = new URL(deltaLink);
	return url.searchParams.get('$deltatoken') ?? '';
}

/** Fetch delta changes for a single resource, handling pagination */
async function fetchDeltaResource(
	graph: GraphClient,
	resource: DeltaResource,
	deltaToken: string | null,
): Promise<{ items: Record<string, unknown>[]; newToken: string; wasFull: boolean }> {
	const items: Record<string, unknown>[] = [];
	let wasFull = !deltaToken;

	const initialUrl = deltaToken
		? `/v1.0/${resource}/delta?$deltatoken=${deltaToken}`
		: `/v1.0/${resource}/delta`;

	let nextUrl: string | null = initialUrl;
	let newDeltaLink = '';

	while (nextUrl) {
		let data: DeltaResponse;
		try {
			data = await graph.fetch(nextUrl);
		} catch (err: unknown) {
			const status = (err as { message?: string })?.message ?? '';
			if (status.includes('404') || status.includes('410')) {
				// Delta token expired — fall back to full sync
				wasFull = true;
				return fetchDeltaResource(graph, resource, null);
			}
			throw err;
		}

		items.push(...(data.value ?? []));

		if (data['@odata.deltaLink']) {
			newDeltaLink = data['@odata.deltaLink'];
		}
		nextUrl = data['@odata.nextLink'] ?? null;
	}

	const newToken = newDeltaLink ? extractDeltaToken(newDeltaLink) : '';
	return { items, newToken, wasFull };
}

/** Perform an incremental backup using Graph delta queries */
export async function performDeltaBackup(
	env: Env,
	tenantId: string,
	graphToken: string,
): Promise<DeltaBackupResult> {
	const startTime = Date.now();
	const graph = new GraphClient(env as any, graphToken);
	let totalSynced = 0;
	let backupType: 'incremental' | 'full' = 'incremental';
	let lastDeltaToken = '';

	const allItems: Record<DeltaResource, Record<string, unknown>[]> = {
		users: [],
		groups: [],
		directoryRoles: [],
	};

	for (const resource of DELTA_RESOURCES) {
		const kvKey = `delta:${tenantId}:${resource}`;
		const existingToken = await env.KV.get(kvKey);
		const result = await fetchDeltaResource(graph, resource, existingToken);

		allItems[resource] = result.items;
		totalSynced += result.items.length;
		if (result.wasFull) backupType = 'full';
		if (result.newToken) {
			await env.KV.put(kvKey, result.newToken);
			lastDeltaToken = result.newToken;
		}
	}

	// Store backup data in R2 via existing backup functions
	const backupData: TenantBackupData = {
		metadata: {
			tenantId,
			azureTenantId: graphToken,
			displayName: '',
			domain: '',
			backupDate: new Date().toISOString(),
		},
		users: allItems.users.map(mapDeltaUser),
		groups: allItems.groups.map(mapDeltaGroup),
		licenses: [],
	};

	await createTenantBackup(env.R2, env.KV, backupData);

	return {
		type: backupType,
		itemsSynced: totalSynced,
		deltaToken: lastDeltaToken,
		duration: Date.now() - startTime,
	};
}

function mapDeltaUser(u: Record<string, unknown>) {
	return {
		id: (u.id as string) ?? '',
		userPrincipalName: (u.userPrincipalName as string) ?? '',
		displayName: (u.displayName as string) ?? '',
		mail: (u.mail as string) ?? undefined,
		jobTitle: (u.jobTitle as string) ?? undefined,
		department: (u.department as string) ?? undefined,
		accountEnabled: (u.accountEnabled as boolean) ?? true,
		assignedLicenses: (u.assignedLicenses as Array<{ skuId: string }>) ?? [],
	};
}

function mapDeltaGroup(g: Record<string, unknown>) {
	return {
		id: (g.id as string) ?? '',
		displayName: (g.displayName as string) ?? '',
		mail: (g.mail as string) ?? undefined,
		groupTypes: (g.groupTypes as string[]) ?? [],
	};
}
