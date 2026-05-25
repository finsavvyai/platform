/**
 * Drift Suppression Rules API Routes
 * Manage rules that filter specific config drifts from alerting.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { getSelectedTenant } from '../lib/tenant-selector';

export const driftSuppressionRoutes = new Hono<AppEnv>();
driftSuppressionRoutes.use('*', authMiddleware);

const createRuleSchema = z.object({
	category: z.string().min(1).max(100),
	pathPattern: z.string().min(1).max(500),
	reason: z.string().max(500).optional(),
});

// GET /api/config-drifts/suppression-rules — List rules for tenant
driftSuppressionRoutes.get('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ rules: [] });

	const result = await c.env.DB.prepare(
		'SELECT * FROM drift_suppression_rules WHERE tenant_id = ? ORDER BY created_at DESC',
	).bind(tenantId).all().catch(() => ({ results: [] }));

	return c.json({ rules: result.results });
});

// POST /api/config-drifts/suppression-rules — Create rule
driftSuppressionRoutes.post('/', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json().catch(() => ({}));
	const parsed = createRuleSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

	const user = c.get('user');
	const id = crypto.randomUUID();
	const now = Date.now();

	await c.env.DB.prepare(
		'INSERT INTO drift_suppression_rules (id, org_id, tenant_id, category, path_pattern, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
	).bind(id, user.orgId, tenantId, parsed.data.category, parsed.data.pathPattern, parsed.data.reason ?? null, user.email, now).run();

	return c.json({
		success: true,
		rule: { id, orgId: user.orgId, tenantId, ...parsed.data, createdBy: user.email, createdAt: now },
	}, 201);
});

// DELETE /api/config-drifts/suppression-rules/:id — Delete rule
driftSuppressionRoutes.delete('/:id', async (c) => {
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const ruleId = c.req.param('id');
	await c.env.DB.prepare(
		'DELETE FROM drift_suppression_rules WHERE id = ? AND tenant_id = ?',
	).bind(ruleId, tenantId).run();

	return c.json({ success: true });
});
