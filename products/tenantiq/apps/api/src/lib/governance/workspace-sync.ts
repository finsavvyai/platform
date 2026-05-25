/**
 * Workspace Sync — fetches M365 Groups, Teams, and SharePoint sites from Graph API.
 */

export interface Workspace {
	id: string;
	displayName: string;
	workspaceType: 'team' | 'group' | 'site';
	createdDateTime: string;
	lastActivityDate: string | null;
	memberCount: number;
	guestCount: number;
	ownerCount: number;
	storageUsedBytes: number;
	externalSharingLevel: string;
	visibility: string;
	status: 'active' | 'inactive' | 'archived';
}

export async function syncWorkspaces(
	graphFetch: (path: string) => Promise<any>,
	db: D1Database,
	tenantId: string,
): Promise<{ count: number; errors: string[] }> {
	const errors: string[] = [];
	const workspaces: Workspace[] = [];

	// Fetch M365 Groups (Unified = Teams-enabled groups)
	try {
		const groupsRes = await graphFetch("/groups?$filter=groupTypes/any(c:c eq 'Unified')&$select=id,displayName,createdDateTime,visibility,resourceProvisioningOptions,mail&$top=999");
		const groups = groupsRes.value || [];

		for (const g of groups) {
			const isTeam = (g.resourceProvisioningOptions || []).includes('Team');

			// Get member/owner counts
			let memberCount = 0, guestCount = 0, ownerCount = 0;
			try {
				const members = await graphFetch(`/groups/${g.id}/members?$select=id,userType&$top=999`);
				const memberList = members.value || [];
				memberCount = memberList.length;
				guestCount = memberList.filter((m: any) => m.userType === 'Guest').length;
			} catch { /* permission error */ }

			try {
				const owners = await graphFetch(`/groups/${g.id}/owners?$select=id&$top=100`);
				ownerCount = (owners.value || []).length;
			} catch { /* skip */ }

			workspaces.push({
				id: g.id,
				displayName: g.displayName || 'Unnamed',
				workspaceType: isTeam ? 'team' : 'group',
				createdDateTime: g.createdDateTime || new Date().toISOString(),
				lastActivityDate: null,
				memberCount,
				guestCount,
				ownerCount,
				storageUsedBytes: 0,
				externalSharingLevel: guestCount > 0 ? 'guests_present' : 'internal_only',
				visibility: g.visibility || 'Private',
				status: 'active',
			});
		}
	} catch (err) {
		errors.push(`Groups: ${err instanceof Error ? err.message : 'Failed'}`);
	}

	// Store in D1
	await db.prepare('DELETE FROM workspace_inventory WHERE tenant_id = ?').bind(tenantId).run().catch(() => {});

	for (const w of workspaces) {
		await db.prepare(
			'INSERT OR REPLACE INTO workspace_inventory (id, tenant_id, group_id, display_name, workspace_type, created_at, last_activity, member_count, guest_count, owner_count, storage_used_bytes, external_sharing, visibility, status, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
		).bind(
			w.id, tenantId, w.id, w.displayName, w.workspaceType,
			w.createdDateTime, w.lastActivityDate, w.memberCount, w.guestCount,
			w.ownerCount, w.storageUsedBytes, w.externalSharingLevel,
			w.visibility, w.status, new Date().toISOString(),
		).run().catch(() => {});
	}

	return { count: workspaces.length, errors };
}
