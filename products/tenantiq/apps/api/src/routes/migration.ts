/**
 * Cross-Tenant Migration API
 *
 * Allows MSPs to create migration plans between tenants in the same org
 * and execute them asynchronously via the scan queue.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/auth.middleware';
import { getSelectedTenant } from '../lib/tenant-selector';

export const migrationRoutes = new Hono<AppEnv>();
migrationRoutes.use('*', authMiddleware);

interface MigrationPlanRequest {
	sourceTenantId: string;
	targetTenantId: string;
	scope: ('users' | 'groups' | 'policies')[];
}

interface MigrationPlanItem {
	type: string;
	name: string;
	action: 'create' | 'update' | 'skip';
}

// POST /api/migration/plan — create migration plan (admin+ only)
migrationRoutes.post('/plan', requireRole('admin', 'super_admin'), async (c) => {
	const user = c.get('user');
	const body = await c.req.json<MigrationPlanRequest>().catch(() => null);
	if (!body?.sourceTenantId || !body?.targetTenantId || !body?.scope?.length) {
		return c.json({ error: 'sourceTenantId, targetTenantId, and scope are required' }, 400);
	}

	const db = c.env.DB;

	// Validate both tenants belong to same org
	const [source, target] = await Promise.all([
		db.prepare('SELECT id, organization_id, display_name FROM tenants WHERE id = ?')
			.bind(body.sourceTenantId).first<{ id: string; organization_id: string; display_name: string }>(),
		db.prepare('SELECT id, organization_id, display_name FROM tenants WHERE id = ?')
			.bind(body.targetTenantId).first<{ id: string; organization_id: string; display_name: string }>(),
	]);

	if (!source || !target) {
		return c.json({ error: 'One or both tenants not found' }, 404);
	}

	if (source.organization_id !== target.organization_id) {
		return c.json({ error: 'Tenants must belong to the same organization' }, 403);
	}

	// Validate user has access to both tenants
	const tenantIds = user.tenantIds ?? [];
	if (!tenantIds.includes(body.sourceTenantId) || !tenantIds.includes(body.targetTenantId)) {
		return c.json({ error: 'Access denied to one or both tenants' }, 403);
	}

	// Build migration plan items based on scope
	const items: MigrationPlanItem[] = [];
	for (const scopeType of body.scope) {
		items.push(...buildPlanItems(scopeType));
	}

	const planId = crypto.randomUUID();
	const plan = {
		planId,
		sourceTenantId: body.sourceTenantId,
		targetTenantId: body.targetTenantId,
		scope: body.scope,
		items,
		estimatedDuration: estimateDuration(items.length),
		createdAt: new Date().toISOString(),
		createdBy: user.email,
	};

	await c.env.KV.put(`migration:plan:${planId}`, JSON.stringify(plan), {
		expirationTtl: 24 * 60 * 60,
	});

	return c.json({ plan });
});

// POST /api/migration/execute — execute migration plan (admin+ only)
migrationRoutes.post('/execute', requireRole('admin', 'super_admin'), async (c) => {
	const body = await c.req.json<{ planId: string }>().catch(() => null);
	if (!body?.planId) return c.json({ error: 'planId is required' }, 400);

	const planRaw = await c.env.KV.get(`migration:plan:${body.planId}`);
	if (!planRaw) return c.json({ error: 'Plan not found or expired' }, 404);

	const migrationId = crypto.randomUUID();
	const status = {
		migrationId,
		planId: body.planId,
		status: 'queued' as const,
		progress: 0,
		itemsProcessed: 0,
		totalItems: JSON.parse(planRaw).items?.length ?? 0,
		errors: [] as string[],
		createdAt: new Date().toISOString(),
	};

	await c.env.KV.put(`migration:status:${migrationId}`, JSON.stringify(status), {
		expirationTtl: 7 * 24 * 60 * 60,
	});

	// Queue for async processing
	await c.env.SCAN_QUEUE.send({
		type: 'migration',
		migrationId,
		planId: body.planId,
	});

	return c.json({ migrationId, status: 'queued' });
});

// GET /api/migration/:id/status — check migration progress
migrationRoutes.get('/:id/status', async (c) => {
	const migrationId = c.req.param('id');
	const statusRaw = await c.env.KV.get(`migration:status:${migrationId}`);
	if (!statusRaw) return c.json({ error: 'Migration not found' }, 404);

	const status = JSON.parse(statusRaw);
	return c.json({
		status: status.status,
		progress: status.progress,
		itemsProcessed: status.itemsProcessed,
		errors: status.errors,
	});
});

function buildPlanItems(scopeType: string): MigrationPlanItem[] {
	const items: MigrationPlanItem[] = [];
	switch (scopeType) {
		case 'users':
			items.push({ type: 'users', name: 'User accounts', action: 'create' });
			items.push({ type: 'users', name: 'User licenses', action: 'update' });
			break;
		case 'groups':
			items.push({ type: 'groups', name: 'Security groups', action: 'create' });
			items.push({ type: 'groups', name: 'M365 groups', action: 'create' });
			break;
		case 'policies':
			items.push({ type: 'policies', name: 'Conditional access', action: 'create' });
			items.push({ type: 'policies', name: 'Auth methods', action: 'update' });
			break;
	}
	return items;
}

function estimateDuration(itemCount: number): string {
	const minutes = Math.max(1, Math.ceil(itemCount * 2));
	return minutes <= 60 ? `${minutes} minutes` : `${Math.ceil(minutes / 60)} hours`;
}
