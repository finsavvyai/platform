/**
 * Tenant workflow routes: CRUD, runs, trigger.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';

export const workflowRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/workflows
workflowRoutes.get('/:id/workflows', async (c) => {
	const id = c.req.param('id');
	const db = c.env.DB;
	const result = await db
		.prepare('SELECT id, name, enabled, type, schedule, last_executed_at, created_at FROM workflows WHERE tenant_id = ? ORDER BY created_at DESC')
		.bind(id)
		.all().catch(() => ({ results: [] }));
	const workflows = result.results.map((w: any) => ({
		id: w.id, name: w.name, enabled: !!w.enabled,
		workflowType: w.type, triggerType: w.schedule ? 'cron' : 'manual',
		triggerConfig: w.schedule ? JSON.parse(w.schedule || '{}') : {},
		lastRunAt: w.last_executed_at, createdAt: w.created_at,
	}));
	return c.json({ workflows });
});

// POST /api/tenants/:id/workflows — Create workflow
workflowRoutes.post('/:id/workflows', async (c) => {
	const id = c.req.param('id');
	const user = c.get('user');
	const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
	const db = c.env.DB;
	const wfId = crypto.randomUUID();
	const now = new Date().toISOString();
	const schedule = body.triggerType === 'cron' ? JSON.stringify(body.triggerConfig || {}) : null;
	await db.prepare(
		'INSERT INTO workflows (id, tenant_id, name, type, schedule, enabled, parameters, conditions, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)'
	).bind(
		wfId, id,
		String(body.name || 'Untitled'),
		String(body.workflowType || 'custom'),
		schedule,
		JSON.stringify(body.steps || []),
		JSON.stringify({}),
		now,
		user?.email || 'system',
		now
	).run();
	return c.json({ id: wfId, success: true }, 201);
});

// PATCH /api/tenants/:id/workflows/:wfId — Update workflow
workflowRoutes.patch('/:id/workflows/:wfId', async (c) => {
	const wfId = c.req.param('wfId');
	const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
	const db = c.env.DB;
	if ('enabled' in body) {
		await db.prepare('UPDATE workflows SET enabled = ?, updated_at = ? WHERE id = ?')
			.bind(body.enabled ? 1 : 0, new Date().toISOString(), wfId).run();
	}
	return c.json({ success: true });
});

// GET /api/tenants/:id/workflows/:wfId/runs — List runs
workflowRoutes.get('/:id/workflows/:wfId/runs', async (c) => {
	const wfId = c.req.param('wfId');
	const id = c.req.param('id');
	const raw = await c.env.KV.get(`workflow-runs:${id}:${wfId}`, 'json').catch(() => null);
	const runs = Array.isArray(raw) ? raw : [];
	return c.json({ runs });
});

// POST /api/tenants/:id/workflows/:wfId/run — Trigger run
workflowRoutes.post('/:id/workflows/:wfId/run', async (c) => {
	const wfId = c.req.param('wfId');
	const id = c.req.param('id');
	const db = c.env.DB;
	const wf = await db.prepare('SELECT type FROM workflows WHERE id = ? AND tenant_id = ?')
		.bind(wfId, id).first<{ type: string }>().catch(() => null);
	if (!wf) return c.json({ error: 'Workflow not found' }, 404);
	const { executeWorkflow } = await import('../../lib/workflow-executor');
	const result = await executeWorkflow(db, id, wf.type);
	const runId = crypto.randomUUID();
	const now = new Date().toISOString();
	const run = {
		id: runId, workflowId: wfId, tenantId: id, status: 'completed',
		stepsCompleted: result.steps.length, stepsTotal: result.steps.length,
		results: result, startedAt: now, completedAt: now, approvedBy: null,
	};
	const kvKey = `workflow-runs:${id}:${wfId}`;
	const existing = await c.env.KV.get(kvKey, 'json').catch(() => null);
	const history = Array.isArray(existing) ? existing : [];
	history.unshift(run);
	if (history.length > 10) history.length = 10;
	await c.env.KV.put(kvKey, JSON.stringify(history), { expirationTtl: 86400 * 90 });
	await db.prepare('UPDATE workflows SET last_executed_at = ?, updated_at = ? WHERE id = ?')
		.bind(now, now, wfId).run().catch(() => {});
	return c.json({ ...run, success: true });
});
