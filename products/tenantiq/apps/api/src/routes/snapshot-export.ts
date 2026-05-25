/**
 * Snapshot Diff Export API Route
 * Downloads snapshot diff as JSON.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSnapshotManifest, getSnapshotCategory } from '../lib/snapshots/capture';
import { diffSnapshots } from '../lib/snapshots/diff';
import { getSelectedTenant } from '../lib/tenant-selector';

export const snapshotExportRoutes = new Hono<AppEnv>();
snapshotExportRoutes.use('*', authMiddleware);

// GET /api/config-snapshots/:id/export — Export snapshot or diff as JSON
snapshotExportRoutes.get('/:id/export', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const snapshotId = c.req.param('id');
	const compareId = c.req.query('compare');

	const manifest = await getSnapshotManifest(c.env.KV, tenantId, snapshotId);
	if (!manifest) return c.json({ error: 'Snapshot not found' }, 404);

	// If compare ID provided, export diff between two snapshots
	if (compareId) {
		const otherManifest = await getSnapshotManifest(c.env.KV, tenantId, compareId);
		if (!otherManifest) return c.json({ error: 'Comparison snapshot not found' }, 404);

		const allCats = [...new Set([...manifest.categories, ...otherManifest.categories])];
		const [oldCats, newCats] = await Promise.all([
			Promise.all(allCats.map((cat) =>
				getSnapshotCategory(c.env.KV, tenantId, snapshotId, cat)
					.then((d) => ({ categoryId: cat, name: cat, data: d?.data ?? null })),
			)),
			Promise.all(allCats.map((cat) =>
				getSnapshotCategory(c.env.KV, tenantId, compareId, cat)
					.then((d) => ({ categoryId: cat, name: cat, data: d?.data ?? null })),
			)),
		]);

		const diffs = diffSnapshots(oldCats, newCats);
		const exportData = {
			type: 'config-snapshot-diff',
			baseSnapshotId: snapshotId,
			compareSnapshotId: compareId,
			exportedAt: new Date().toISOString(),
			totalChanges: diffs.reduce((s, d) => s + d.changeCount, 0),
			diffs,
		};

		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="snapshot-diff-${snapshotId}-${compareId}.json"`,
			},
		});
	}

	// Export single snapshot manifest
	const categories = await Promise.all(
		manifest.categories.map((cat) =>
			getSnapshotCategory(c.env.KV, tenantId, snapshotId, cat)
				.then((d) => ({ categoryId: cat, data: d?.data ?? null })),
		),
	);

	const exportData = {
		type: 'config-snapshot',
		snapshotId,
		label: manifest.label,
		exportedAt: new Date().toISOString(),
		categories,
	};

	return new Response(JSON.stringify(exportData, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="snapshot-${snapshotId}.json"`,
		},
	});
});
