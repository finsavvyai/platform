/**
 * Guest User Review — identifies stale, orphaned, and removable guest accounts.
 * Runs on schedule; stores results in KV and creates alerts.
 */
import type { Env } from '../index';
import { getDb } from '../lib/db';
import { getAllActiveTenants } from '@tenantiq/db';
import { createGraphClient } from './user-sync';
import { assertOrgId } from '../lib/org-scope-assert';

const DAY_MS = 86_400_000;
const STALE_THRESHOLD_DAYS = 90;
const REMOVE_THRESHOLD_DAYS = 180;
const KV_TTL_SECONDS = 90 * 24 * 3600;

interface GuestInfo {
	id: string;
	displayName: string;
	mail: string | null;
	userPrincipalName: string;
	lastSignIn: string | null;
	status: 'active' | 'stale' | 'remove_candidate' | 'orphaned';
	groupCount: number;
	daysSinceSignIn: number | null;
}

interface ReviewResult {
	tenantId: string;
	runAt: string;
	total: number;
	stale: number;
	removeCandidates: number;
	orphaned: number;
	guests: GuestInfo[];
}

function classifyGuest(
	lastSignIn: string | null,
	groupCount: number,
	now: number,
): { status: GuestInfo['status']; daysSinceSignIn: number | null } {
	if (groupCount === 0) {
		return { status: 'orphaned', daysSinceSignIn: computeDays(lastSignIn, now) };
	}
	const days = computeDays(lastSignIn, now);
	if (days !== null && days >= REMOVE_THRESHOLD_DAYS) {
		return { status: 'remove_candidate', daysSinceSignIn: days };
	}
	if (days !== null && days >= STALE_THRESHOLD_DAYS) {
		return { status: 'stale', daysSinceSignIn: days };
	}
	if (days === null) {
		return { status: 'stale', daysSinceSignIn: null };
	}
	return { status: 'active', daysSinceSignIn: days };
}

function computeDays(lastSignIn: string | null, now: number): number | null {
	if (!lastSignIn) return null;
	const d = new Date(lastSignIn).getTime();
	return isNaN(d) ? null : Math.floor((now - d) / DAY_MS);
}

async function fetchGuestGroups(
	graph: ReturnType<typeof createGraphClient>,
	azureTenantId: string,
	userId: string,
): Promise<number> {
	try {
		const memberships = await graph.paginate<{ id: string }>(
			azureTenantId,
			`/users/${userId}/memberOf?$select=id&$top=100`,
		);
		let count = 0;
		for await (const batch of memberships) count += batch.length;
		return count;
	} catch {
		return -1; // unknown
	}
}

export async function runGuestReview(env: Env): Promise<void> {
	console.log('[GuestReview] Starting guest user review');

	const db = getDb(env);
	const tenants = await getAllActiveTenants(db);
	const graphClient = createGraphClient(env);
	const now = Date.now();

	for (const tenant of tenants) {
		assertOrgId(tenant.organizationId, 'GuestReview');
		try {
			const guests: GuestInfo[] = [];
			let stale = 0;
			let removeCandidates = 0;
			let orphaned = 0;

			for await (const batch of graphClient.paginate<{
				id: string;
				displayName: string;
				mail: string | null;
				userPrincipalName: string;
				signInActivity?: { lastSignInDateTime?: string };
			}>(
				tenant.azureTenantId,
				"/users?$filter=userType eq 'Guest'&$select=id,displayName,mail,userPrincipalName,signInActivity&$top=999",
			)) {
				for (const user of batch) {
					const lastSignIn = user.signInActivity?.lastSignInDateTime ?? null;
					const groupCount = await fetchGuestGroups(graphClient, tenant.azureTenantId, user.id);
					const { status, daysSinceSignIn } = classifyGuest(lastSignIn, groupCount >= 0 ? groupCount : 1, now);

					guests.push({
						id: user.id,
						displayName: user.displayName,
						mail: user.mail,
						userPrincipalName: user.userPrincipalName,
						lastSignIn,
						status,
						groupCount: Math.max(groupCount, 0),
						daysSinceSignIn,
					});

					if (status === 'stale') stale++;
					if (status === 'remove_candidate') removeCandidates++;
					if (status === 'orphaned') orphaned++;
				}
			}

			const result: ReviewResult = {
				tenantId: tenant.id,
				runAt: new Date().toISOString(),
				total: guests.length,
				stale,
				removeCandidates,
				orphaned,
				guests,
			};

			await env.KV.put(`guest-review:${tenant.id}`, JSON.stringify(result), { expirationTtl: KV_TTL_SECONDS });

			if (stale > 0 || orphaned > 0 || removeCandidates > 0) {
				await createGuestAlerts(env, tenant.id, result);
			}

			console.log(
				`[GuestReview] Reviewed ${guests.length} guests, ${stale} stale, ${removeCandidates} remove candidates for ${tenant.displayName}`,
			);
		} catch (err) {
			console.error(`[GuestReview] Failed for ${tenant.displayName}:`, err);
		}
	}

	console.log('[GuestReview] Complete');
}

async function createGuestAlerts(env: Env, tenantId: string, result: ReviewResult): Promise<void> {
	const now = new Date().toISOString();
	const id = crypto.randomUUID();
	const title = `${result.stale + result.removeCandidates + result.orphaned} guest users need attention`;
	const description = `Found ${result.stale} stale, ${result.removeCandidates} removal candidates, ${result.orphaned} orphaned guests.`;

	await env.DB.prepare(
		'INSERT OR IGNORE INTO alerts (id, tenant_id, type, severity, title, description, source, status, affected_users, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
	).bind(
		id, tenantId, 'guest_access', 'medium', title, description,
		'guest_review', 'active', result.stale + result.removeCandidates + result.orphaned,
		JSON.stringify({ stale: result.stale, removeCandidates: result.removeCandidates, orphaned: result.orphaned }),
		now, now,
	).run().catch(() => {});
}
