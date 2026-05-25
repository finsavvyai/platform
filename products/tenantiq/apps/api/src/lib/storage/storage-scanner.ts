import type { GraphClient } from '../graph-client';
import type { OneDriveUser, SharePointSite } from './storage-types';

const BYTES_PER_GB = 1024 ** 3;

function toGB(bytes: number): number {
	return Number((bytes / BYTES_PER_GB).toFixed(2));
}

function utilPct(used: number, total: number): number {
	return total > 0 ? Math.round((used / total) * 100) : 0;
}

const BATCH_SIZE = 10;

function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
	return chunks;
}

export async function scanOneDriveUsage(
	graph: GraphClient
): Promise<OneDriveUser[]> {
	const usersData = await graph
		.fetch('/users?$select=id,displayName,mail,userPrincipalName&$top=999')
		.catch(() => ({ value: [] }));

	type UserEntry = { id: string; displayName: string; mail: string; userPrincipalName: string };
	const userList = (usersData.value || []) as UserEntry[];
	const results: OneDriveUser[] = [];

	for (const chunk of chunkArray(userList, BATCH_SIZE)) {
		const settled = await Promise.allSettled(
			chunk.map(async (user) => {
				const drive = await graph.fetch(`/users/${user.id}/drive?$select=quota`);
				const used = drive.quota?.used ?? 0;
				const total = drive.quota?.total ?? 0;
				if (used === 0 && total === 0) return null;
				return {
					userId: user.id,
					displayName: user.displayName || user.userPrincipalName || 'Unknown',
					email: user.mail || user.userPrincipalName || '',
					usedBytes: used,
					allocatedBytes: total,
					usedGB: toGB(used),
					allocatedGB: toGB(total),
					utilizationPct: utilPct(used, total),
					lastActivityDate: null,
				} satisfies OneDriveUser;
			})
		);
		for (const r of settled) {
			if (r.status === 'fulfilled' && r.value) results.push(r.value);
		}
	}

	results.sort((a, b) => b.usedBytes - a.usedBytes);
	return results;
}

export async function scanSharePointUsage(
	graph: GraphClient
): Promise<SharePointSite[]> {
	const sitesData = await graph
		.fetch('/sites?search=*&$select=id,displayName,webUrl,createdDateTime&$top=200')
		.catch(() => ({ value: [] }));

	const results: SharePointSite[] = [];

	type SiteEntry = { id: string; displayName: string; webUrl: string };
	const siteList = (sitesData.value || []) as SiteEntry[];

	for (const chunk of chunkArray(siteList, BATCH_SIZE)) {
		const settled = await Promise.allSettled(
			chunk.map(async (site) => {
				const drive = await graph.fetch(`/sites/${site.id}/drive?$select=quota`);
				const used = drive.quota?.used ?? 0;
				const total = drive.quota?.total ?? 0;
				if (used === 0 && total === 0) return null;
				return {
					siteId: site.id,
					name: site.displayName || 'Unnamed',
					url: site.webUrl || '',
					usedBytes: used,
					allocatedBytes: total,
					usedGB: toGB(used),
					allocatedGB: toGB(total),
					utilizationPct: utilPct(used, total),
					lastActivityDate: null,
				} satisfies SharePointSite;
			})
		);
		for (const r of settled) {
			if (r.status === 'fulfilled' && r.value) results.push(r.value);
		}
	}

	results.sort((a, b) => b.usedBytes - a.usedBytes);
	return results;
}
