/**
 * Sync Job Tracker — records background job execution in the sync_jobs table.
 *
 * Wraps any async job function with start/complete/fail lifecycle tracking.
 */

export interface TrackSyncJobOpts {
	type: string;
	tenantId: string;
	orgId: string;
}

export interface SyncJobResult {
	itemsProcessed: number;
	itemsFailed: number;
}

export async function trackSyncJob(
	db: D1Database,
	opts: TrackSyncJobOpts,
	fn: () => Promise<SyncJobResult>,
): Promise<SyncJobResult> {
	const jobId = crypto.randomUUID();
	const now = Date.now();

	await db
		.prepare(
			'INSERT INTO sync_jobs (id, org_id, tenant_id, type, status, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		)
		.bind(jobId, opts.orgId, opts.tenantId, opts.type, 'running', now, now)
		.run();

	try {
		const result = await fn();

		await db
			.prepare(
				'UPDATE sync_jobs SET status = ?, completed_at = ?, items_processed = ?, items_failed = ? WHERE id = ?',
			)
			.bind('completed', Date.now(), result.itemsProcessed, result.itemsFailed, jobId)
			.run();

		return result;
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);

		await db
			.prepare(
				'UPDATE sync_jobs SET status = ?, completed_at = ?, error_message = ? WHERE id = ?',
			)
			.bind('failed', Date.now(), message, jobId)
			.run();

		throw err;
	}
}
