/**
 * Tenant CRUD routes: list, create, get, delete.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { getDb } from '../../lib/db';
import { getTenantById } from '@tenantiq/db';
import { tenantOnboardSchema } from '@tenantiq/shared';
import * as jose from 'jose';
import { forbidden, notFound } from '../../lib/errors';
import { genId, verifyTenantAccess, mapTenant } from './helpers';

export const crudRoutes = new Hono<AppEnv>();

// GET /api/tenants — List tenants for the user's organization
crudRoutes.get('/', async (c) => {
	const user = c.get('user');
	const db = c.env.DB;
	const result = await db
		.prepare('SELECT id, organization_id, azure_tenant_id, display_name, domain, status, last_sync_at, created_at FROM tenants WHERE organization_id = ? ORDER BY created_at DESC')
		.bind(user.orgId)
		.all();
	return c.json({ tenants: result.results.map(mapTenant) });
});

// Per-plan tenant caps. Mirrors apps/web/src/lib/config/plan-limits.ts.
const TENANT_CAPS: Record<string, number> = {
	trial: 1,
	free: 1,
	core: 5,
	professional: 25,
	security_suite: 50,
	enterprise: Number.MAX_SAFE_INTEGER,
};

// POST /api/tenants — Onboard new tenant
crudRoutes.post('/', async (c) => {
	const user = c.get('user');
	const raw = await c.req.json();
	const parsed = tenantOnboardSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
	}

	const db = c.env.DB;

	// Enforce plan tenant cap before creation.
	const org = await db
		.prepare('SELECT billing_plan FROM organizations WHERE id = ?')
		.bind(user.orgId)
		.first<{ billing_plan: string }>();
	const plan = org?.billing_plan ?? 'free';
	const cap = TENANT_CAPS[plan] ?? 1;
	const countRow = await db
		.prepare('SELECT COUNT(*) as n FROM tenants WHERE organization_id = ?')
		.bind(user.orgId)
		.first<{ n: number }>();
	const current = countRow?.n ?? 0;
	if (current >= cap) {
		return c.json({
			error: {
				code: 'PLAN_LIMIT',
				message: `Your "${plan}" plan is limited to ${cap} tenant${cap === 1 ? '' : 's'}. Upgrade to add more.`,
				plan,
				cap,
				current,
			},
		}, 402);
	}

	const tenantId = genId();
	const now = Date.now();
	await db
		.prepare('INSERT INTO tenants (id, organization_id, azure_tenant_id, display_name, domain, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
		.bind(tenantId, user.orgId, parsed.data.azureTenantId, parsed.data.displayName, parsed.data.domain, 'active', now)
		.run();

	const tenant = { id: tenantId, organizationId: user.orgId, displayName: parsed.data.displayName, domain: parsed.data.domain, status: 'active' };

	// Issue a new JWT that includes the newly created tenant
	const updatedTenantIds = [...(user.tenantIds ?? []), tenantId];
	const secret = new TextEncoder().encode(c.env.JWT_SECRET);
	const newToken = await new jose.SignJWT({
		sub: user.sub,
		email: user.email,
		name: user.name,
		orgId: user.orgId,
		tenantIds: updatedTenantIds,
		role: user.role
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('24h')
		.sign(secret);

	await c.env.KV.put(`session:${user.sub}`, newToken, { expirationTtl: 86400 });

	return c.json({ tenant, token: newToken }, 201);
});

// GET /api/tenants/:id — Tenant details + health summary
crudRoutes.get('/:id', async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	const db = getDb(c.env);
	const tenant = await getTenantById(db, id);
	if (!tenant) throw notFound('Tenant');
	return c.json({ tenant });
});

// DELETE /api/tenants/:id — Remove tenant and all its data
crudRoutes.delete('/:id', async (c) => {
	const id = c.req.param('id');
	if (!verifyTenantAccess(c, id)) throw forbidden('You do not have access to this tenant');
	const db = c.env.DB;
	const purge = c.req.query('purge') === 'true';

	if (purge) {
		await Promise.all([
			db.prepare('DELETE FROM alerts WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM alert_history WHERE alert_id IN (SELECT id FROM alerts WHERE tenant_id = ?)').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM users_cache WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM licenses_cache WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM intelligence_scans WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM user_activity_snapshots WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM remediations WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM workflows WHERE tenant_id = ?').bind(id).run().catch(() => {}),
			db.prepare('DELETE FROM audit_logs WHERE tenant_id = ?').bind(id).run().catch(() => {}),
		]);
		await Promise.all([
			c.env.KV.delete(`sync:${id}`),
			c.env.KV.delete(`synced:${id}`),
			c.env.KV.delete(`consent:${id}`),
			c.env.KV.delete(`profile:${id}`),
			c.env.KV.delete(`securescore:${id}`),
		]);
	}

	await db.prepare('DELETE FROM tenants WHERE id = ?').bind(id).run();

	return c.json({ success: true, purged: purge });
});
