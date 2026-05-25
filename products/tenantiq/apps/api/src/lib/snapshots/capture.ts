/**
 * Snapshot Capture — orchestrates reading Graph config and persisting to KV/D1.
 */

import { captureAllCategories, type CategorySnapshot } from './config-reader';

export interface SnapshotManifest {
	id: string;
	tenantId: string;
	label: string;
	snapshotType: 'manual' | 'scheduled';
	categories: string[];
	objectCount: number;
	errors: string[];
	createdBy: string;
	createdAt: string;
}

export async function captureSnapshot(
	graphFetch: (path: string) => Promise<any>,
	kv: KVNamespace,
	db: D1Database,
	tenantId: string,
	createdBy: string,
	label?: string,
): Promise<SnapshotManifest> {
	const snapshotId = crypto.randomUUID();
	const createdAt = new Date().toISOString();

	// Capture all config categories from Graph API
	const categories = await captureAllCategories(graphFetch);

	const errors = categories.filter(c => c.error).map(c => `${c.name}: ${c.error}`);
	const successCategories = categories.filter(c => !c.error);
	const totalObjects = successCategories.reduce((s, c) => s + c.objectCount, 0);

	// Store each category as a separate KV entry for efficient retrieval
	for (const cat of successCategories) {
		await kv.put(
			`snapshot:${tenantId}:${snapshotId}:${cat.categoryId}`,
			JSON.stringify(cat),
			{ expirationTtl: 86400 * 90 }, // 90 days retention
		);
	}

	const manifest: SnapshotManifest = {
		id: snapshotId,
		tenantId,
		label: label || `Snapshot ${new Date().toLocaleDateString()}`,
		snapshotType: 'manual',
		categories: successCategories.map(c => c.categoryId),
		objectCount: totalObjects,
		errors,
		createdBy,
		createdAt,
	};

	// Store manifest in KV
	await kv.put(
		`snapshot:${tenantId}:${snapshotId}:manifest`,
		JSON.stringify(manifest),
		{ expirationTtl: 86400 * 90 },
	);

	// Store in D1 for listing/history
	await db.prepare(
		'INSERT INTO config_snapshots (id, tenant_id, label, snapshot_type, category_count, object_count, error_count, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
	).bind(snapshotId, tenantId, manifest.label, manifest.snapshotType, successCategories.length, totalObjects, errors.length, createdBy, createdAt)
		.run().catch(() => {});

	// Detect drift against the named baseline if one exists, else against the
	// previous snapshot. Named baseline lets a tenant lock "this is the
	// configuration that passed our SOC 2 audit" and measure drift from it.
	let previousId: string | null = null;
	const baselineRow = await db
		.prepare('SELECT id FROM config_snapshots WHERE tenant_id = ? AND is_baseline = 1 ORDER BY created_at DESC LIMIT 1')
		.bind(tenantId)
		.first<{ id: string }>()
		.catch(() => null);
	if (baselineRow?.id && baselineRow.id !== snapshotId) {
		previousId = baselineRow.id;
	} else {
		previousId = await kv.get(`snapshot:${tenantId}:latest`);
	}
	if (previousId && previousId !== snapshotId) {
		try {
			const { detectDrift } = await import('./drift-detector');
			await detectDrift(kv, db, tenantId, manifest, previousId, graphFetch);
		} catch { /* drift detection is non-critical */ }
	}

	// Update "latest" pointer
	await kv.put(`snapshot:${tenantId}:latest`, snapshotId, { expirationTtl: 86400 * 90 });

	return manifest;
}

export async function getSnapshotCategory(
	kv: KVNamespace,
	tenantId: string,
	snapshotId: string,
	categoryId: string,
): Promise<CategorySnapshot | null> {
	return kv.get(`snapshot:${tenantId}:${snapshotId}:${categoryId}`, 'json');
}

export async function getSnapshotManifest(
	kv: KVNamespace,
	tenantId: string,
	snapshotId: string,
): Promise<SnapshotManifest | null> {
	return kv.get(`snapshot:${tenantId}:${snapshotId}:manifest`, 'json');
}
