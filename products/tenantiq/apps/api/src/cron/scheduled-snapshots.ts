/**
 * Scheduled Snapshots Cron
 *
 * Captures M365 config snapshots on a per-tenant schedule.
 * Default: daily at 02:00 UTC. Override via KV key `snapshot-schedule:{tenantId}`.
 */

import type { Env } from '../app/types';
import { getDb, schema } from '../lib/db';
import { eq } from 'drizzle-orm';
import { captureSnapshot } from '../lib/snapshots/capture';
import { trackSyncJob } from '../lib/sync-job-tracker';

interface SnapshotSchedule {
	enabled: boolean;
	cronHour: number;
	frequency?: 'daily' | 'weekly' | 'none';
}

const DEFAULT_SCHEDULE: SnapshotSchedule = { enabled: false, cronHour: 2, frequency: 'none' };

async function getSchedule(kv: KVNamespace, tenantId: string): Promise<SnapshotSchedule> {
	const raw = await kv.get(`snapshot-schedule:${tenantId}`, 'json');
	if (!raw) return DEFAULT_SCHEDULE;
	return raw as SnapshotSchedule;
}

function shouldRunNow(schedule: SnapshotSchedule): boolean {
	if (!schedule.enabled || schedule.frequency === 'none') return false;
	const now = new Date();
	const currentHour = now.getUTCHours();
	if (currentHour !== schedule.cronHour) return false;
	// Weekly: only run on Sundays
	if (schedule.frequency === 'weekly' && now.getUTCDay() !== 0) return false;
	return true;
}

export async function runScheduledSnapshots(env: Env): Promise<void> {
	console.log('[ScheduledSnapshots] Starting scheduled snapshot capture');

	const db = getDb(env);
	const tenants = await db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.status, 'active'));

	let captured = 0;
	let skipped = 0;

	for (const tenant of tenants) {
		try {
			const schedule = await getSchedule(env.KV, tenant.id);
			if (!shouldRunNow(schedule)) {
				skipped++;
				continue;
			}

			await trackSyncJob(env.DB, {
				type: 'scheduled_snapshot',
				tenantId: tenant.id,
				orgId: tenant.id,
			}, async () => {
				const graphFetch = async (path: string) => {
					const token = await env.KV.get(`graph:${tenant.azureTenantId}:access_token`);
					if (!token) throw new Error(`No Graph token for ${tenant.id}`);
					const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
						headers: { Authorization: `Bearer ${token}` },
					});
					if (!res.ok) throw new Error(`Graph ${res.status}: ${path}`);
					return res.json();
				};

				const manifest = await captureSnapshot(
					graphFetch,
					env.KV,
					env.DB,
					tenant.id,
					'system:scheduled',
					`Scheduled snapshot ${new Date().toISOString().slice(0, 10)}`,
				);

				captured++;
				console.log(`[ScheduledSnapshots] ${tenant.name}: ${manifest.objectCount} objects`);
				return { itemsProcessed: manifest.objectCount, itemsFailed: manifest.errors.length };
			});
		} catch (err) {
			console.error(`[ScheduledSnapshots] Failed for ${tenant.name}:`, err);
		}
	}

	console.log(`[ScheduledSnapshots] Complete: ${captured} captured, ${skipped} skipped`);
}
