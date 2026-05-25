/**
 * Group Cleanup — identifies empty, orphaned, and inactive groups for cleanup.
 * Runs on schedule; stores results in KV and creates alerts.
 */
import type { Env } from '../index';
import { getDb } from '../lib/db';
import { getAllActiveTenants } from '@tenantiq/db';
import { createGraphClient } from './user-sync';
import { assertOrgId } from '../lib/org-scope-assert';

const DAY_MS = 86_400_000;
const INACTIVE_THRESHOLD_DAYS = 90;
const KV_TTL_SECONDS = 90 * 24 * 3600;

interface GroupInfo {
	id: string;
	displayName: string;
	mail: string | null;
	groupType: string;
	memberCount: number;
	ownerCount: number;
	lastActivity: string | null;
	daysSinceActivity: number | null;
	status: 'active' | 'empty' | 'orphaned' | 'inactive';
}

interface CleanupResult {
	tenantId: string;
	runAt: string;
	total: number;
	empty: number;
	orphaned: number;
	inactive: number;
	groups: GroupInfo[];
}

function classifyGroup(
	memberCount: number,
	ownerCount: number,
	lastActivity: string | null,
	now: number,
): GroupInfo['status'] {
	if (memberCount === 0) return 'empty';
	if (ownerCount === 0) return 'orphaned';
	const days = computeDays(lastActivity, now);
	if (days !== null && days >= INACTIVE_THRESHOLD_DAYS) return 'inactive';
	if (days === null) return 'inactive';
	return 'active';
}

function computeDays(dateStr: string | null, now: number): number | null {
	if (!dateStr) return null;
	const d = new Date(dateStr).getTime();
	return isNaN(d) ? null : Math.floor((now - d) / DAY_MS);
}

async function getGroupCounts(
	graph: ReturnType<typeof createGraphClient>,
	azureTenantId: string,
	groupId: string,
): Promise<{ members: number; owners: number }> {
	try {
		const [membersRes, ownersRes] = await Promise.all([
			graph.paginate<{ id: string }>(azureTenantId, `/groups/${groupId}/members?$select=id&$top=1`),
			graph.paginate<{ id: string }>(azureTenantId, `/groups/${groupId}/owners?$select=id&$top=1`),
		]);
		let members = 0;
		let owners = 0;
		for await (const b of membersRes) members += b.length;
		for await (const b of ownersRes) owners += b.length;
		return { members, owners };
	} catch {
		return { members: -1, owners: -1 };
	}
}

function resolveLastActivity(
	renewedDateTime: string | null,
	lastMailActivity: string | null,
): string | null {
	const dates = [renewedDateTime, lastMailActivity]
		.filter(Boolean)
		.map((d) => new Date(d!).getTime())
		.filter((t) => !isNaN(t));
	if (dates.length === 0) return null;
	return new Date(Math.max(...dates)).toISOString();
}

export async function runGroupCleanup(env: Env): Promise<void> {
	console.log('[GroupCleanup] Starting group cleanup scan');

	const db = getDb(env);
	const tenants = await getAllActiveTenants(db);
	const graphClient = createGraphClient(env);
	const now = Date.now();

	for (const tenant of tenants) {
		assertOrgId(tenant.organizationId, 'GroupCleanup');
		try {
			const groups: GroupInfo[] = [];
			let empty = 0;
			let orphaned = 0;
			let inactive = 0;

			for await (const batch of graphClient.paginate<{
				id: string;
				displayName: string;
				mail: string | null;
				groupTypes: string[];
				renewedDateTime?: string;
			}>(
				tenant.azureTenantId,
				'/groups?$select=id,displayName,mail,groupTypes,renewedDateTime&$top=999',
			)) {
				for (const group of batch) {
					const { members, owners } = await getGroupCounts(graphClient, tenant.azureTenantId, group.id);
					const lastActivity = resolveLastActivity(group.renewedDateTime ?? null, null);
					const status = classifyGroup(
						members >= 0 ? members : 1,
						owners >= 0 ? owners : 1,
						lastActivity,
						now,
					);
					const daysSinceActivity = computeDays(lastActivity, now);

					groups.push({
						id: group.id,
						displayName: group.displayName,
						mail: group.mail,
						groupType: group.groupTypes?.includes('Unified') ? 'microsoft365' : 'security',
						memberCount: Math.max(members, 0),
						ownerCount: Math.max(owners, 0),
						lastActivity,
						daysSinceActivity,
						status,
					});

					if (status === 'empty') empty++;
					if (status === 'orphaned') orphaned++;
					if (status === 'inactive') inactive++;
				}
			}

			const result: CleanupResult = {
				tenantId: tenant.id,
				runAt: new Date().toISOString(),
				total: groups.length,
				empty,
				orphaned,
				inactive,
				groups,
			};

			await env.KV.put(`group-cleanup:${tenant.id}`, JSON.stringify(result), { expirationTtl: KV_TTL_SECONDS });

			if (empty > 0 || orphaned > 0 || inactive > 0) {
				await createGroupAlerts(env, tenant.id, result);
			}

			console.log(
				`[GroupCleanup] Scanned ${groups.length} groups, ${empty} empty, ${orphaned} orphaned, ${inactive} inactive for ${tenant.displayName}`,
			);
		} catch (err) {
			console.error(`[GroupCleanup] Failed for ${tenant.displayName}:`, err);
		}
	}

	console.log('[GroupCleanup] Complete');
}

async function createGroupAlerts(env: Env, tenantId: string, result: CleanupResult): Promise<void> {
	const now = new Date().toISOString();
	const id = crypto.randomUUID();
	const affected = result.empty + result.orphaned + result.inactive;
	const title = `${affected} groups need cleanup attention`;
	const description = `Found ${result.empty} empty, ${result.orphaned} orphaned, ${result.inactive} inactive groups.`;

	await env.DB.prepare(
		'INSERT OR IGNORE INTO alerts (id, tenant_id, type, severity, title, description, source, status, affected_users, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
	).bind(
		id, tenantId, 'group_cleanup', 'low', title, description,
		'group_cleanup', 'active', affected,
		JSON.stringify({ empty: result.empty, orphaned: result.orphaned, inactive: result.inactive }),
		now, now,
	).run().catch(() => {});
}
