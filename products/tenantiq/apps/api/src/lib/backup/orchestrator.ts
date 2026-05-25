/**
 * Backup Orchestrator
 *
 * Coordinates backup job lifecycle: creation, status tracking, and listing.
 * Uses D1 for job persistence and dispatches work to service-specific handlers.
 */

import type { Env } from '../../app/types';
import type { BackupJob, BackupListOptions, BackupType } from './types';
import { getDb, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';

/** Generate a unique backup job ID */
function generateJobId(): string {
	return `bkp_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

/** Start a new backup job — creates record in D1 and returns the job */
export async function startBackup(
	env: Env,
	orgId: string,
	tenantId: string,
	type: BackupType
): Promise<BackupJob> {
	const db = getDb(env);
	const now = Date.now();
	const id = generateJobId();

	const job: BackupJob = {
		id,
		orgId,
		tenantId,
		type,
		status: 'pending',
		itemsCount: 0,
		sizeBytes: 0,
		startedAt: null,
		completedAt: null,
		error: null,
		createdAt: new Date(now).toISOString(),
	};

	await db.insert(schema.backupJobs).values({
		id: job.id,
		orgId: job.orgId,
		tenantId: job.tenantId,
		type: job.type,
		status: job.status,
		itemsCount: 0,
		sizeBytes: 0,
		startedAt: null,
		completedAt: null,
		error: null,
		createdAt: now,
	});

	return job;
}

/** Get a single backup job by ID */
export async function getJobStatus(
	env: Env,
	jobId: string,
	orgId: string
): Promise<BackupJob | null> {
	const db = getDb(env);
	const rows = await db
		.select()
		.from(schema.backupJobs)
		.where(and(eq(schema.backupJobs.id, jobId), eq(schema.backupJobs.orgId, orgId)))
		.limit(1);

	if (rows.length === 0) return null;
	return mapRowToJob(rows[0]);
}

/** List backup jobs for a tenant with optional filters */
export async function listJobs(
	env: Env,
	orgId: string,
	tenantId: string,
	options: BackupListOptions = {}
): Promise<{ jobs: BackupJob[]; total: number }> {
	const db = getDb(env);
	const limit = options.limit ?? 20;
	const offset = options.offset ?? 0;

	const conditions = [
		eq(schema.backupJobs.orgId, orgId),
		eq(schema.backupJobs.tenantId, tenantId),
	];

	if (options.type) {
		conditions.push(eq(schema.backupJobs.type, options.type));
	}
	if (options.status) {
		conditions.push(eq(schema.backupJobs.status, options.status));
	}

	const rows = await db
		.select()
		.from(schema.backupJobs)
		.where(and(...conditions))
		.orderBy(desc(schema.backupJobs.createdAt))
		.limit(limit)
		.offset(offset);

	return { jobs: rows.map(mapRowToJob), total: rows.length };
}

/** Update job status after backup completes or fails */
export async function updateJobStatus(
	env: Env,
	jobId: string,
	update: { status: string; itemsCount?: number; sizeBytes?: number; error?: string }
): Promise<void> {
	const db = getDb(env);
	const now = Date.now();

	await db
		.update(schema.backupJobs)
		.set({
			status: update.status,
			itemsCount: update.itemsCount ?? 0,
			sizeBytes: update.sizeBytes ?? 0,
			error: update.error ?? null,
			completedAt: update.status === 'completed' || update.status === 'failed' ? now : null,
			startedAt: update.status === 'running' ? now : undefined,
		})
		.where(eq(schema.backupJobs.id, jobId));
}

/** Get storage usage stats for a tenant */
export async function getStorageUsage(
	env: Env,
	orgId: string,
	tenantId: string
): Promise<{ totalJobs: number; totalSizeBytes: number; byType: Record<string, number> }> {
	const db = getDb(env);
	const rows = await db
		.select()
		.from(schema.backupJobs)
		.where(
			and(
				eq(schema.backupJobs.orgId, orgId),
				eq(schema.backupJobs.tenantId, tenantId),
				eq(schema.backupJobs.status, 'completed')
			)
		);

	const byType: Record<string, number> = {};
	let totalSizeBytes = 0;

	for (const row of rows) {
		totalSizeBytes += row.sizeBytes ?? 0;
		byType[row.type] = (byType[row.type] ?? 0) + (row.sizeBytes ?? 0);
	}

	return { totalJobs: rows.length, totalSizeBytes, byType };
}

function mapRowToJob(row: any): BackupJob {
	return {
		id: row.id,
		orgId: row.orgId,
		tenantId: row.tenantId,
		type: row.type,
		status: row.status,
		itemsCount: row.itemsCount ?? 0,
		sizeBytes: row.sizeBytes ?? 0,
		startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
		completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
		error: row.error,
		createdAt: new Date(row.createdAt).toISOString(),
	};
}
