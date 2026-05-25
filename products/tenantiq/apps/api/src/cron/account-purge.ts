/**
 * Daily account-purge cron.
 * Hard-deletes orgs whose `deleted_at` is older than the grace window (30 days).
 * GDPR Art. 17 + M365 Cert C7 — see docs/DATA_DELETION.md.
 */

import type { Env } from '../app/types';
import { deleteOrganization } from '../lib/account-deletion';

const GRACE_DAYS = 30;

export async function runAccountPurge(env: Env): Promise<{ purged: string[]; failed: string[] }> {
	const cutoff = Date.now() - GRACE_DAYS * 86400 * 1000;
	const rows = await env.DB
		.prepare('SELECT id FROM organizations WHERE deleted_at IS NOT NULL AND deleted_at <= ?')
		.bind(cutoff)
		.all<{ id: string }>();

	const purged: string[] = [];
	const failed: string[] = [];

	// Construct a minimal Context-like shim so we can reuse deleteOrganization.
	// The cascade only touches env.DB / env.KV / env.R2 — no req/headers needed.
	const fakeCtx = { env } as unknown as Parameters<typeof deleteOrganization>[0];

	for (const row of rows.results) {
		try {
			const report = await deleteOrganization(fakeCtx, row.id);
			console.log('[account-purge] purged', row.id, JSON.stringify(report));
			purged.push(row.id);
		} catch (err) {
			console.error('[account-purge] failed for', row.id, err);
			failed.push(row.id);
		}
	}

	return { purged, failed };
}
