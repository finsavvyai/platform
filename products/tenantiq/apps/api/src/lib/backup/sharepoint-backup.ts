/**
 * SharePoint Backup
 *
 * Backs up SharePoint site document libraries via Microsoft Graph delta queries.
 * Uses incremental sync to minimize API calls on subsequent runs.
 */

import type { Env } from '../../app/types';
import type { BackupResult } from './types';
import { updateJobStatus } from './orchestrator';

type GraphFetcher = (path: string) => Promise<any>;

interface DriveItem {
	id: string;
	name: string;
	size: number;
	webUrl: string;
	lastModifiedDateTime: string;
	file?: { mimeType: string };
	folder?: { childCount: number };
}

interface SiteInfo {
	id: string;
	displayName: string;
	webUrl: string;
}

interface GraphDeltaResponse {
	value: DriveItem[];
	'@odata.deltaLink'?: string;
	'@odata.nextLink'?: string;
}

/** Backup SharePoint sites and document libraries for a tenant */
export async function backupSharePointSites(
	env: Env,
	graphFetch: GraphFetcher,
	tenantId: string,
	jobId: string
): Promise<BackupResult> {
	await updateJobStatus(env, jobId, { status: 'running' });

	try {
		const sites = await fetchSites(graphFetch);
		const allItems: { siteId: string; siteName: string; items: DriveItem[] }[] = [];
		let totalItems = 0;

		for (const site of sites) {
			const items = await fetchSiteDriveItems(graphFetch, site.id, tenantId, env.KV);
			allItems.push({ siteId: site.id, siteName: site.displayName, items });
			totalItems += items.length;
		}

		const data = JSON.stringify({ sites: allItems, backedUpAt: new Date().toISOString() });
		const sizeBytes = new TextEncoder().encode(data).byteLength;

		const r2Key = `backups/${tenantId}/sharepoint/${jobId}.json`;
		await env.R2.put(r2Key, data, {
			customMetadata: { tenantId, jobId, type: 'sharepoint', timestamp: new Date().toISOString() },
		});

		const result: BackupResult = { itemsCount: totalItems, sizeBytes };
		await updateJobStatus(env, jobId, {
			status: 'completed',
			itemsCount: result.itemsCount,
			sizeBytes: result.sizeBytes,
		});

		return result;
	} catch (err: any) {
		await updateJobStatus(env, jobId, { status: 'failed', error: err.message });
		throw err;
	}
}

/** Fetch all SharePoint sites the app has access to */
async function fetchSites(graphFetch: GraphFetcher): Promise<SiteInfo[]> {
	const response = await graphFetch('/sites?search=*&$top=100');
	return (response.value ?? []).map((s: any) => ({
		id: s.id,
		displayName: s.displayName ?? 'Untitled',
		webUrl: s.webUrl,
	}));
}

/** Fetch drive items for a site using delta queries */
async function fetchSiteDriveItems(
	graphFetch: GraphFetcher,
	siteId: string,
	tenantId: string,
	kv: KVNamespace
): Promise<DriveItem[]> {
	const deltaKey = `backup:sharepoint:delta:${tenantId}:${siteId}`;
	const savedDelta = await kv.get(deltaKey);
	const items: DriveItem[] = [];

	let url = savedDelta ?? `/sites/${siteId}/drive/root/delta?$top=100`;

	while (url) {
		const response: GraphDeltaResponse = await graphFetch(url);
		items.push(...response.value);

		if (response['@odata.deltaLink']) {
			await kv.put(deltaKey, response['@odata.deltaLink']);
			break;
		}

		url = response['@odata.nextLink'] ?? '';
	}

	return items;
}

/** Get the R2 key prefix for SharePoint backups */
export function getSharePointBackupPrefix(tenantId: string): string {
	return `backups/${tenantId}/sharepoint/`;
}
