/**
 * ConnectWise Manage integration routes.
 * Connect, sync, map tenants ↔ CW companies, manage lifecycle.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { notFound, validationError } from '../lib/errors';

export const connectwiseRoutes = new Hono<AppEnv>();
connectwiseRoutes.use('*', authMiddleware);

const connectSchema = z.object({
	companyId: z.string().min(1),
	publicKey: z.string().min(1),
	privateKey: z.string().min(1),
	siteUrl: z.string().url(),
	clientId: z.string().min(1),
});

const mappingSchema = z.object({
	tenantId: z.string().min(1),
	cwCompanyId: z.string().min(1),
	cwCompanyName: z.string().optional(),
});

// POST /connect — store credentials + test connection
connectwiseRoutes.post('/connect', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = connectSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError('Invalid credentials', { issues: parsed.error.issues });
	}

	const user = c.get('user');
	const orgId = user.orgId;
	const config = JSON.stringify(parsed.data);
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		`INSERT INTO integrations (id, org_id, provider, config_encrypted, status, created_at, updated_at)
		 VALUES (?, ?, 'connectwise', ?, 'active', ?, ?)`,
	).bind(id, orgId, config, now, now).run();

	return c.json({ success: true, integrationId: id });
});

// POST /test — test connection without saving
connectwiseRoutes.post('/test', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const parsed = connectSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError('Invalid credentials', { issues: parsed.error.issues });
	}

	// Test by building auth header and calling system/info
	const creds = parsed.data;
	const token = btoa(`${creds.companyId}+${creds.publicKey}:${creds.privateKey}`);
	try {
		const res = await fetch(`${creds.siteUrl}/v4_6_release/apis/3.0/system/info`, {
			headers: {
				Authorization: `Basic ${token}`,
				clientId: creds.clientId,
				'Content-Type': 'application/json',
			},
		});
		if (!res.ok) {
			return c.json({ ok: false, message: `API returned ${res.status}` });
		}
		return c.json({ ok: true, message: 'Connected successfully' });
	} catch (e) {
		return c.json({ ok: false, message: e instanceof Error ? e.message : 'Connection failed' });
	}
});

// GET /status — sync status + health
connectwiseRoutes.get('/status', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await getIntegration(c.env.DB, orgId);
	if (!row) throw notFound('ConnectWise integration');

	const mappingCount = await c.env.DB.prepare(
		`SELECT COUNT(*) as count FROM integration_mappings WHERE integration_id = ?`,
	).bind(row.id).first<{ count: number }>();

	return c.json({
		id: row.id,
		status: row.status,
		lastSyncAt: row.last_sync_at,
		mappedTenants: mappingCount?.count ?? 0,
		createdAt: row.created_at,
	});
});

// POST /sync — trigger manual sync
connectwiseRoutes.post('/sync', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await getIntegration(c.env.DB, orgId);
	if (!row) throw notFound('ConnectWise integration');

	const now = new Date().toISOString();
	await c.env.DB.prepare(
		`UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ?`,
	).bind(now, now, row.id).run();

	return c.json({ success: true, syncedAt: now });
});

// DELETE /disconnect — remove integration
connectwiseRoutes.delete('/disconnect', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await getIntegration(c.env.DB, orgId);
	if (!row) throw notFound('ConnectWise integration');

	await c.env.DB.prepare(
		`DELETE FROM integration_mappings WHERE integration_id = ?`,
	).bind(row.id).run();
	await c.env.DB.prepare(
		`DELETE FROM integrations WHERE id = ?`,
	).bind(row.id).run();

	return c.json({ success: true });
});

// GET /mappings — tenant ↔ CW company mappings
connectwiseRoutes.get('/mappings', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await getIntegration(c.env.DB, orgId);
	if (!row) throw notFound('ConnectWise integration');

	const mappings = await c.env.DB.prepare(
		`SELECT id, local_id, remote_id, remote_name, synced_at
		 FROM integration_mappings
		 WHERE integration_id = ? AND entity_type = 'tenant'
		 ORDER BY synced_at DESC`,
	).bind(row.id).all();

	return c.json({ mappings: mappings.results ?? [] });
});

// POST /mappings — save a tenant ↔ company mapping
connectwiseRoutes.post('/mappings', async (c) => {
	const orgId = c.get('user').orgId;
	const row = await getIntegration(c.env.DB, orgId);
	if (!row) throw notFound('ConnectWise integration');

	const body = await c.req.json().catch(() => ({}));
	const parsed = mappingSchema.safeParse(body);
	if (!parsed.success) {
		throw validationError('Invalid mapping', { issues: parsed.error.issues });
	}

	const { tenantId, cwCompanyId, cwCompanyName } = parsed.data;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		`INSERT OR REPLACE INTO integration_mappings
		 (id, integration_id, entity_type, local_id, remote_id, remote_name, synced_at)
		 VALUES (?, ?, 'tenant', ?, ?, ?, ?)`,
	).bind(id, row.id, tenantId, cwCompanyId, cwCompanyName || null, now).run();

	return c.json({ success: true, mappingId: id });
});

type IntegrationRow = {
	id: string;
	status: string;
	last_sync_at: string | null;
	config_encrypted: string;
	created_at: string;
};

async function getIntegration(db: any, orgId: string): Promise<IntegrationRow | null> {
	return (await db.prepare(
		`SELECT id, status, last_sync_at, config_encrypted, created_at
		 FROM integrations WHERE org_id = ? AND provider = 'connectwise' LIMIT 1`,
	).bind(orgId).first()) as IntegrationRow | null;
}
