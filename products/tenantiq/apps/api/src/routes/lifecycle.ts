/**
 * User Lifecycle Automation API — onboarding/offboarding templates and execution
 */

import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware } from '../middleware/auth';
import { GraphClient } from '../lib/graph-client';
import { STEP_REGISTRY, type StepResult } from '../lib/lifecycle/step-handlers';
import { getSelectedTenant } from '../lib/tenant-selector';

export const lifecycleRoutes = new Hono<AppEnv>();
lifecycleRoutes.use('*', authMiddleware);

// GET /api/lifecycle/templates
lifecycleRoutes.get('/templates', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ templates: [] });

	const result = await c.env.DB.prepare('SELECT * FROM lifecycle_templates WHERE tenant_id = ? ORDER BY created_at DESC')
		.bind(tenantId).all().catch(() => ({ results: [] }));
	return c.json({ templates: result.results });
});

// POST /api/lifecycle/templates
lifecycleRoutes.post('/templates', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
	const id = crypto.randomUUID();
	await c.env.DB.prepare(
		'INSERT INTO lifecycle_templates (id, tenant_id, name, type, steps, requires_approval, enabled, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
	).bind(id, tenantId, String(body.name || 'Untitled'), String(body.type || 'offboard'), JSON.stringify(body.steps || []), body.requiresApproval ? 1 : 0, user.email || '', new Date().toISOString())
		.run();
	return c.json({ id, success: true }, 201);
});

// DELETE /api/lifecycle/templates/:id
lifecycleRoutes.delete('/templates/:id', async (c) => {
	await c.env.DB.prepare('DELETE FROM lifecycle_templates WHERE id = ?').bind(c.req.param('id')).run();
	return c.json({ success: true });
});

// POST /api/lifecycle/execute — Run a template against a user
lifecycleRoutes.post('/execute', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ error: 'No tenant' }, 400);

	const body = await c.req.json().catch(() => ({})) as { templateId?: string; targetUserId?: string; targetUserEmail?: string };
	if (!body.templateId || !body.targetUserId) return c.json({ error: 'templateId and targetUserId required' }, 400);

	const db = c.env.DB;
	const template = await db.prepare('SELECT * FROM lifecycle_templates WHERE id = ? AND tenant_id = ?')
		.bind(body.templateId, tenantId).first<any>();
	if (!template) return c.json({ error: 'Template not found' }, 404);

	const tenant = await db.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
		.bind(tenantId).first<{ azure_tenant_id: string }>();
	if (!tenant?.azure_tenant_id) return c.json({ error: 'Tenant not configured' }, 404);

	const hasToken = await c.env.KV.get(`graph:${tenant.azure_tenant_id}:access_token`) ||
		await c.env.KV.get(`graph:${tenant.azure_tenant_id}:refresh_token`);
	if (!hasToken) return c.json({ error: 'No Graph API token. Please sync your tenant first.', graphTokenMissing: true }, 403);

	const graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
	const graphFetch = (path: string, init?: RequestInit) =>
		init?.method ? graph.fetch(path) : graph.fetch(path);
	// For write operations, we need the full request
	const graphWrite = async (path: string, init?: RequestInit) => {
		const token = await c.env.KV.get(`graph:${tenant!.azure_tenant_id}:access_token`);
		return fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } });
	};

	const steps: Array<{ action: string; param?: string }> = JSON.parse(template.steps || '[]');
	const results: StepResult[] = [];

	for (const step of steps) {
		const handler = STEP_REGISTRY[step.action];
		if (!handler) { results.push({ step: step.action, status: 'skipped', detail: 'Unknown step' }); continue; }
		const res = await handler(graphWrite as any, body.targetUserId, step.param);
		results.push(res);
		if (res.status === 'failed') break; // Stop on failure
	}

	// Record execution
	const execId = crypto.randomUUID();
	await db.prepare(
		'INSERT INTO lifecycle_executions (id, tenant_id, template_id, target_user_id, target_user_email, status, steps_completed, steps_total, step_results, initiated_by, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
	).bind(execId, tenantId, body.templateId, body.targetUserId, body.targetUserEmail || '', results.every(r => r.status === 'success') ? 'completed' : 'failed', results.filter(r => r.status === 'success').length, steps.length, JSON.stringify(results), user.email || '', new Date().toISOString(), new Date().toISOString())
		.run().catch(() => {});

	return c.json({ executionId: execId, results, success: results.every(r => r.status === 'success') });
});

// GET /api/lifecycle/executions
lifecycleRoutes.get('/executions', async (c) => {
	const user = c.get('user');
	const tenantId = getSelectedTenant(c);
	if (!tenantId) return c.json({ executions: [] });

	const result = await c.env.DB.prepare('SELECT * FROM lifecycle_executions WHERE tenant_id = ? ORDER BY started_at DESC LIMIT 20')
		.bind(tenantId).all().catch(() => ({ results: [] }));
	return c.json({ executions: result.results });
});
