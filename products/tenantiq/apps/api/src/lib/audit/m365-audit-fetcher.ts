/**
 * Microsoft Graph audit log fetcher — pulls directoryAudits within a time window.
 *
 * directoryAudits is the canonical event log for admin-initiated config changes
 * in Entra ID / M365 (CA policy edits, role grants, app permissions, etc.).
 *
 * Reference: https://learn.microsoft.com/en-us/graph/api/directoryaudit-list
 *
 * Notes:
 *  - Default page size 100; we paginate until we have everything in the window.
 *  - $filter on activityDateTime requires ISO 8601 with no quotes.
 *  - Attribution code consumes only a subset of fields — we do not pull every column.
 *  - Caller passes a `graphFetch` function (the existing GraphClient.fetch wrapper)
 *    so we don't depend on Hono Context here.
 */

export interface DirectoryAuditEntry {
	id: string;
	activityDateTime: string;
	activityDisplayName: string;
	category: string;
	result: string;
	initiatedBy: {
		user?: { userPrincipalName?: string; displayName?: string; id?: string };
		app?: { displayName?: string; servicePrincipalId?: string };
	};
	targetResources: Array<{
		id?: string;
		displayName?: string;
		type?: string;
		modifiedProperties?: Array<{ displayName?: string; oldValue?: string; newValue?: string }>;
	}>;
}

interface GraphCollection<T> {
	value: T[];
	'@odata.nextLink'?: string;
}

const PATH = '/auditLogs/directoryAudits';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 10;

export async function fetchDirectoryAudits(
	graphFetch: (path: string) => Promise<unknown>,
	since: Date,
	until: Date = new Date(),
): Promise<DirectoryAuditEntry[]> {
	if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
		throw new TypeError('fetchDirectoryAudits: `since` must be a valid Date');
	}
	if (since.getTime() > until.getTime()) {
		throw new RangeError('fetchDirectoryAudits: `since` must be <= `until`');
	}

	const filter = `activityDateTime ge ${since.toISOString()} and activityDateTime le ${until.toISOString()}`;
	const orderBy = 'activityDateTime desc';
	let path: string | undefined =
		`${PATH}?$filter=${encodeURIComponent(filter)}&$top=${DEFAULT_PAGE_SIZE}&$orderby=${encodeURIComponent(orderBy)}`;

	const all: DirectoryAuditEntry[] = [];
	for (let page = 0; page < MAX_PAGES && path; page++) {
		const res = (await graphFetch(path)) as GraphCollection<DirectoryAuditEntry>;
		if (Array.isArray(res?.value)) all.push(...res.value);
		const next = res?.['@odata.nextLink'];
		path = next ? next.replace(/^https?:\/\/graph\.microsoft\.com\/v1\.0/, '') : undefined;
	}
	return all;
}

/** Extract the most-likely actor from an audit entry (UPN preferred, app fallback). */
export function actorFor(entry: DirectoryAuditEntry): string {
	return (
		entry.initiatedBy?.user?.userPrincipalName ??
		entry.initiatedBy?.user?.displayName ??
		entry.initiatedBy?.app?.displayName ??
		'unknown'
	);
}
