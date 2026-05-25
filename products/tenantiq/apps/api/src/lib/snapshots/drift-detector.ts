/**
 * Config Drift Detector — compares new snapshot against baseline
 * and creates drift records + alerts for detected changes.
 */

import { getSnapshotCategory, type SnapshotManifest } from './capture';
import { diffSnapshots, type CategoryDiff } from './diff';
import { categoryToSeverity } from './snapshot-types';
import { runAttribution } from './attribution';

export interface DriftResult {
	driftsDetected: number;
	categories: CategoryDiff[];
	alertsCreated: number;
	attributionsPersisted?: number;
}

/**
 * Detect drift between a new manifest and a previous baseline; insert
 * config_drifts rows + alerts, and (when graphFetch is supplied) run a
 * best-effort attribution sweep against M365 directoryAudits.
 *
 * graphFetch is optional so this stays safe to call from contexts that
 * don't have Graph credentials handy (e.g., backfill scripts).
 */
export async function detectDrift(
	kv: KVNamespace,
	db: D1Database,
	tenantId: string,
	newManifest: SnapshotManifest,
	previousSnapshotId: string | null,
	graphFetch?: (path: string) => Promise<unknown>,
): Promise<DriftResult> {
	if (!previousSnapshotId) {
		return { driftsDetected: 0, categories: [], alertsCreated: 0 };
	}

	const allCats = newManifest.categories;
	const [oldCats, newCats] = await Promise.all([
		Promise.all(allCats.map(async (catId) => {
			const data = await getSnapshotCategory(kv, tenantId, previousSnapshotId, catId);
			return { categoryId: catId, name: catId, data: data?.data ?? null };
		})),
		Promise.all(allCats.map(async (catId) => {
			const data = await getSnapshotCategory(kv, tenantId, newManifest.id, catId);
			return { categoryId: catId, name: catId, data: data?.data ?? null };
		})),
	]);

	const diffs = diffSnapshots(oldCats, newCats);
	const totalDrifts = diffs.reduce((s, d) => s + d.changeCount, 0);
	if (totalDrifts === 0) return { driftsDetected: 0, categories: [], alertsCreated: 0 };

	let alertsCreated = 0;
	for (const cat of diffs) {
		if (cat.changeCount === 0) continue;
		const severity = categoryToSeverity(cat.categoryId);

		// Insert individual drift records
		for (const change of cat.changes.slice(0, 20)) {
			await db.prepare(
				`INSERT INTO config_drifts (id, tenant_id, snapshot_id, baseline_id, category, path, old_value, new_value, severity, acknowledged, detected_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
			).bind(
				crypto.randomUUID(), tenantId, newManifest.id, previousSnapshotId,
				cat.categoryId, change.path,
				change.oldValue != null ? JSON.stringify(change.oldValue) : null,
				change.newValue != null ? JSON.stringify(change.newValue) : null,
				severity, new Date().toISOString(),
			).run().catch(() => {});
		}

		// Create alert for significant drifts
		const now = Math.floor(Date.now() / 1000);
		await db.prepare(
			`INSERT INTO alerts (id, tenant_id, type, severity, title, description, status, source, metadata, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).bind(
			crypto.randomUUID(), tenantId, 'config_drift', severity,
			`Config drift: ${cat.changeCount} change(s) in ${cat.name.replace(/_/g, ' ')}`,
			`Detected ${cat.changeCount} configuration change(s) in ${cat.name.replace(/_/g, ' ')} since last snapshot.`,
			'active', 'drift_detector', JSON.stringify({
				categoryId: cat.categoryId,
				snapshotId: newManifest.id,
				baselineId: previousSnapshotId,
				changes: cat.changes.slice(0, 5),
			}),
			now, now,
		).run().catch(() => {});
		alertsCreated++;
	}

	await kv.put(`drift:${tenantId}:latest`, JSON.stringify({
		driftsDetected: totalDrifts, categories: diffs, detectedAt: new Date().toISOString(),
	}), { expirationTtl: 86400 });

	let attributionsPersisted: number | undefined;
	if (graphFetch && totalDrifts > 0) {
		try {
			// Look back 24h: covers the M365 audit log emit lag (typically 30–60 min,
			// occasionally up to several hours) without flooding the Graph endpoint.
			const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const r = await runAttribution(db, graphFetch, tenantId, since);
			attributionsPersisted = r.persisted;
		} catch { /* attribution is best-effort; never break drift detection */ }
	}

	return { driftsDetected: totalDrifts, categories: diffs, alertsCreated, attributionsPersisted };
}
