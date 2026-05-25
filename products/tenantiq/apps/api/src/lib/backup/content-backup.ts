/**
 * Content-Level Backup
 *
 * Backs up Exchange, SharePoint, and Teams metadata via Microsoft Graph API.
 * Captures folder structures, rules, site configs, and team channel layouts.
 */

export interface ExchangeBackup {
	folders: { name: string; itemCount: number }[];
	rules: { name: string; enabled: boolean }[];
	signatures: string[];
}

export interface SharePointBackup {
	sites: { name: string; url: string; lists: { name: string; itemCount: number }[] }[];
	permissions: { siteUrl: string; role: string; member: string }[];
}

export interface TeamsBackup {
	teams: { name: string; channels: { name: string; type: string }[]; tabs: { name: string; appName: string }[] }[];
}

interface GraphListResponse<T> {
	value: T[];
	'@odata.nextLink'?: string;
}

type GraphFetcher = (path: string) => Promise<any>;

/** Backup Exchange metadata for a specific user */
export async function backupExchangeMetadata(
	graphFetch: GraphFetcher,
	userId: string,
): Promise<ExchangeBackup> {
	const [foldersRes, rulesRes] = await Promise.all([
		graphFetch(`/v1.0/users/${userId}/mailFolders`).catch(() => ({ value: [] })),
		graphFetch(`/v1.0/users/${userId}/mailFolders/inbox/messageRules`).catch(() => ({ value: [] })),
	]);

	const folders = ((foldersRes as GraphListResponse<any>).value ?? []).map(
		(f: any) => ({
			name: (f.displayName as string) ?? '',
			itemCount: (f.totalItemCount as number) ?? 0,
		}),
	);

	const rules = ((rulesRes as GraphListResponse<any>).value ?? []).map(
		(r: any) => ({
			name: (r.displayName as string) ?? '',
			enabled: (r.isEnabled as boolean) ?? false,
		}),
	);

	return { folders, rules, signatures: [] };
}

/** Backup SharePoint site metadata */
export async function backupSharePointMetadata(
	graphFetch: GraphFetcher,
): Promise<SharePointBackup> {
	const sitesRes = await graphFetch('/v1.0/sites?search=*').catch(() => ({ value: [] }));
	const rawSites = (sitesRes as GraphListResponse<any>).value ?? [];

	const sites: SharePointBackup['sites'] = [];
	const permissions: SharePointBackup['permissions'] = [];

	for (const site of rawSites.slice(0, 50)) {
		const siteId = site.id as string;
		const siteUrl = (site.webUrl as string) ?? '';
		const siteName = (site.displayName as string) ?? '';

		const listsRes = await graphFetch(`/v1.0/sites/${siteId}/lists`).catch(
			() => ({ value: [] }),
		);

		const lists = ((listsRes as GraphListResponse<any>).value ?? []).map(
			(l: any) => ({
				name: (l.displayName as string) ?? '',
				itemCount: (l.list?.contentTypesEnabled as number) ?? 0,
			}),
		);

		sites.push({ name: siteName, url: siteUrl, lists });
	}

	return { sites, permissions };
}

/** Backup Teams metadata */
export async function backupTeamsMetadata(
	graphFetch: GraphFetcher,
): Promise<TeamsBackup> {
	const teamsFilter = "resourceProvisioningOptions/Any(x:x eq 'Team')";
	const groupsRes = await graphFetch(
		`/v1.0/groups?$filter=${encodeURIComponent(teamsFilter)}`,
	).catch(() => ({ value: [] }));

	const rawGroups = (groupsRes as GraphListResponse<any>).value ?? [];
	const teams: TeamsBackup['teams'] = [];

	for (const group of rawGroups.slice(0, 50)) {
		const teamId = group.id as string;
		const teamName = (group.displayName as string) ?? '';

		const channelsRes = await graphFetch(
			`/v1.0/teams/${teamId}/channels`,
		).catch(() => ({ value: [] }));

		const channels = ((channelsRes as GraphListResponse<any>).value ?? []).map(
			(ch: any) => ({
				name: (ch.displayName as string) ?? '',
				type: (ch.membershipType as string) ?? 'standard',
			}),
		);

		teams.push({ name: teamName, channels, tabs: [] });
	}

	return { teams };
}
