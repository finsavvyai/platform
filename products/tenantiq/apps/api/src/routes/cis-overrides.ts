/**
 * CIS tenant override CRUD (Phase 2 / leverage-ScubaGear).
 * Mounted under /api/cis-benchmark/overrides.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';
import type { CisTenantOverride } from '@tenantiq/shared';

export const cisOverrideRoutes = new Hono<AppEnv>();
cisOverrideRoutes.use('*', authMiddleware);

const upsertSchema = z.object({
	controlId: z.string().min(1).max(64),
	decision: z.enum(['accepted_risk', 'omit']),
	justification: z.string().min(8).max(1000),
	expiresAt: z.string().datetime().nullable().optional(),
});

cisOverrideRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);
	const res = await c.env.DB.prepare(
		`SELECT id, tenant_id AS tenantId, control_id AS controlId, decision,
            justification, expires_at AS expiresAt, created_at AS createdAt,
            created_by AS createdBy
     FROM cis_tenant_overrides WHERE tenant_id = ? ORDER BY created_at DESC`,
	).bind(tenantId).all<CisTenantOverride>().catch(() => ({ results: [] as CisTenantOverride[] }));
	return c.json({ overrides: res.results ?? [] });
});

cisOverrideRoutes.put('/', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const parsed = upsertSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: 'Invalid payload', issues: parsed.error.issues }, 400);
	const { controlId, decision, justification, expiresAt } = parsed.data;

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await c.env.DB.prepare(
		`INSERT INTO cis_tenant_overrides (id, tenant_id, control_id, decision, justification, expires_at, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, control_id) DO UPDATE SET
       decision = excluded.decision,
       justification = excluded.justification,
       expires_at = excluded.expires_at,
       created_at = excluded.created_at,
       created_by = excluded.created_by`,
	).bind(id, tenantId, controlId, decision, justification, expiresAt ?? null, now, user.email).run();

	return c.json({ success: true, controlId, decision });
});

cisOverrideRoutes.delete('/:controlId', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);
	const controlId = c.req.param('controlId');
	if (!controlId) return c.json({ error: 'controlId required' }, 400);
	await c.env.DB.prepare(
		`DELETE FROM cis_tenant_overrides WHERE tenant_id = ? AND control_id = ?`,
	).bind(tenantId, controlId).run();
	return c.json({ success: true, controlId });
});
