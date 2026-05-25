/**
 * Shared PSA integration route factory.
 * Creates identical connect/test/status/sync/disconnect/mappings routes
 * for any provider, parameterized by provider name and test function.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { notFound, validationError } from '../lib/errors';
import type { PSAProvider } from '../../../../packages/integrations/src/base/types';

const mappingSchema = z.object({
	tenantId: z.string().min(1),
	remoteCompanyId: z.string().min(1),
	remoteCompanyName: z.string().optional(),
});

type IntegrationRow = {
	id: string; status: string; last_sync_at: string | null;
	config_encrypted: string; created_at: string;
};

async function getIntegration(db: any, orgId: string, provider: PSAProvider) {
	return (await db.prepare(
		`SELECT id, status, last_sync_at, config_encrypted, created_at
		 FROM integrations WHERE org_id = ? AND provider = ? LIMIT 1`,
	).bind(orgId, provider).first()) as IntegrationRow | null;
}

export interface TestConnectionFn {
	(config: Record<string, string>): Promise<{ ok: boolean; message: string }>;
}

export function createPSARoutes(
	provider: PSAProvider,
	credentialsSchema: z.ZodSchema,
	testConnectionFn: TestConnectionFn,
) {
	const routes = new Hono<AppEnv>();
	routes.use('*', authMiddleware);

	// POST /connect
	routes.post('/connect', async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const parsed = credentialsSchema.safeParse(body);
		if (!parsed.success) throw validationError('Invalid credentials', { issues: parsed.error.issues });

		const user = c.get('user');
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`INSERT INTO integrations (id, org_id, provider, config_encrypted, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'active', ?, ?)`,
		).bind(id, user.orgId, provider, JSON.stringify(parsed.data), now, now).run();
		return c.json({ success: true, integrationId: id });
	});

	// POST /test
	routes.post('/test', async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const parsed = credentialsSchema.safeParse(body);
		if (!parsed.success) throw validationError('Invalid credentials', { issues: parsed.error.issues });
		const result = await testConnectionFn(parsed.data as any);
		return c.json(result);
	});

	// GET /status
	routes.get('/status', async (c) => {
		const row = await getIntegration(c.env.DB, c.get('user').orgId, provider);
		if (!row) throw notFound(`${provider} integration`);
		const mappingCount = await c.env.DB.prepare(
			`SELECT COUNT(*) as count FROM integration_mappings WHERE integration_id = ?`,
		).bind(row.id).first<{ count: number }>();
		return c.json({
			id: row.id, status: row.status, lastSyncAt: row.last_sync_at,
			mappedTenants: mappingCount?.count ?? 0, createdAt: row.created_at,
		});
	});

	// POST /sync
	routes.post('/sync', async (c) => {
		const row = await getIntegration(c.env.DB, c.get('user').orgId, provider);
		if (!row) throw notFound(`${provider} integration`);
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`UPDATE integrations SET last_sync_at = ?, updated_at = ? WHERE id = ?`,
		).bind(now, now, row.id).run();
		return c.json({ success: true, syncedAt: now });
	});

	// DELETE /disconnect
	routes.delete('/disconnect', async (c) => {
		const row = await getIntegration(c.env.DB, c.get('user').orgId, provider);
		if (!row) throw notFound(`${provider} integration`);
		await c.env.DB.prepare(`DELETE FROM integration_mappings WHERE integration_id = ?`).bind(row.id).run();
		await c.env.DB.prepare(`DELETE FROM integrations WHERE id = ?`).bind(row.id).run();
		return c.json({ success: true });
	});

	// GET /mappings
	routes.get('/mappings', async (c) => {
		const row = await getIntegration(c.env.DB, c.get('user').orgId, provider);
		if (!row) throw notFound(`${provider} integration`);
		const mappings = await c.env.DB.prepare(
			`SELECT id, local_id, remote_id, remote_name, synced_at
			 FROM integration_mappings WHERE integration_id = ? AND entity_type = 'tenant'
			 ORDER BY synced_at DESC`,
		).bind(row.id).all();
		return c.json({ mappings: mappings.results ?? [] });
	});

	// POST /mappings
	routes.post('/mappings', async (c) => {
		const row = await getIntegration(c.env.DB, c.get('user').orgId, provider);
		if (!row) throw notFound(`${provider} integration`);
		const body = await c.req.json().catch(() => ({}));
		const parsed = mappingSchema.safeParse(body);
		if (!parsed.success) throw validationError('Invalid mapping', { issues: parsed.error.issues });
		const { tenantId, remoteCompanyId, remoteCompanyName } = parsed.data;
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`INSERT OR REPLACE INTO integration_mappings
			 (id, integration_id, entity_type, local_id, remote_id, remote_name, synced_at)
			 VALUES (?, ?, 'tenant', ?, ?, ?, ?)`,
		).bind(id, row.id, tenantId, remoteCompanyId, remoteCompanyName || null, now).run();
		return c.json({ success: true, mappingId: id });
	});

	return routes;
}
