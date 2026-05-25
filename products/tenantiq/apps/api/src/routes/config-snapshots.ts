/**
 * Config Snapshot & Drift Detection API Routes
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { captureSnapshot, getSnapshotManifest, getSnapshotCategory } from '../lib/snapshots/capture';
import { diffSnapshots } from '../lib/snapshots/diff';
import { CONFIG_CATEGORIES } from '../lib/snapshots/config-reader';
import { getSelectedTenant } from '../lib/tenant-selector';
import { notFound, validationError } from '../lib/errors';

export const configSnapshotRoutes = new Hono<AppEnv>();
configSnapshotRoutes.use('*', authMiddleware);

// POST /api/config-snapshots/capture — Take a snapshot
configSnapshotRoutes.post('/capture', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const db = c.env.DB;
	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) throw notFound('Tenant');

	// Accept delegated tokens OR admin-consent flag (enables client_credentials fallback)
	// OR per-tenant client_secret in KV.
	const [aTok, rTok, consentFlag, perTenantSecret] = await Promise.all([
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`),
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`),
		c.env.KV.get(`consent:${tenantId}`),
		c.env.KV.get(`graph:${tenant.azure_tenant_id}:client_secret`),
	]);
	const hasAnyAuth = aTok || rTok || consentFlag === 'true' || perTenantSecret;
	if (!hasAnyAuth) return c.json({ error: 'No Graph API token. Please sync your tenant first.', graphTokenMissing: true }, 403);

	try {
		const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		const body = await c.req.json().catch(() => ({})) as { label?: string };
		const manifest = await captureSnapshot(
			(path) => graph.fetch(path), c.env.KV, db,
			tenantId, user.email || 'system', body.label,
		);
		return c.json({ success: true, snapshot: manifest });
	} catch (err) {
		console.error('Config snapshot capture failed:', err);
		return c.json({ error: 'Capture failed' }, 500);
	}
});

// GET /api/config-snapshots — List snapshots
configSnapshotRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ snapshots: [] });

	const result = await c.env.DB.prepare(
		'SELECT id, tenant_id, label, is_baseline, created_at, created_by, category_count FROM config_snapshots WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50',
	).bind(tenantId).all().catch(() => ({ results: [] }));

	return c.json({ snapshots: result.results });
});

// GET /api/config-snapshots/:id — Get snapshot manifest
configSnapshotRoutes.get('/:id', async (c) => {
	const tenantId = getSelectedTenant(c);
	const snapshotId = c.req.param('id');
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const manifest = await getSnapshotManifest(c.env.KV, tenantId, snapshotId);
	if (!manifest) throw notFound('Snapshot');
	return c.json({ snapshot: manifest, categories: CONFIG_CATEGORIES });
});

// GET /api/config-snapshots/:id/category/:cat — Get category data
configSnapshotRoutes.get('/:id/category/:cat', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const data = await getSnapshotCategory(c.env.KV, tenantId, c.req.param('id'), c.req.param('cat'));
	if (!data) throw notFound('Category');
	return c.json(data);
});

// GET /api/config-snapshots/baselines — List all baselines for current tenant
configSnapshotRoutes.get('/baselines', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ baselines: [] });

	const result = await c.env.DB.prepare(
		`SELECT id, tenant_id, label, baseline_label, created_at, created_by, category_count
		 FROM config_snapshots
		 WHERE tenant_id = ? AND is_baseline = 1
		 ORDER BY created_at DESC`,
	).bind(tenantId).all().catch(() => ({ results: [] }));

	return c.json({ baselines: result.results });
});

// POST /api/config-snapshots/:id/baseline — Mark snapshot as the active baseline.
// Body (optional): { label: string } — names the baseline (e.g., "post-soc2-2026-q1").
// Drift detection from now on compares against this baseline until a new one is set.
configSnapshotRoutes.post('/:id/baseline', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const snapshotId = c.req.param('id');
	const db = c.env.DB;

	const body = await c.req.json().catch(() => ({})) as { label?: string };
	const label = body.label?.trim().slice(0, 200) || null;

	// Verify snapshot belongs to this tenant before mutating anything else.
	const owned = await db
		.prepare('SELECT id FROM config_snapshots WHERE id = ? AND tenant_id = ? LIMIT 1')
		.bind(snapshotId, tenantId)
		.first<{ id: string }>()
		.catch(() => null);
	if (!owned) throw notFound('Snapshot');

	// Clear existing active baseline for this tenant (single active baseline at a time).
	await db.prepare('UPDATE config_snapshots SET is_baseline = 0 WHERE tenant_id = ?')
		.bind(tenantId).run().catch(() => {});

	// Set new baseline (and optionally name it)
	await db.prepare(
		'UPDATE config_snapshots SET is_baseline = 1, baseline_label = ? WHERE id = ? AND tenant_id = ?',
	).bind(label, snapshotId, tenantId).run();

	return c.json({ success: true, baselineId: snapshotId, baselineLabel: label });
});

// DELETE /api/config-snapshots/:id/baseline — Unmark a snapshot as baseline.
configSnapshotRoutes.delete('/:id/baseline', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const snapshotId = c.req.param('id');
	await c.env.DB.prepare(
		'UPDATE config_snapshots SET is_baseline = 0, baseline_label = NULL WHERE id = ? AND tenant_id = ?',
	).bind(snapshotId, tenantId).run();

	return c.json({ success: true });
});

// GET /api/config-snapshots/:id/diff/:otherId — Diff two snapshots
configSnapshotRoutes.get('/:id/diff/:otherId', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const [m1, m2] = await Promise.all([
		getSnapshotManifest(c.env.KV, tenantId, c.req.param('id')),
		getSnapshotManifest(c.env.KV, tenantId, c.req.param('otherId')),
	]);
	if (!m1 || !m2) throw notFound('Snapshot');

	const allCats = [...new Set([...m1.categories, ...m2.categories])];
	const [oldCats, newCats] = await Promise.all([
		Promise.all(allCats.map(cat =>
			getSnapshotCategory(c.env.KV, tenantId, c.req.param('id'), cat)
				.then(d => ({ categoryId: cat, name: cat, data: d?.data ?? null }))
		)),
		Promise.all(allCats.map(cat =>
			getSnapshotCategory(c.env.KV, tenantId, c.req.param('otherId'), cat)
				.then(d => ({ categoryId: cat, name: cat, data: d?.data ?? null }))
		)),
	]);

	const diffs = diffSnapshots(oldCats, newCats);
	return c.json({ diffs, totalChanges: diffs.reduce((s, d) => s + d.changeCount, 0) });
});
